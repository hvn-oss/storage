import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: [
      "src/index.ts",
      "src/browser.ts",
      "src/browser/effect.ts",
      "src/server.ts",
      "src/server/effect.ts",
      "src/s3.ts",
      "src/s3/effect.ts",
      "src/persistence/effect.ts",
    ],
    dts: {
      tsgo: true,
    },
    exports: true,
    target: "es2022",
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
  test: {
    passWithNoTests: true,
  },
});
