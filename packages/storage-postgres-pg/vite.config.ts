import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/migrations.ts"],
    dts: { tsgo: true },
    exports: true,
    target: "es2022",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  fmt: {},
  test: { passWithNoTests: true },
});
