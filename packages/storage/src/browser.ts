import { Effect, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { UnsupportedProtocolVersion } from "./index.ts";
import { storageProtocolVersion, storageProtocolVersionHeader } from "./internal/protocol.ts";

export { UnsupportedProtocolVersion };

/** Validates the HTTP envelope containing the schema-backed protocol error. */
const unsupportedProtocolVersionResponse = Schema.Struct({
  error: UnsupportedProtocolVersion,
});

/** Creates the non-sensitive fallback exposed when a control request cannot be decoded or sent. */
function controlRequestFailed(): Error {
  return new Error("The HVN Storage control request failed.");
}

/** Performs a schema-validated recovery request through the injected Effect HTTP client. */
const recover = Effect.fn("StorageClient.recover")(function* (
  baseUrl: URL,
  route: string,
  sessionId: string,
) {
  const request = HttpClientRequest.get(
    new URL(
      `${encodeURIComponent(route)}/sessions/${encodeURIComponent(sessionId)}`,
      baseUrl.href.endsWith("/") ? baseUrl : `${baseUrl.href}/`,
    ),
  ).pipe(HttpClientRequest.setHeader(storageProtocolVersionHeader, storageProtocolVersion));
  const response = yield* HttpClient.execute(request).pipe(
    Effect.catch(() => Effect.fail(controlRequestFailed())),
  );
  const decodedResponse = yield* HttpClientResponse.schemaBodyJson(
    unsupportedProtocolVersionResponse,
  )(response).pipe(Effect.catch(() => Effect.fail(controlRequestFailed())));

  return yield* decodedResponse.error;
});

/** Defines the available Promise-based browser control requests. */
export type StorageClient = {
  /** Recovers the canonical session summary for an authorized route and session. */
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
        recover(baseUrl, route, sessionId).pipe(Effect.provide(FetchHttpClient.layer)),
      );
    },
  };
}
