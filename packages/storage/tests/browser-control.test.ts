import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { recoverControlRequest } from "../src/internal/browser-control.ts";
import { UnsupportedProtocolVersion, UnsupportedProtocolVersionResponse } from "../src/index.ts";

const responseBody = Schema.encodeSync(UnsupportedProtocolVersionResponse)({
  error: new UnsupportedProtocolVersion({
    retry: "never",
    message: "The HVN Storage protocol version is not supported.",
    requestId: "request-id",
  }),
});

const httpClient = HttpClient.make((request) =>
  Effect.succeed(HttpClientResponse.fromWeb(request, Response.json(responseBody, { status: 400 }))),
);

const httpClientLayer = Layer.succeed(HttpClient.HttpClient, httpClient);

describe("recoverControlRequest", () => {
  it.effect("fails with the decoded protocol error", () =>
    recoverControlRequest(new URL("https://example.com/storage"), "example", "session-id").pipe(
      Effect.flip,
      Effect.tap((error) =>
        Effect.sync(() => {
          expect(error).toBeInstanceOf(UnsupportedProtocolVersion);
          expect(error).toMatchObject({
            _tag: "UnsupportedProtocolVersion",
            retry: "never",
            requestId: "request-id",
          });
        }),
      ),
      Effect.provide(httpClientLayer),
    ),
  );
});
