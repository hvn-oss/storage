import { storageProtocolVersion, storageProtocolVersionHeader } from "./internal/protocol.ts";

export interface PromiseServerRuntime {
  readonly persistence: unknown;
  readonly storageBindings: Readonly<Record<string, unknown>>;
}

export interface StorageHandlerConfig {
  readonly basePath: string;
  readonly routes: Readonly<Record<string, unknown>>;
  readonly runtime: PromiseServerRuntime;
}

export function createStorageHandler(_config: StorageHandlerConfig) {
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

    return new Response(null, {
      status: 204,
      headers: {
        "HVN-Storage-Request-Id": requestId,
        [storageProtocolVersionHeader]: storageProtocolVersion,
      },
    });
  };
}
