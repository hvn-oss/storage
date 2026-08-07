import { afterAll, expect, test, vi } from "vite-plus/test";
import { createStorageClient, UnsupportedProtocolVersion } from "../src/browser.ts";
import { createStorageHandler } from "../src/server.ts";

let dispatchedRequests = 0;
const handler = createStorageHandler({
  handle: () => {
    dispatchedRequests += 1;
    return new Response(null, { status: 204 });
  },
});

let controlResponse = (_request: Request): Promise<Response> =>
  Promise.reject(new Error("The test control response was not configured."));

vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
  controlResponse(new Request(input, init)),
);

afterAll(() => {
  vi.unstubAllGlobals();
});

test("rejects missing and unsupported protocol versions before processing a request", async () => {
  const missingVersion = await handler(
    new Request("https://example.com/storage/example/sessions", {
      headers: { Authorization: "Bearer server-secret" },
    }),
  );
  const unsupportedVersion = await handler(
    new Request("https://example.com/storage/example/sessions", {
      headers: { "HVN-Storage-Version": "2" },
    }),
  );

  const missingBody = await missingVersion.json();
  const unsupportedBody = await unsupportedVersion.json();

  expect(missingVersion.status).toBe(400);
  expect(missingVersion.headers.get("HVN-Storage-Version")).toBe("1");
  expect(missingVersion.headers.get("Cache-Control")).toBe("no-store");
  expect(missingVersion.headers.get("HVN-Storage-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
  expect(missingBody).toMatchObject({
    error: {
      _tag: "UnsupportedProtocolVersion",
      retry: "never",
      requestId: missingVersion.headers.get("HVN-Storage-Request-Id"),
    },
  });
  expect(JSON.stringify(missingBody)).not.toContain("server-secret");
  expect(unsupportedBody).toMatchObject({
    error: { _tag: "UnsupportedProtocolVersion", retry: "never" },
  });
  expect(unsupportedVersion.headers.get("HVN-Storage-Request-Id")).not.toBe(
    missingVersion.headers.get("HVN-Storage-Request-Id"),
  );
  expect(dispatchedRequests).toBe(0);
});

test("maps a protocol rejection to a typed Promise error", async () => {
  controlResponse = (request) => {
    request.headers.delete("HVN-Storage-Version");
    return handler(request);
  };
  const client = createStorageClient({
    baseUrl: "https://example.com/storage",
  });

  await expect(client.recover("example", "session-id")).rejects.toMatchObject({
    _tag: "UnsupportedProtocolVersion",
    retry: "never",
  });

  try {
    await client.recover("example", "session-id");
  } catch (error) {
    expect(error).toBeInstanceOf(UnsupportedProtocolVersion);
    expect(error).toMatchObject({
      _tag: "UnsupportedProtocolVersion",
      retry: "never",
      message: "The HVN Storage protocol version is not supported.",
    });
    expect(JSON.stringify(error)).not.toContain("server-secret");
  }
});

test("does not treat a non-canonical protocol error as UnsupportedProtocolVersion", async () => {
  controlResponse = async () =>
    Response.json({
      error: {
        _tag: "UnsupportedProtocolVersion",
        retry: "safe",
        message: "The HVN Storage protocol version is not supported.",
        requestId: crypto.randomUUID(),
      },
    });
  const client = createStorageClient({
    baseUrl: "https://example.com/storage",
  });

  await expect(client.recover("example", "session-id")).rejects.not.toBeInstanceOf(
    UnsupportedProtocolVersion,
  );
});
