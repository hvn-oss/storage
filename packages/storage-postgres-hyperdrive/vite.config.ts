import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: { dts: { tsgo: true }, exports: true, target: "es2022" },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: {},
  test: { passWithNoTests: true },
});
