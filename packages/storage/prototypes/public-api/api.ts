import type { Effect, Layer, Schema, Scope } from "effect";

export type AnySchema = Schema.Schema<any, any, any>;
export type SchemaType<S extends AnySchema> = S["Type"];
export type Awaitable<A> = A | PromiseLike<A>;

declare const routeType: unique symbol;

export interface ProposedFile {
  readonly clientId: string;
  readonly file: File;
  readonly checksum?: {
    readonly algorithm: "sha256";
    readonly value: string;
  };
}

export interface AuthorizedFile {
  readonly id: string;
  readonly sessionId: string;
  readonly name: string;
  readonly size: number;
  readonly contentType?: string;
}

export interface ReadyFile extends AuthorizedFile {
  readonly state: "ready";
}

export interface UploadSession {
  readonly id: string;
  readonly route: string;
  readonly phase: "active" | "settled";
  readonly expiresAt: string;
  readonly files: ReadonlyArray<
    AuthorizedFile & {
      readonly state: "authorized" | "ready" | "failed" | "expired";
    }
  >;
}

export type UploadRecovery = "safe" | "after-action" | "never";

export interface UploadError extends Error {
  readonly _tag:
    | "InvalidRequest"
    | "UnsupportedProtocolVersion"
    | "NotAuthenticated"
    | "AccessDenied"
    | "NotFound"
    | "IdempotencyConflict"
    | "FileTerminal"
    | "TransferIncomplete"
    | "VerificationMismatch"
    | "UploadRejected"
    | "RateLimited"
    | "TemporarilyUnavailable"
    | "InternalError";
  readonly retry: UploadRecovery;
  readonly requestId: string;
}

export interface UploadRouteContract<Input, PublicMetadata> {
  readonly Input: Input;
  readonly PublicMetadata: PublicMetadata;
}

export interface UploadRoute<
  Contract extends UploadRouteContract<any, any>,
  Mode extends "promise" | "effect",
  Requirements = never,
> {
  readonly [routeType]: {
    readonly contract: Contract;
    readonly mode: Mode;
    readonly requirements: Requirements;
  };
}

export type UploadRouteRegistry = Readonly<Record<string, UploadRoute<any, any, any>>>;
export type PromiseUploadRouteRegistry = Readonly<
  Record<string, UploadRoute<any, "promise", never>>
>;
export type EffectUploadRouteRegistry = Readonly<Record<string, UploadRoute<any, "effect", any>>>;

export type UploadContract<Routes extends UploadRouteRegistry> = {
  readonly [Key in keyof Routes]: Routes[Key] extends UploadRoute<infer Contract, any, any>
    ? Contract
    : never;
};

type RouteInput<Contract, Key extends keyof Contract> =
  Contract[Key] extends UploadRouteContract<infer Input, any> ? Input : never;

type RoutePublicMetadata<Contract, Key extends keyof Contract> =
  Contract[Key] extends UploadRouteContract<any, infer PublicMetadata> ? PublicMetadata : never;

export interface UploadPolicy {
  readonly maxFiles: number;
  readonly maxFileSize: number;
  readonly acceptedContentTypes?: ReadonlyArray<string>;
  readonly sessionLifetimeSeconds: number;
  readonly multipartThreshold: number;
  readonly partSize: number;
  readonly capabilityLifetimeSeconds: number;
  readonly maxCapabilityBatch: number;
  readonly downloadCapabilityLifetimeSeconds?: number;
}

export interface UploadProposal {
  readonly clientId: string;
  readonly name: string;
  readonly size: number;
  readonly contentType?: string;
  readonly checksum?: {
    readonly algorithm: "sha256";
    readonly value: string;
  };
}

export interface AllowUpload<SessionMetadata, FileMetadata> {
  readonly _tag: "AllowUpload";
  readonly sessionMetadata: SessionMetadata;
  readonly files: ReadonlyArray<{
    readonly clientId: string;
    readonly metadata: FileMetadata;
  }>;
  readonly constraints?: {
    readonly maxFileSize?: number;
    readonly acceptedContentTypes?: ReadonlyArray<string>;
  };
}

