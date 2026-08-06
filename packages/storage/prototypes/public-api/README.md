# Public API prototype

> PROTOTYPE: throwaway planning artifact for
> [Prototype the public API and end-to-end type flow](https://github.com/hvn-oss/storage/issues/5).
> This is not an implementation and must not be merged into `main`.

## Question

Can a server-owned Upload Route registry provide end-to-end inference to Promise, Effect, vanilla
browser, and React consumers without making server code reachable from a browser bundle?

## Proposed answer

- The server owns each Upload Route's policy, schemas, storage binding, and authorization hooks.
- It exports an erased `UploadContract<typeof uploadRoutes>` type containing only route keys, route
  input, and public download metadata.
- Browser modules use `import type` for that contract. Their only runtime import is a browser or
  React entry point.
- Promise and Effect builders produce the same client contract through separate registries. Promise
  APIs hide Effect types; Effect APIs retain typed errors, requirements, interruption, scopes, and
  layers.
- Expected authorization denials are callback return values. Throws, rejected Promises, typed Effect
  failures, and defects are internal failures at the protocol boundary.
- Client lifecycle hooks observe local work. They are not durable server hooks.
- A Promise upload starts immediately and returns a live handle synchronously. The corresponding
  Effect operation acquires a scoped handle so interruption and disposal remain explicit.
- React's `useStorage(route)` returns an imperative, route-bound controller without coupling the
  package to a query or form library. One hook instance owns at most one active Upload Session.
- Names reflect capability breadth: clients, handlers, React factories, and controllers use
  `Storage`; Upload Routes, upload operations, transfer handles, and upload results retain `Upload`.
- Authorization callback contexts provide typed decision helpers, keeping `_tag` construction and
  output-shape validation out of application code.

The files are intentionally compile-only. `api.ts` stands in for proposed package entry points, and
the example files show the consumer-visible shape and inference.

## Run

From the repository root:

```sh
vp exec --filter @hvn-oss/storage -- tsc --noEmit -p prototypes/public-api/tsconfig.json
```

## Questions this should provoke

1. Should route input be inferred from a server-only schema, or is a browser-safe shared contract
   worth the extra module and split implementation ceremony?
2. Should route-specific public metadata be returned only by download authorization, or do any other
   client operations need an application projection?
3. Does a single route-level `useStorage` controller leave enough room for applications to compose
   multi-route upload experiences themselves?
