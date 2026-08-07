import { UnsupportedProtocolVersionError } from "./index.ts";
import { storageProtocolVersion, storageProtocolVersionHeader } from "./internal/protocol.ts";

export { UnsupportedProtocolVersionError };

export interface StorageClient {
  recover(route: string, sessionId: string): Promise<never>;
}

export interface StorageClientConfig {
  readonly baseUrl: string | URL;
  readonly fetch?: typeof globalThis.fetch;
}

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

function isUnsupportedProtocolVersion(
  body: unknown,
): body is { error: { _tag: "UnsupportedProtocolVersion"; message: string; requestId: string } } {
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
    typeof error.message === "string" &&
    typeof error.requestId === "string"
  );
}