export interface RejectUpload {
  readonly _tag: "RejectUpload";
  readonly code: string;
  readonly message?: string;
  readonly files?: ReadonlyArray<{
    readonly clientId: string;
    readonly code: string;
    readonly message?: string;
  }>;
}

export type UploadAuthorization<SessionMetadata, FileMetadata> =
  | AllowUpload<SessionMetadata, FileMetadata>
  | RejectUpload;

export type Operation =
  | "readSession"
  | "issueTransfer"
  | "completeFile"
  | "cancelFile"
  | "downloadFile";

export interface OperationAuthorization<PublicMetadata> {
  readonly _tag: "AllowOperation" | "NotAuthenticated" | "AccessDenied" | "NotFound";
  readonly download?: {
    readonly lifetimeSeconds?: number;
    readonly disposition?: "inline" | "attachment";
    readonly filename?: string;
    readonly contentType?: string;
    readonly metadata?: PublicMetadata;
  };
}

export interface AuthorizationContext<Input, SessionMetadata, FileMetadata> {
  readonly request: Request;
  readonly input: Input;
  readonly files: ReadonlyArray<UploadProposal>;
  readonly allow: (
    decision: Omit<AllowUpload<SessionMetadata, FileMetadata>, "_tag">,
  ) => AllowUpload<SessionMetadata, FileMetadata>;
  readonly reject: (decision: Omit<RejectUpload, "_tag">) => RejectUpload;
}

export interface OperationContext<SessionMetadata, FileMetadata, PublicMetadata> {
  readonly request: Request;
  readonly operation: Operation;
  readonly session: UploadSession;
  readonly file?: AuthorizedFile;
  readonly sessionMetadata: SessionMetadata;
  readonly fileMetadata?: FileMetadata;
  readonly allow: (
    download?: OperationAuthorization<PublicMetadata>["download"],
  ) => OperationAuthorization<PublicMetadata>;
  readonly notAuthenticated: () => OperationAuthorization<PublicMetadata>;
  readonly accessDenied: () => OperationAuthorization<PublicMetadata>;
  readonly notFound: () => OperationAuthorization<PublicMetadata>;
}

interface RouteShape<
  InputSchema extends AnySchema,
  SessionMetadataSchema extends AnySchema,
  FileMetadataSchema extends AnySchema,
  PublicMetadataSchema extends AnySchema,
> {
  readonly input: InputSchema;
  readonly sessionMetadata: SessionMetadataSchema;
  readonly fileMetadata: FileMetadataSchema;
  readonly publicMetadata: PublicMetadataSchema;
  readonly storage: string;
  readonly policy: UploadPolicy;
}

export interface PromiseUploadRouteConfig<
  InputSchema extends AnySchema,
  SessionMetadataSchema extends AnySchema,
  FileMetadataSchema extends AnySchema,
  PublicMetadataSchema extends AnySchema,
> extends RouteShape<InputSchema, SessionMetadataSchema, FileMetadataSchema, PublicMetadataSchema> {
  readonly authorizeUpload: (
    context: AuthorizationContext<
      SchemaType<InputSchema>,
      SchemaType<SessionMetadataSchema>,
      SchemaType<FileMetadataSchema>
    >,
  ) => Awaitable<
    UploadAuthorization<SchemaType<SessionMetadataSchema>, SchemaType<FileMetadataSchema>>
  >;
  readonly authorizeOperation: (
    context: OperationContext<
      SchemaType<SessionMetadataSchema>,
      SchemaType<FileMetadataSchema>,
      SchemaType<PublicMetadataSchema>
    >,
  ) => Awaitable<OperationAuthorization<SchemaType<PublicMetadataSchema>>>;
}

export interface EffectUploadRouteConfig<
  InputSchema extends AnySchema,
  SessionMetadataSchema extends AnySchema,
  FileMetadataSchema extends AnySchema,
  PublicMetadataSchema extends AnySchema,
  Requirements,
