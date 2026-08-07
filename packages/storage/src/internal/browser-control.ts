import { Effect } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { UnsupportedProtocolVersionResponse } from "../index.ts";
import { storageProtocolVersion, storageProtocolVersionHeader } from "./protocol.ts";

/** Creates the non-sensitive fallback exposed when a control request cannot be decoded or sent. */
function controlRequestFailed(): Error {
  return new Error("The HVN Storage control request failed.");
}

/** Performs a schema-validated recovery request through the injected Effect HTTP client. */
export const recoverControlRequest = Effect.fn("StorageClient.recover")(function* (
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
    UnsupportedProtocolVersionResponse,
  )(response).pipe(Effect.catch(() => Effect.fail(controlRequestFailed())));

  return yield* decodedResponse.error;
});
