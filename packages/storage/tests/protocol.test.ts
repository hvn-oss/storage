import { expect, test } from "vite-plus/test";
import { createStorageClient, UnsupportedProtocolVersionError } from "../src/browser.ts";
import { createStorageHandler } from "../src/server.ts";

const handler = createStorageHandler({
  basePath: "/storage",
  routes: {},
  runtime: { persistence: {}, storageBindings: {} },
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
});

test("maps a protocol rejection to an enumerable Promise error", async () => {
  const client = createStorageClient({
    baseUrl: "https://example.com/storage",
    fetch: (input) => {
      const request = new Request(input);
      request.headers.delete("HVN-Storage-Version");
      return handler(request);
    },
  });

  await expect(client.recover("example", "session-id")).rejects.toMatchObject({
    _tag: "UnsupportedProtocolVersion",
    retry: "never",
  });

  try {
    await client.recover("example", "session-id");
  } catch (error) {
    expect(error).toBeInstanceOf(UnsupportedProtocolVersionError);
    expect(Object.keys(error as object)).toEqual(
      expect.arrayContaining(["_tag", "retry", "message", "requestId"]),
    );
    expect(JSON.stringify(error)).not.toContain("server-secret");
  }
});
