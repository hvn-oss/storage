import { Schema } from "effect";
import {
  type AuthorizationContext,
  type OperationAuthorization,
  type OperationContext,
  type UploadAuthorization,
  type UploadRoute,
  type UploadRouteContract,
  type PromiseUploadRouteRegistry,
  UnsupportedProtocolVersion,
  UnsupportedProtocolVersionResponse,
} from "./index.ts";
import { storageProtocolVersion, storageProtocolVersionHeader } from "./internal/protocol.ts";

/** Represents an Effect schema used to infer one Promise Upload Route field. */
export type AnySchema = Schema.Schema<any>;

/** Extracts an Effect schema's decoded type. */
export type SchemaType<Schema extends AnySchema> = Schema["Type"];

/** Represents a value or Promise-like value returned by a Promise route callback. */
export type Awaitable<Value> = Value | PromiseLike<Value>;

/** Defines the static policy ceilings for one Upload Route. */
export type UploadPolicy = {
  /** Limits the number of files in one Upload Session. */
  readonly maxFiles: number;
  /** Limits the size in bytes of each proposed file. */
  readonly maxFileSize: number;
  /** Limits proposed media types when configured. */
  readonly acceptedContentTypes?: ReadonlyArray<string>;
  /** Limits the Upload Session lifetime in seconds. */
  readonly sessionLifetimeSeconds: number;
  /** Selects the byte size at which uploads use multipart transfer. */
  readonly multipartThreshold: number;
  /** Selects the size in bytes of multipart transfer parts. */
  readonly partSize: number;
  /** Limits upload capability lifetime in seconds. */
  readonly capabilityLifetimeSeconds: number;
  /** Limits the number of capabilities issued in one batch. */
  readonly maxCapabilityBatch: number;
  /** Limits Download Capability lifetime in seconds when configured. */
  readonly downloadCapabilityLifetimeSeconds?: number;
};

/** Defines the schemas and static configuration shared by Promise Upload Routes. */
type PromiseUploadRouteShape<
  InputSchema extends AnySchema,
  SessionMetadataSchema extends AnySchema,
  FileMetadataSchema extends AnySchema,
  PublicMetadataSchema extends AnySchema,
> = {
  /** Decodes untrusted upload authorization input. */
  readonly input: InputSchema;
  /** Validates trusted Upload Session metadata. */
  readonly sessionMetadata: SessionMetadataSchema;
  /** Validates trusted File Record metadata. */
  readonly fileMetadata: FileMetadataSchema;
  /** Validates metadata that may be exposed for downloads. */
  readonly publicMetadata: PublicMetadataSchema;
  /** Selects the trusted storage binding. */
  readonly storage: string;
  /** Defines the static policy ceilings for this route. */
  readonly policy: UploadPolicy;
};

/** Defines a Promise-authored Upload Route with schema-inferred callback types. */
export type PromiseUploadRouteConfig<
  InputSchema extends AnySchema,
  SessionMetadataSchema extends AnySchema,
  FileMetadataSchema extends AnySchema,
  PublicMetadataSchema extends AnySchema,
> = PromiseUploadRouteShape<
  InputSchema,
  SessionMetadataSchema,
  FileMetadataSchema,
  PublicMetadataSchema
> & {
  /** Authorizes a proposed Upload Session. */
  readonly authorizeUpload: (
    context: AuthorizationContext<
      SchemaType<InputSchema>,
      SchemaType<SessionMetadataSchema>,
      SchemaType<FileMetadataSchema>
    >,
  ) => Awaitable<
    UploadAuthorization<SchemaType<SessionMetadataSchema>, SchemaType<FileMetadataSchema>>
  >;
  /** Authorizes every operation on an Upload Session or File Record. */
  readonly authorizeOperation: (
    context: OperationContext<
      SchemaType<SessionMetadataSchema>,
      SchemaType<FileMetadataSchema>,
      SchemaType<PublicMetadataSchema>
    >,
  ) => Awaitable<OperationAuthorization<SchemaType<PublicMetadataSchema>>>;
};

