/** Identifies a stable public HVN Storage error outcome. */
export type UploadErrorTag = "UnsupportedProtocolVersion";

/** Describes whether callers can retry a public HVN Storage error. */
export type UploadRetry = "never";

/** Contains the enumerable data shared by a public Promise error and its HTTP representation. */
export type UploadErrorData = {
  /** Identifies the stable public error outcome. */
  readonly _tag: UploadErrorTag;

  /** States whether replaying the failed request is appropriate. */
  readonly retry: UploadRetry;

  /** Correlates the error with its trusted server-side control request. */
  readonly requestId: string;
};

/** Reports that the server rejected a missing or unsupported HVN Storage protocol version. */
export class UnsupportedProtocolVersionError extends Error implements UploadErrorData {
  readonly _tag = "UnsupportedProtocolVersion";
  readonly retry = "never";
  readonly requestId: string;

  constructor(message: string, requestId: string) {
    super(message);
    this.name = "UnsupportedProtocolVersionError";
    Object.defineProperty(this, "message", { enumerable: true });
    this.requestId = requestId;
  }
}
