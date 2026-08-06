import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: { dts: { tsgo: true }, exports: true, target: "es2022" },
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
