import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { UnsupportedProtocolVersion } from "./index.ts";
import { recoverControlRequest } from "./internal/browser-control.ts";

export { UnsupportedProtocolVersion };

/** Defines the available Promise-based browser control requests. */
export type StorageClient = {
  /** Sends a recovery request that currently rejects with a protocol or control-request error. */
  recover(route: string, sessionId: string): Promise<never>;
};

/** Configures a browser control client. */
export type StorageClientConfig = {
  /** Locates the application handler's HVN Storage base path. */
  readonly baseUrl: string | URL;
};

/** Creates a Promise-based browser control client for one HVN Storage handler base URL. */
export function createStorageClient(config: StorageClientConfig): StorageClient {
  const baseUrl = new URL(config.baseUrl);

  return {
    recover(route, sessionId): Promise<never> {
      return Effect.runPromise(
        recoverControlRequest(baseUrl, route, sessionId).pipe(
          Effect.provide(FetchHttpClient.layer),
        ),
      );
    },
  };
}
