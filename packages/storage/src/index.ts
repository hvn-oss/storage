import { Schema } from "effect";

/** Defines the fields accepted by the schema-backed protocol error constructor. */
type UnsupportedProtocolVersionProps = {
  /** States that this error cannot be retried safely. */
  readonly retry: "never";

  /** Provides non-contractual public diagnostic text. */
  readonly message: string;

  /** Correlates the public error with its trusted request. */
  readonly requestId: string;
};

/** Reports that the server rejected a missing or unsupported HVN Storage protocol version. */
export class UnsupportedProtocolVersion extends Schema.TaggedErrorClass<UnsupportedProtocolVersion>()(
  "UnsupportedProtocolVersion",
  {
    retry: Schema.Literal("never"),
    message: Schema.String,
    requestId: Schema.String,
  },
) {
  constructor(props: UnsupportedProtocolVersionProps) {
    super(props);
    Object.defineProperty(this, "message", { enumerable: true });
  }
}
