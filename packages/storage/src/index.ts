import { Schema } from "effect";

declare const uploadRouteType: unique symbol;

/** Describes the client-visible types associated with one Upload Route. */
export type UploadRouteContract<Input, PublicMetadata> = {
  /** Defines the decoded input accepted when authorizing an Upload Session. */
  readonly Input: Input;
  /** Defines the metadata exposed when issuing a Download Capability. */
  readonly PublicMetadata: PublicMetadata;
};

/** Carries a server-authored Upload Route's contract without exposing its runtime implementation. */
export type UploadRoute<
  Contract extends UploadRouteContract<unknown, unknown>,
  Mode extends "promise" | "effect",
  Requirements = never,
> = {
  readonly [uploadRouteType]: {
    /** Preserves the route's client-visible contract. */
    readonly contract: Contract;
    /** Distinguishes Promise and Effect route registries. */
    readonly mode: Mode;
    /** Preserves Effect service requirements without exposing them to Promise routes. */
    readonly requirements: Requirements;
  };
};

/** Defines a registry of server-authored Upload Routes. */
export type UploadRouteRegistry = Readonly<
  Record<string, UploadRoute<UploadRouteContract<unknown, unknown>, "promise" | "effect", unknown>>
>;

/** Defines a registry containing only Promise-authored Upload Routes. */
export type PromiseUploadRouteRegistry = Readonly<
  Record<string, UploadRoute<UploadRouteContract<unknown, unknown>, "promise", never>>
>;

/** Defines a registry containing only Effect-authored Upload Routes. */
export type EffectUploadRouteRegistry = Readonly<
  Record<string, UploadRoute<UploadRouteContract<unknown, unknown>, "effect", unknown>>
>;

/** Erases server-only Upload Route definitions into the route-keyed client contract. */
export type UploadContract<Routes extends UploadRouteRegistry> = {
  readonly [Key in keyof Routes]: Routes[Key] extends UploadRoute<
    infer Contract,
    "promise" | "effect",
    unknown
  >
    ? Contract
    : never;
};

/** Describes one untrusted file proposed for an Upload Session. */
export type UploadProposal = {
  /** Correlates this request-local proposal with its authorization result. */
  readonly clientId: string;
  /** Provides the caller-supplied filename. */
  readonly name: string;
  /** Provides the caller-supplied expected byte size. */
  readonly size: number;
  /** Provides the caller-supplied media type when available. */
  readonly contentType?: string;
  /** Provides optional caller-supplied SHA-256 evidence. */
  readonly checksum?: {
    /** Identifies the supported checksum algorithm. */
    readonly algorithm: "sha256";
    /** Provides the opaque encoded checksum value. */
    readonly value: string;
  };
};

/** Allows an Upload Route to authorize all proposed files with trusted metadata. */
export type AllowUpload<SessionMetadata, FileMetadata> = {
  /** Identifies this as an allowed upload authorization decision. */
  readonly _tag: "AllowUpload";
  /** Provides trusted metadata for the resulting Upload Session. */
  readonly sessionMetadata: SessionMetadata;
  /** Provides exactly one trusted metadata value for each proposed file. */
  readonly files: ReadonlyArray<{
    /** Correlates this metadata with a proposed file. */
    readonly clientId: string;
    /** Provides trusted metadata for the resulting File Record. */
    readonly metadata: FileMetadata;
  }>;
  /** Narrows the route's static policy for this authorization when present. */
  readonly constraints?: {
    /** Narrows the maximum permitted size for each proposed file. */
    readonly maxFileSize?: number;
    /** Narrows the accepted media types for each proposed file. */
    readonly acceptedContentTypes?: ReadonlyArray<string>;
  };
};

/** Rejects an Upload Session proposal without exposing server-only details. */
export type RejectUpload = {
  /** Identifies this as a rejected upload authorization decision. */
  readonly _tag: "RejectUpload";
  /** Provides an application-defined public rejection code. */
  readonly code: string;
  /** Provides optional non-sensitive public diagnostic text. */
  readonly message?: string;
  /** Identifies per-file public rejections when the route chooses to expose them. */
  readonly files?: ReadonlyArray<{
    /** Correlates this rejection with a proposed file. */
    readonly clientId: string;
    /** Provides an application-defined public rejection code. */
    readonly code: string;
    /** Provides optional non-sensitive public diagnostic text. */
    readonly message?: string;
  }>;
};