> extends RouteShape<InputSchema, SessionMetadataSchema, FileMetadataSchema, PublicMetadataSchema> {
  readonly authorizeUpload: (
    context: AuthorizationContext<
      SchemaType<InputSchema>,
      SchemaType<SessionMetadataSchema>,
      SchemaType<FileMetadataSchema>
    >,
  ) => Effect.Effect<
    UploadAuthorization<SchemaType<SessionMetadataSchema>, SchemaType<FileMetadataSchema>>,
    never,
    Requirements
  >;
  readonly authorizeOperation: (
    context: OperationContext<
      SchemaType<SessionMetadataSchema>,
      SchemaType<FileMetadataSchema>,
      SchemaType<PublicMetadataSchema>
    >,
  ) => Effect.Effect<OperationAuthorization<SchemaType<PublicMetadataSchema>>, never, Requirements>;
}

type ContractFromSchemas<
  InputSchema extends AnySchema,
  PublicMetadataSchema extends AnySchema,
> = UploadRouteContract<SchemaType<InputSchema>, SchemaType<PublicMetadataSchema>>;

export declare function defineUploadRoute<
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
): UploadRoute<ContractFromSchemas<InputSchema, PublicMetadataSchema>, "promise">;

export declare function defineEffectUploadRoute<
  InputSchema extends AnySchema,
  SessionMetadataSchema extends AnySchema,
  FileMetadataSchema extends AnySchema,
  PublicMetadataSchema extends AnySchema,
  Requirements,
>(
  config: EffectUploadRouteConfig<
    InputSchema,
    SessionMetadataSchema,
    FileMetadataSchema,
    PublicMetadataSchema,
    Requirements
  >,
): UploadRoute<ContractFromSchemas<InputSchema, PublicMetadataSchema>, "effect", Requirements>;

export declare function defineUploadRoutes<const Routes extends PromiseUploadRouteRegistry>(
  routes: Routes,
): Routes;

export declare function defineEffectUploadRoutes<const Routes extends EffectUploadRouteRegistry>(
  routes: Routes,
): Routes;

export interface PromiseServerRuntime {
  readonly persistence: unknown;
  readonly storageBindings: Readonly<Record<string, unknown>>;
}

export declare function createUploadHandler<Routes extends PromiseUploadRouteRegistry>(config: {
  readonly basePath: string;
  readonly routes: Routes;
  readonly runtime: PromiseServerRuntime;
}): (request: Request) => Promise<Response>;

export interface EffectServerRuntime {
  readonly EffectServerRuntime: unique symbol;
}

type RouteRequirements<Routes extends EffectUploadRouteRegistry> =
  Routes[keyof Routes] extends UploadRoute<any, "effect", infer Requirements>
    ? Requirements
    : never;

export declare function createEffectUploadHandler<
  Routes extends EffectUploadRouteRegistry,
>(config: {
  readonly basePath: string;
  readonly routes: Routes;
}): (
  request: Request,
) => Effect.Effect<Response, never, EffectServerRuntime | RouteRequirements<Routes>>;

export interface FileProgress {
  readonly fileId: string;
  readonly phase:
    | "queued"
    | "transferring"
    | "paused"
    | "completing"
    | "ready"
    | "failed"
    | "expired";
  readonly bytesSent: number;
  readonly bytesTotal: number;
}

export interface UploadProgress {
  readonly bytesSent: number;
  readonly bytesTotal: number;
  readonly activeRequests: number;
  readonly files: ReadonlyArray<FileProgress>;
}

export type FileOutcome =
  | { readonly _tag: "Ready"; readonly file: ReadyFile }
  | { readonly _tag: "Failed"; readonly file: AuthorizedFile; readonly reason: string }
  | { readonly _tag: "Expired"; readonly file: AuthorizedFile }
  | { readonly _tag: "Paused"; readonly file: AuthorizedFile; readonly error: UploadError };

export interface UploadResult {
  readonly session: UploadSession;
  readonly files: ReadonlyArray<FileOutcome>;
}

export interface FileTransferHandle {
  readonly clientId: string;
  readonly fileId: string | undefined;
  readonly progress: FileProgress;
  readonly pause: () => void;
  readonly continue: () => void;
  readonly cancel: () => Promise<FileOutcome>;
}

export interface UploadOptions<Input> {
  readonly input: Input;
  readonly files: ReadonlyArray<ProposedFile>;
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: UploadProgress) => void;
  readonly onFileReady?: (file: ReadyFile) => void;
  readonly onSettled?: (result: UploadResult) => void;
}