/** Derives a client-visible route contract from its input and public metadata schemas. */
type UploadRouteContractFromSchemas<
  InputSchema extends AnySchema,
  PublicMetadataSchema extends AnySchema,
> = UploadRouteContract<SchemaType<InputSchema>, SchemaType<PublicMetadataSchema>>;

const uploadRouteKeyPattern = /^[a-z][a-z0-9-]{0,63}$/;

/** Reports an Upload Route registry that cannot safely become a handler configuration. */
export class InvalidUploadRouteRegistry extends Schema.TaggedErrorClass<InvalidUploadRouteRegistry>()(
  "InvalidUploadRouteRegistry",
  {
    reason: Schema.Literals(["not-plain-object", "invalid-key", "duplicate-key"]).annotate({
      description: "Identifies why the Upload Route registry cannot be used.",
    }),
    key: Schema.optional(Schema.String).annotate({
      description: "Identifies the offending route key when one is available.",
    }),
  },
) {}

/** Defines a Promise-authored Upload Route while preserving schema-inferred callback types. */
export function routeDefinition<
  InputSchema extends AnySchema,
  SessionMetadataSchema extends AnySchema,
  FileMetadataSchema extends AnySchema,
  PublicMetadataSchema extends AnySchema,
>(
  config: PromiseUploadRouteConfig<
    InputSchema,
    SessionMetadataSchema,
    FileMetadataSchema,
    PublicMetadataSchema
  >,
): UploadRoute<UploadRouteContractFromSchemas<InputSchema, PublicMetadataSchema>, "promise"> {
  return config as unknown as UploadRoute<
    UploadRouteContractFromSchemas<InputSchema, PublicMetadataSchema>,
    "promise"
  >;
}

/** Defines a registry containing only Promise-authored Upload Routes. */
export function uploadRoutes<const Routes extends PromiseUploadRouteRegistry>(
  routes: Routes,
): Routes | InvalidUploadRouteRegistry {
  if (
    typeof routes !== "object" ||
    routes === null ||
    Object.getPrototypeOf(routes) !== Object.prototype
  ) {
    return new InvalidUploadRouteRegistry({ reason: "not-plain-object" });
  }

  const keys = Object.keys(routes);
  const seenKeys = new Set<string>();

  for (const key of keys) {
    if (!uploadRouteKeyPattern.test(key)) {
      return new InvalidUploadRouteRegistry({ reason: "invalid-key", key });
    }
    if (seenKeys.has(key)) {
      return new InvalidUploadRouteRegistry({ reason: "duplicate-key", key });
    }
    seenKeys.add(key);
  }

  return Object.freeze({ ...routes });
}

/** Configures the application handler guarded by the HVN Storage protocol boundary. */
export type StorageHandlerConfig = {
  /** Processes requests that have passed protocol-version validation. */
  readonly handle: (request: Request) => Response | Promise<Response>;
};

/** Creates a standard Request-to-Response handler that validates protocol version before dispatch. */
export function createStorageHandler(config: StorageHandlerConfig) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();

    if (request.headers.get(storageProtocolVersionHeader) !== storageProtocolVersion) {
      const error = new UnsupportedProtocolVersion({
        retry: "never",
        message: "The HVN Storage protocol version is not supported.",
        requestId,
      });
      return Response.json(Schema.encodeSync(UnsupportedProtocolVersionResponse)({ error }), {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "HVN-Storage-Request-Id": requestId,
          [storageProtocolVersionHeader]: storageProtocolVersion,
        },
      });
    }

    const response = await config.handle(request);
    const headers = new Headers(response.headers);
    headers.set("HVN-Storage-Request-Id", requestId);
    headers.set(storageProtocolVersionHeader, storageProtocolVersion);
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  };
}
