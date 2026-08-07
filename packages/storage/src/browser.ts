import { UnsupportedProtocolVersionError } from "./index.ts";
import { storageProtocolVersion, storageProtocolVersionHeader } from "./internal/protocol.ts";

export { UnsupportedProtocolVersionError };

/** Defines the available Promise-based browser control requests. */
export type StorageClient = {
  /** Recovers the canonical session summary for an authorized route and session. */
  recover(route: string, sessionId: string): Promise<never>;
};

/** Configures a browser control client and its transport. */
export type StorageClientConfig = {
  /** Locates the application handler's HVN Storage base path. */
  readonly baseUrl: string | URL;

  /** Sends control-plane requests; defaults to the global browser fetch implementation. */
  readonly fetch?: typeof globalThis.fetch;
};

/** Creates a Promise-based browser control client for one HVN Storage handler base URL. */
export function createStorageClient(config: StorageClientConfig): StorageClient {
  const fetch = config.fetch ?? globalThis.fetch;
  const baseUrl = new URL(config.baseUrl);

  return {
    async recover(route, sessionId): Promise<never> {
      const response = await fetch(
        new Request(
          new URL(
            `${encodeURIComponent(route)}/sessions/${encodeURIComponent(sessionId)}`,
            baseUrl.href.endsWith("/") ? baseUrl : `${baseUrl.href}/`,
          ),
          { headers: { [storageProtocolVersionHeader]: storageProtocolVersion } },
        ),
      );

      const body: unknown = await response.json();
      if (isUnsupportedProtocolVersion(body)) {
        throw new UnsupportedProtocolVersionError(body.error.message, body.error.requestId);
      }

      throw new Error("The HVN Storage control request failed.");
    },
  };
}

/** Recognizes the complete, frozen v1 protocol-version error envelope. */
function isUnsupportedProtocolVersion(body: unknown): body is {
  /** Holds the public protocol-rejection details. */
  error: {
    /** Identifies this frozen error outcome. */
    _tag: "UnsupportedProtocolVersion";

    /** States that this error cannot be retried safely. */
    retry: "never";

    /** Provides non-contractual public diagnostic text. */
    message: string;

    /** Correlates the public error with its trusted request. */
    requestId: string;
  };
} {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return false;
  }

  const { error } = body;
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    "message" in error &&
    "requestId" in error &&
    error._tag === "UnsupportedProtocolVersion" &&
    "retry" in error &&
    typeof error.message === "string" &&
    typeof error.requestId === "string" &&
    error.retry === "never"
  );
}
