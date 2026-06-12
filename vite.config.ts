import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
    tasks: {
      "act:ci:dry": {
        command:
          "act -n pull_request -W .github/workflows/ci.yml -e .github/workflows/pr-opened.json",
      },
      "act:ci": {
        command:
          "act pull_request -W .github/workflows/ci.yml -e .github/workflows/pr-opened.json -P ubuntu-latest=catthehacker/ubuntu:act-latest",
      },

      "act:release:dry": {
        command: "act -n push -W .github/workflows/release.yml",
      },
      "act:release": {
        command:
          "act push -W .github/workflows/release.yml -P ubuntu-latest=catthehacker/ubuntu:act-latest",
      },
    },
  },
});
