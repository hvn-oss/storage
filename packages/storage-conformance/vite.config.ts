import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/storage/v1.ts", "src/persistence/v1.ts"],
    dts: { tsgo: true },
    exports: true,
    target: "es2022",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: {},
  run: {
    tasks: {
      build: "vp pack",
      test: "vp test",
      typecheck: "vp check --no-fmt --no-lint",
      check: "vp check",
    },
  },
  test: { passWithNoTests: true },
});
