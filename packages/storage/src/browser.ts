import { Option, Schema } from "effect";
import { UnsupportedProtocolVersion } from "./index.ts";
import { storageProtocolVersion, storageProtocolVersionHeader } from "./internal/protocol.ts";

export { UnsupportedProtocolVersion };

/** Validates the HTTP envelope containing the schema-backed protocol error. */
const unsupportedProtocolVersionResponse = Schema.Struct({
  error: UnsupportedProtocolVersion,
});

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
      const decodedResponse = Schema.decodeUnknownOption(unsupportedProtocolVersionResponse)(body);
      if (Option.isSome(decodedResponse)) {
        throw decodedResponse.value.error;
      }

      throw new Error("The HVN Storage control request failed.");
    },
  };
}
