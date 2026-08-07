export type UploadErrorTag = "UnsupportedProtocolVersion";
export type UploadRetry = "never";

export interface UploadErrorData {
  readonly _tag: UploadErrorTag;
  readonly retry: UploadRetry;
  readonly requestId: string;
}

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
