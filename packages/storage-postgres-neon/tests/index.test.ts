import { expect, test } from "vite-plus/test";

test("imports the root entrypoint", async () => {
  expect(Object.keys(await import("../src/index.ts"))).toEqual([]);
});
