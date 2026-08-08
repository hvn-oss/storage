<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown,
Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend
tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through
`vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for
information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a
`vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do
different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the
project defines a script or task with that name.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation,
      run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include
      its output when asking for help.

<!--VITE PLUS END-->

<!-- effect-solutions:start -->

## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code. Run commands with `vpx`.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling,
error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.

## Local Effect Source

The Effect v4 repository is cloned to `~/.local/share/effect-solutions/effect` for reference. Use
this to explore APIs, find usage examples, and understand implementation details when the
documentation isn't enough.

This repo uses `@effect/tsgo` for TypeScript 7 Effect diagnostics. Run
`effect-tsgo patch --typescript` after installs if the patched TypeScript binary is missing; do not
use the legacy `effect-language-service patch` command here.

<!-- effect-solutions:end -->

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `hvn-oss/storage`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default canonical label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a single-context layout. See `docs/agents/domain.md`.

## Code style

- Prefer `type` declarations. Use `interface` only when declaration merging or extension is
  required.
- Document code with concise JSDoc that explains its public contract or non-obvious behavior.
- Document every field and method in a `type` or `interface` with concise JSDoc.
- Derive canonical schema plain objects from their respective schema with `Schema.encodeSync`.
- For fields in schema classes that need default values, use `Schema.withConstructorDefault`.
- Return recoverable errors; never throw them. Throw or defect only for crash-level failures such as
  bugs and invariant violations.
- Never use the generic `Error` class for recoverable errors; use `Schema.TaggedErrorClass` instead.
- Do not add custom overrides to Effect schema classes for enumerability; the classes already
  support serialization.
