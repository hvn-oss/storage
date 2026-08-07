import { storageProtocolVersion, storageProtocolVersionHeader } from "./internal/protocol.ts";

/** Configures the application handler guarded by the HVN Storage protocol boundary. */
export type StorageHandlerConfig = {
  /** Processes requests that have passed protocol-version validation. */
  readonly handle: (request: Request) => Response | Promise<Response>;
};

/** Creates a standard Request-to-Response handler that validates protocol version before dispatch. */
export function createStorageHandler(config: StorageHandlerConfig) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();

    if (request.headers.get(storageProtocolVersionHeader) !== storageProtocolVersion) {
      return Response.json(
        {
          error: {
            _tag: "UnsupportedProtocolVersion",
            retry: "never",
            message: "The HVN Storage protocol version is not supported.",
            requestId,
          },
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
            "HVN-Storage-Request-Id": requestId,
            [storageProtocolVersionHeader]: storageProtocolVersion,
          },
        },
      );
    }

    const response = await config.handle(request);
    const headers = new Headers(response.headers);
    headers.set("HVN-Storage-Request-Id", requestId);
    headers.set(storageProtocolVersionHeader, storageProtocolVersion);
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  };
}
