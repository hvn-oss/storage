import { Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { UnsupportedProtocolVersionResponse } from "../index.ts";
import { storageProtocolVersion, storageProtocolVersionHeader } from "./protocol.ts";

const controlRequestFailedMessage = "The HVN Storage control request failed.";

/** Reports that a control request could not be sent or decoded. */
export class ControlRequestFailed extends Schema.TaggedErrorClass<ControlRequestFailed>()(
  "ControlRequestFailed",
  {
    message: Schema.Literal(controlRequestFailedMessage)
      .annotate({
        description: "Provides non-sensitive public diagnostic text.",
      })
      .pipe(Schema.withConstructorDefault(Effect.succeed(controlRequestFailedMessage))),
  },
) {}

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
    Effect.catch(() => Effect.fail(new ControlRequestFailed())),
  );
  const decodedResponse = yield* HttpClientResponse.schemaBodyJson(
    UnsupportedProtocolVersionResponse,
  )(response).pipe(Effect.catch(() => Effect.fail(new ControlRequestFailed())));

  return yield* decodedResponse.error;
});
