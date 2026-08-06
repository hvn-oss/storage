import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    proseWrap: "always",
    ignorePatterns: ["routeTree.gen.ts", ".source"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["routeTree.gen.ts", ".source"],
  },
  run: {
    cache: true,
    tasks: {
      ready: {
        command: ["vp run test", "vp run docs#build"],
      },
      check: "vp check --fix",
      test: {
        command: "vp run check && vp run --filter @hvn-oss/* build && vp test && vp run -r test",
      },
      typecheck: "vp run -r typecheck",
    },
  },
});