/** Defines the expected outcomes of upload authorization. */
export type UploadAuthorization<SessionMetadata, FileMetadata> =
  | AllowUpload<SessionMetadata, FileMetadata>
  | RejectUpload;

/** Names an independently authorized operation on an Upload Session or File Record. */
export type UploadOperation =
  | "readSession"
  | "issueTransfer"
  | "completeFile"
  | "cancelFile"
  | "downloadFile";

/** Describes a trusted File Record supplied to operation authorization. */
export type AuthorizedFile = {
  /** Identifies the File Record. */
  readonly id: string;
  /** Identifies the File Record's Upload Session. */
  readonly sessionId: string;
  /** Provides the original filename. */
  readonly name: string;
  /** Provides the authorized expected byte size. */
  readonly size: number;
  /** Provides the normalized media type when known. */
  readonly contentType?: string;
};

/** Describes a trusted Upload Session supplied to operation authorization. */
export type UploadSession = {
  /** Identifies the Upload Session. */
  readonly id: string;
  /** Identifies the Upload Route that owns the Upload Session. */
  readonly route: string;
  /** Provides the Upload Session's derived lifecycle phase. */
  readonly phase: "active" | "settled";
  /** Provides the immutable session completion deadline. */
  readonly expiresAt: string;
  /** Provides the trusted File Record summaries belonging to this session. */
  readonly files: ReadonlyArray<
    AuthorizedFile & {
      /** Provides this File Record's lifecycle state. */
      readonly state: "authorized" | "ready" | "failed" | "expired";
    }
  >;
};

/** Defines the expected outcomes of operation authorization. */
export type OperationAuthorization<PublicMetadata> = {
  /** Identifies the authorization outcome. */
  readonly _tag: "AllowOperation" | "NotAuthenticated" | "AccessDenied" | "NotFound";
  /** Defines optional public metadata and presentation constraints for an allowed download. */
  readonly download?: {
    /** Narrows the Download Capability lifetime in seconds. */
    readonly lifetimeSeconds?: number;
    /** Selects the browser download presentation. */
    readonly disposition?: "inline" | "attachment";
    /** Overrides the safe presentation filename. */
    readonly filename?: string;
    /** Overrides the verified presentation media type. */
    readonly contentType?: string;
    /** Provides application-defined metadata safe to expose to the client. */
    readonly metadata?: PublicMetadata;
  };
};

/** Provides typed input, proposed files, and decision helpers to upload authorization. */
export type AuthorizationContext<Input, SessionMetadata, FileMetadata> = {
  /** Provides the current Web request for application authentication and authorization. */
  readonly request: Request;
  /** Provides the route-schema-decoded upload input. */
  readonly input: Input;
  /** Provides the complete set of proposed files. */
  readonly files: ReadonlyArray<UploadProposal>;
  /** Creates an allowed upload authorization decision. */
  readonly allow: (
    decision: Omit<AllowUpload<SessionMetadata, FileMetadata>, "_tag">,
  ) => AllowUpload<SessionMetadata, FileMetadata>;
  /** Creates a rejected upload authorization decision. */
  readonly reject: (decision: Omit<RejectUpload, "_tag">) => RejectUpload;
};

/** Provides trusted facts and decision helpers to operation authorization. */
export type OperationContext<SessionMetadata, FileMetadata, PublicMetadata> = {
  /** Provides the current Web request for application authentication and authorization. */
  readonly request: Request;
  /** Identifies the currently requested storage operation. */
  readonly operation: UploadOperation;
  /** Provides trusted facts about the target Upload Session. */
  readonly session: UploadSession;
  /** Provides trusted facts about the target File Record when the operation has one. */
  readonly file?: AuthorizedFile;
  /** Provides trusted session metadata created during upload authorization. */
  readonly sessionMetadata: SessionMetadata;
  /** Provides trusted file metadata created during upload authorization when applicable. */
  readonly fileMetadata?: FileMetadata;
  /** Creates an allowed operation authorization decision. */
  readonly allow: (
    download?: OperationAuthorization<PublicMetadata>["download"],
  ) => OperationAuthorization<PublicMetadata>;
  /** Creates an unauthenticated operation authorization decision. */
  readonly notAuthenticated: () => OperationAuthorization<PublicMetadata>;
  /** Creates an access-denied operation authorization decision. */
  readonly accessDenied: () => OperationAuthorization<PublicMetadata>;
  /** Creates a not-found or concealed operation authorization decision. */
  readonly notFound: () => OperationAuthorization<PublicMetadata>;
};