export interface DownloadResponse<PublicMetadata> {
  readonly file: ReadyFile;
  readonly download: {
    readonly method: "GET";
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly expiresAt: string;
  };
  readonly metadata?: PublicMetadata;
}

export interface PromiseUploadHandle {
  readonly state: "authorizing" | "running" | "paused" | "settled" | "disposed";
  readonly progress: UploadProgress;
  readonly files: ReadonlyArray<FileTransferHandle>;
  readonly result: Promise<UploadResult>;
  readonly pause: () => void;
  readonly continue: () => void;
  readonly cancel: (fileId: string) => Promise<FileOutcome>;
  readonly subscribe: (listener: (progress: UploadProgress) => void) => () => void;
  readonly dispose: () => void;
}

export interface PromiseUploadClient<
  Contract extends Record<string, UploadRouteContract<any, any>>,
> {
  readonly upload: <Key extends keyof Contract>(
    route: Key,
    options: UploadOptions<RouteInput<Contract, Key>>,
  ) => PromiseUploadHandle;
  readonly recover: <Key extends keyof Contract>(
    route: Key,
    sessionId: string,
  ) => Promise<UploadSession>;
  readonly download: <Key extends keyof Contract>(
    route: Key,
    fileId: string,
  ) => Promise<DownloadResponse<RoutePublicMetadata<Contract, Key>>>;
}

export declare function createUploadClient<
  Contract extends Record<string, UploadRouteContract<any, any>>,
>(config: {
  readonly baseUrl: string | URL;
  readonly fetch?: typeof globalThis.fetch;
}): PromiseUploadClient<Contract>;

export interface EffectFileTransferHandle {
  readonly clientId: string;
  readonly fileId: string | undefined;
  readonly progress: Effect.Effect<FileProgress>;
  readonly pause: Effect.Effect<void>;
  readonly continue: Effect.Effect<void>;
  readonly cancel: Effect.Effect<FileOutcome, UploadError>;
}

export interface EffectUploadHandle {
  readonly state: Effect.Effect<"authorizing" | "running" | "paused" | "settled">;
  readonly progress: Effect.Effect<UploadProgress>;
  readonly files: ReadonlyArray<EffectFileTransferHandle>;
  readonly result: Effect.Effect<UploadResult, UploadError>;
  readonly pause: Effect.Effect<void>;
  readonly continue: Effect.Effect<void>;
  readonly cancel: (fileId: string) => Effect.Effect<FileOutcome, UploadError>;
}

export interface EffectUploadClient<
  Contract extends Record<string, UploadRouteContract<any, any>>,
> {
  readonly upload: <Key extends keyof Contract>(
    route: Key,
    options: UploadOptions<RouteInput<Contract, Key>>,
  ) => Effect.Effect<EffectUploadHandle, never, Scope.Scope>;
  readonly recover: <Key extends keyof Contract>(
    route: Key,
    sessionId: string,
  ) => Effect.Effect<UploadSession, UploadError>;
  readonly download: <Key extends keyof Contract>(
    route: Key,
    fileId: string,
  ) => Effect.Effect<DownloadResponse<RoutePublicMetadata<Contract, Key>>, UploadError>;
}

export declare function createEffectUploadClient<
  Contract extends Record<string, UploadRouteContract<any, any>>,
>(config: { readonly baseUrl: string | URL }): EffectUploadClient<Contract>;

export interface UploadController<Input> {
  readonly state: "idle" | "running" | "paused" | "settled";
  readonly progress: UploadProgress | undefined;
  readonly result: UploadResult | undefined;
  readonly upload: (options: UploadOptions<Input>) => Promise<UploadResult>;
  readonly pause: () => void;
  readonly continue: () => Promise<UploadResult>;
  readonly cancel: (fileId: string) => Promise<FileOutcome>;
  readonly dispose: () => void;
}

export declare function createReactUploadHooks<
  Contract extends Record<string, UploadRouteContract<any, any>>,
>(config: {
  readonly baseUrl: string | URL;
}): {
  readonly useStorage: <Key extends keyof Contract>(
    route: Key,
  ) => UploadController<RouteInput<Contract, Key>>;
};

export declare const effectServerLayer: Layer.Layer<EffectServerRuntime>;
