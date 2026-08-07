import { Schema } from "effect";

/** Reports that the server rejected a missing or unsupported HVN Storage protocol version. */
export class UnsupportedProtocolVersion extends Schema.TaggedErrorClass<UnsupportedProtocolVersion>()(
  "UnsupportedProtocolVersion",
  {
    retry: Schema.Literal("never").annotate({
      description: "States that this error cannot be retried safely.",
    }),
    message: Schema.String.annotate({
      description: "Provides non-contractual public diagnostic text.",
    }),
    requestId: Schema.String.annotate({
      description: "Correlates the public error with its trusted request.",
    }),
  },
) {}

/** Defines the canonical HTTP envelope for an unsupported protocol version error. */
export const UnsupportedProtocolVersionResponse = Schema.Struct({
  error: UnsupportedProtocolVersion,
});