/** Reports a safe-to-retry failure that HVN Storage cannot expose in detail. */
export class InternalError extends Schema.TaggedErrorClass<InternalError>()("InternalError", {
  retry: Schema.Literal("safe").annotate({
    description: "States that repeating this request cannot duplicate a durable outcome.",
  }),
  message: Schema.String.annotate({
    description: "Provides non-sensitive, non-contractual public diagnostic text.",
  }),
  requestId: Schema.String.annotate({
    description: "Correlates the public error with its trusted request.",
  }),
}) {}

/** Defines the canonical HTTP envelope for an internal error. */
export const InternalErrorResponse = Schema.Struct({
  error: InternalError,
});

/** Reports that the request requires authentication. */
export class NotAuthenticated extends Schema.TaggedErrorClass<NotAuthenticated>()(
  "NotAuthenticated",
  {
    retry: Schema.Literal("after-action").annotate({
      description: "States that the caller must authenticate before retrying.",
    }),
    message: Schema.String.annotate({
      description: "Provides non-sensitive, non-contractual public diagnostic text.",
    }),
    requestId: Schema.String.annotate({
      description: "Correlates the public error with its trusted request.",
    }),
  },
) {}

/** Defines the canonical HTTP envelope for an unauthenticated error. */
export const NotAuthenticatedResponse = Schema.Struct({
  error: NotAuthenticated,
});

/** Reports that the authenticated caller may not perform the requested operation. */
export class AccessDenied extends Schema.TaggedErrorClass<AccessDenied>()("AccessDenied", {
  retry: Schema.Literal("never").annotate({
    description: "States that retrying this request cannot change the access decision.",
  }),
  message: Schema.String.annotate({
    description: "Provides non-sensitive, non-contractual public diagnostic text.",
  }),
  requestId: Schema.String.annotate({
    description: "Correlates the public error with its trusted request.",
  }),
}) {}

/** Defines the canonical HTTP envelope for an access-denied error. */
export const AccessDeniedResponse = Schema.Struct({
  error: AccessDenied,
});

/** Reports that the requested resource is unavailable or deliberately concealed. */
export class NotFound extends Schema.TaggedErrorClass<NotFound>()("NotFound", {
  retry: Schema.Literal("never").annotate({
    description: "States that retrying this request cannot reveal the resource.",
  }),
  message: Schema.String.annotate({
    description: "Provides non-sensitive, non-contractual public diagnostic text.",
  }),
  requestId: Schema.String.annotate({
    description: "Correlates the public error with its trusted request.",
  }),
}) {}

/** Defines the canonical HTTP envelope for a not-found error. */
export const NotFoundResponse = Schema.Struct({
  error: NotFound,
});

/** Reports that application policy rejected the proposed upload. */
export class UploadRejected extends Schema.TaggedErrorClass<UploadRejected>()("UploadRejected", {
  retry: Schema.Literal("after-action").annotate({
    description: "States that the caller must change the proposed upload before retrying.",
  }),
  message: Schema.String.annotate({
    description: "Provides non-sensitive, non-contractual public diagnostic text.",
  }),
  code: Schema.String.annotate({
    description: "Provides an application-defined, public rejection code.",
  }),
  requestId: Schema.String.annotate({
    description: "Correlates the public error with its trusted request.",
  }),
}) {}

/** Defines the canonical HTTP envelope for an upload-rejected error. */
export const UploadRejectedResponse = Schema.Struct({
  error: UploadRejected,
});

/** Reports that the server rejected a missing or unsupported HVN Storage protocol version. */
export class UnsupportedProtocolVersion extends Schema.TaggedErrorClass<UnsupportedProtocolVersion>()(
  "UnsupportedProtocolVersion",
  {
    retry: Schema.Literal("never").annotate({
      description: "States that this error cannot be retried safely.",
    }),
    message: Schema.String.annotate({
      description: "Provides non-contractual public diagnostic text.",
    }),
    requestId: Schema.String.annotate({
      description: "Correlates the public error with its trusted request.",
    }),
  },
) {}

/** Defines the canonical HTTP envelope for an unsupported protocol version error. */
export const UnsupportedProtocolVersionResponse = Schema.Struct({
  error: UnsupportedProtocolVersion,
});
