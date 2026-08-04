# Portable Postgres adapter options

Research date: 2026-08-04

Wayfinding ticket: [hvn-oss/storage#3](https://github.com/hvn-oss/storage/issues/3)

## Executive conclusion

There is no honest single-capability Postgres adapter across current Node LTS and edge runtimes. The
portable unit is parameterized PostgreSQL statements and result rows, not connection or transaction
behavior.

A defensible v1 matrix is:

| Adapter profile       | Supported deployment                                                        | Honest transaction guarantee                                                                       | Connection model                                                                    | Coupling                                                                                     |
| --------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Direct Node           | Node.js 24 LTS (and 22 LTS) with `pg`                                       | Interactive transaction on one checked-out client; savepoints are SQL                              | Process-local bounded pool of TCP/TLS connections                                   | PostgreSQL protocol and `pg`; no database vendor                                             |
| Cloudflare Hyperdrive | Cloudflare Workers with `pg` and `nodejs_compat`                            | Interactive transaction within one invocation; transaction pins one origin connection              | New request-scoped client; Cloudflare owns the origin pool                          | Cloudflare runtime binding/service, but works with arbitrary public PostgreSQL origins       |
| Neon HTTP             | Fetch-capable edge runtimes, including Cloudflare Workers and Vercel Edge   | One statement or one predeclared, non-interactive atomic batch; no session or callback transaction | One HTTP request per query or batch; no client pool/session                         | Neon HTTP SQL endpoint and service                                                           |
| Neon WebSocket        | Edge runtimes with WebSockets, including Cloudflare Workers and Vercel Edge | Interactive transaction/session within one request only                                            | Request-scoped `Client`/`Pool`; it must be closed before or just after the response | Neon WebSocket proxy, or a self-hosted proxy with additional operational and TLS constraints |

The Direct Node profile should be the semantic baseline. Cloudflare Hyperdrive is viable when its
query cache is disabled for storage operations requiring fresh reads. Neon HTTP is viable only as a
separate batch-transaction profile, not as a drop-in implementation of an interactive transaction
API. Neon WebSocket is technically viable but adds request-lifetime and proxy coupling, so it should
be optional rather than the minimum edge guarantee.

Vercel itself now recommends moving Edge functions to Node.js for reliability and performance, and
Next.js 16.3 no longer supports `runtime = "edge"` for routes and pages. Vercel's current default
Node runtime is Node.js 24. Therefore, the current-equivalent Vercel baseline should be Direct Node;
the Neon profiles remain relevant where a framework-independent Vercel Edge function is actually
required. [Vercel Edge runtime](https://vercel.com/docs/functions/runtimes/edge),
[Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## Scope and source standard

This report considers maintained JavaScript clients and first-party service integrations that issue
PostgreSQL SQL. It excludes REST object APIs such as PostgREST/Supabase from the adapter matrix:
those APIs can be useful products, but they do not expose a general parameterized PostgreSQL
statement contract.

Only first-party runtime documentation, product documentation, and package documentation/source are
used. Current Node LTS means Node.js 24, with Node.js 22 still in LTS on the research date.
[Node.js release status](https://nodejs.org/en/about/previous-releases)

## Maintained client baseline

### `pg` / node-postgres

`pg` is the least-coupled direct baseline. Its current package manifest is version 8.22.0, declares
Node `>=16`, and is MIT licensed; current Node 24 and 22 are therefore inside its declared engine
range. It connects by PostgreSQL connection URI or ordinary host/user/database settings and ships a
lazy, bounded pool (default maximum 10).
[package manifest](https://github.com/brianc/node-postgres/blob/master/packages/pg/package.json),
[connection docs](https://node-postgres.com/features/connecting),
[pool API](https://node-postgres.com/apis/pool),
[license](https://github.com/brianc/node-postgres/blob/master/LICENSE)

Its relevant semantics are explicit:

- `client.query(text, values)` sends `$1`, `$2`, and later values separately to PostgreSQL. Named
  prepared statements are cached per physical connection.
  [Query docs](https://node-postgres.com/features/queries)
- A transaction is manual `BEGIN`/`COMMIT`/`ROLLBACK`, and every statement must use the same client;
  `pool.query` cannot implement a multi-statement transaction.
  [Transaction docs](https://node-postgres.com/features/transactions)
- A checked-out client must be released. Pool exhaustion otherwise causes later acquisition to wait
  or time out. Pool sizing is application-owned.
  [Pooling docs](https://node-postgres.com/features/pooling)

`pg` deliberately stays low-level and has no migration subsystem. That is useful for the runtime
adapter boundary: migrations should not be inferred from query support.

### Postgres.js

Postgres.js is also maintained and portable enough to remain a credible alternative. Its current
manifest is version 3.4.9, declares Node `>=12`, exports a `workerd` build, and uses the Unlicense.
Its tagged templates convert values to PostgreSQL placeholders and send values separately. It has a
lazy pool (default maximum 10), callback transactions that reserve a connection, savepoints, and
built-in Cloudflare Workers socket support. It explicitly says that it does not include migrations.
[package manifest](https://github.com/porsager/postgres/blob/master/package.json),
[package documentation](https://github.com/porsager/postgres/blob/master/README.md),
[license](https://github.com/porsager/postgres/blob/master/UNLICENSE)

Postgres.js does not improve the minimum v1 matrix enough to justify two direct adapters initially:
its SQL-tag interface differs from the conventional `text + values` shape, while `pg` is also
Cloudflare's recommended Hyperdrive driver. It is a valid later adapter or a substitute if HVN
chooses tagged SQL as its native interface.
[Cloudflare supported drivers](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/#supported-drivers)

## Edge integrations

### Cloudflare Workers: direct TCP and Hyperdrive

Workers exposes outbound TCP sockets, including the PostgreSQL wire protocol and StartTLS. Sockets
must be created inside a handler, cannot be shared across requests, and count against the runtime's
simultaneous outgoing-connection limit. Workers currently permits six connections waiting for
response headers/handshake per invocation. The runtime provides only a subset of Node APIs unless
`nodejs_compat` is enabled.
[Workers TCP sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/#simultaneous-open-connections),
[Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)

Direct TCP with supported `pg` or Postgres.js versions is viable, but it repeats TCP, TLS, and
database authentication for each invocation and provides no cross-request pool. Cloudflare
recommends Hyperdrive for PostgreSQL instead.
[Cloudflare database connections](https://developers.cloudflare.com/workers/databases/connecting-to-databases/)

Hyperdrive accepts the normal driver protocol at the edge and maintains origin-side connection pools
close to the database. Cloudflare recommends `pg`, requires `nodejs_compat`, and instructs Workers
to create a new `Client` inside each handler rather than a global client or driver pool. Supported
origins include arbitrary PostgreSQL and PostgreSQL-compatible databases, so changing the database
host need not change application SQL.
[Hyperdrive overview](https://developers.cloudflare.com/hyperdrive/),
[PostgreSQL driver setup](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/),
[connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/)

Important constraints for an HVN adapter are:

- Hyperdrive pools in transaction mode. One origin connection is pinned for a transaction and
  returned afterward; long transactions reduce multiplexing and can exhaust the pool. Named
  protocol-level prepared statements from `pg` and Postgres.js are supported.
  [How Hyperdrive works](https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/#pooling-mode)
- Query caching is enabled by default, does not invalidate cached reads after writes, and can serve
  stale results. A correctness-oriented storage adapter must require a cache-disabled Hyperdrive
  configuration rather than attempt to classify freshness in application code.
  [Query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)
- Hyperdrive currently limits statements to 60 seconds and approximately 20 origin connections per
  free configuration or 100 per paid configuration. Those are deployment limits, not portable
  adapter guarantees.
  [Hyperdrive limits](https://developers.cloudflare.com/hyperdrive/platform/limits/)
- The origin must be publicly addressable and TLS-enabled; private IP origins are not supported.
  [Hyperdrive troubleshooting](https://developers.cloudflare.com/hyperdrive/observability/troubleshooting/#configuration-errors)

The `pg` code and SQL remain open and portable, but the binding, edge handshake, managed pool, and
limits are Cloudflare services. This is runtime/vendor coupling rather than database coupling.

### Neon HTTP

`@neondatabase/serverless` is an MIT-licensed, maintained driver whose current manifest is version
1.0.2 and requires Node `>=19`. It uses HTTPS or WebSockets instead of TCP and is documented for
both Cloudflare Workers and Vercel Edge. Its HTTP `neon()` API supports safe tagged parameters and
explicit `query(text, values)` placeholders.
[package manifest](https://github.com/neondatabase/serverless/blob/main/package.json),
[license](https://github.com/neondatabase/serverless/blob/main/LICENSE),
[driver docs](https://neon.com/docs/serverless/serverless-driver)

HTTP has intentionally narrower semantics. A normal call carries one query and has no session or
interactive transaction. `sql.transaction([...])` sends a fixed query list in one HTTP request and
executes it atomically, with isolation/read-only/deferrable options; later statements cannot depend
on application logic that observes an earlier result. Request and response payloads are limited to
64 MB.
[HTTP and transaction configuration](https://github.com/neondatabase/serverless/blob/main/CONFIG.md#transaction-function)

This is the best low-overhead edge option only when HVN can express each atomic operation as one SQL
statement or a predeclared batch. Calling that an unrestricted `transaction(callback)` would be
false.

The open-source license does not remove service coupling. The default HTTP endpoint is the database
host's `/sql` endpoint, a Neon facility. The package documents self-hosting a WebSocket proxy for a
non-Neon database, but not a production-ready generic HTTP SQL proxy.
[advanced endpoint configuration](https://github.com/neondatabase/serverless/blob/main/CONFIG.md#advanced-configuration),
[self-hosted WebSocket proxy](https://github.com/neondatabase/serverless/blob/main/DEPLOY.md)

### Neon WebSocket

The same package exposes node-postgres-compatible `Client` and `Pool` APIs over WebSockets. They
support sessions and interactive transactions, restoring the same-client behavior needed by the
direct baseline. On Cloudflare Workers and Vercel Edge, however, a WebSocket cannot outlive one
request: clients must be created, used, and closed within the handler. A `Pool` in that setting does
not provide a reusable cross-request pool.
[serverless driver `Pool` and `Client`](https://github.com/neondatabase/serverless#pool-and-client)

For non-Neon databases, the project documents a self-hosted Go WebSocket proxy. Its recommended TLS
shape terminates WebSocket TLS at nginx and expects onward PostgreSQL traffic to remain local or on
a private network; its end-to-end pure-JS TLS alternative is explicitly experimental and not
recommended for production. Consequently, "works with any Postgres" is operationally possible but
not an honest turnkey v1 guarantee.
[proxy deployment constraints](https://github.com/neondatabase/serverless/blob/main/DEPLOY.md)

### Vercel runtime direction

Vercel Edge exposes `fetch` and a restricted Web API/Node subset, disallows most Node-dependent
packages, and does not expose a generic TCP socket API. Its documented function limit requires a
response to begin within 25 seconds. Those constraints fit Neon HTTP/WebSocket, not ordinary `pg`
TCP. [Edge APIs and restrictions](https://vercel.com/docs/functions/runtimes/edge),
[function limits](https://vercel.com/docs/functions/limitations#edge-runtime)

More importantly, Vercel now recommends Node.js instead of Edge. The Node runtime has complete Node
API coverage and defaults to Node 24, making the direct `pg` baseline the preferred current
equivalent. Vercel no longer operates a first-party "Vercel Postgres"; Postgres products are
third-party Marketplace integrations, and existing Vercel Postgres databases were moved to Neon.
[Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js),
[Postgres on Vercel](https://vercel.com/docs/postgres)

## Migrations

Migrations should be a separate control-plane capability, not a method on every runtime adapter.

- Neither `pg` nor Postgres.js supplies migration ordering, locking, history, or rollback policy;
  Postgres.js states this explicitly.
  [Postgres.js migration note](https://github.com/porsager/postgres/blob/master/README.md#migration-tools)
- Edge request lifetimes, request-scoped connections, Hyperdrive's 60-second statement limit, and
  HTTP's non-interactive transaction model make edge execution a needlessly narrow migration
  environment.
- Transaction poolers can break migration tools that depend on session state. Neon specifically
  directs schema migrations to a direct, non-pooled connection.
  [Neon pooled versus direct connections](https://neon.com/docs/connect/connection-pooling#when-to-use-pooled-vs-direct-connections)

V1 should run one chosen migration tool in CI, deployment, or an operator command on current Node
LTS, using a direct database endpoint and a dedicated migration role. Runtime adapters should only
assume that the required schema version already exists and report a clear incompatibility when it
does not.

## Honest v1 guarantees

### Common guarantee across all profiles

V1 can guarantee only:

- PostgreSQL SQL execution with values transmitted separately from statement text.
- A stable row/result mapping for the PostgreSQL types HVN explicitly supports.
- One atomic SQL statement.
- Explicit capability discovery for transaction mode and runtime limits.
- No reliance on session state between independent adapter calls.

V1 should not claim portable support for session `SET`, temporary tables, `LISTEN/NOTIFY`, advisory
locks, cursors, `COPY`, arbitrary prepared-statement lifetime, long-running statements, or
cross-request transactions. Direct clients may support many of these, but transaction poolers, HTTP,
and request-scoped edge connections do not share them.

### Capability flags, not emulation

The adapter contract should distinguish at least:

| Capability               | Direct Node                       | Hyperdrive                        | Neon HTTP                  | Neon WebSocket                    |
| ------------------------ | --------------------------------- | --------------------------------- | -------------------------- | --------------------------------- |
| `parameterizedSql`       | Yes                               | Yes                               | Yes                        | Yes                               |
| `atomicBatch`            | Yes                               | Yes                               | Yes                        | Yes                               |
| `interactiveTransaction` | Yes                               | Yes, one invocation               | No                         | Yes, one request                  |
| `sessionWithinRequest`   | Yes                               | Transaction-scoped                | No                         | Yes                               |
| `crossRequestSession`    | Process-dependent, not guaranteed | No                                | No                         | No                                |
| `managedOriginPool`      | No                                | Yes                               | Service-side HTTP handling | Service/database pooler dependent |
| `portableDatabaseHost`   | Yes                               | Yes, subject to public TLS origin | No by default              | Only with a self-hosted proxy     |

`atomicBatch` must accept a complete list before execution. `interactiveTransaction` may accept a
callback and expose results between statements. The HTTP adapter must reject the latter rather than
silently run statements as separate transactions.

### Recommended initial support level

1. Ship and test Direct Node with `pg` as the normative adapter.
2. Ship Cloudflare Hyperdrive with `pg` only if deployments require a cache-disabled binding and
   tests cover transaction pinning, rollback, and request-local client lifecycle.
3. Ship Neon HTTP only after HVN's storage operations are proven expressible as single statements or
   predeclared atomic batches; mark `interactiveTransaction` unsupported.
4. Treat Neon WebSocket and direct Workers TCP as compatible integration paths, not baseline v1
   guarantees, until runtime-specific integration tests justify support.
5. Run migrations once through Direct Node and a direct endpoint, independently of runtime adapters.

## Decision questions surfaced

1. Can every HVN write invariant be implemented as one PostgreSQL statement or a predeclared batch,
   or does any operation require application-dependent branching inside a transaction?
2. Is Cloudflare a required v1 deployment target, and if so, can HVN require a cache-disabled
   Hyperdrive binding and a public TLS-reachable origin?
3. Is legacy/framework-independent Vercel Edge a real target despite Vercel's Node recommendation,
   or should Vercel support mean the current Node 24 runtime?
4. Is provider-neutral database hosting a v1 requirement for every adapter, or is Neon coupling
   acceptable for the HTTP profile?
5. Which PostgreSQL types and result coercions belong to the portable contract? The clients differ
   on values such as `int8`, `numeric`, dates, and arrays, so "parameterized SQL" alone does not
   make result behavior portable.
6. Which migration tool and schema-locking policy will own upgrades, and how will runtime adapters
   verify schema compatibility without attempting migrations themselves?

## Map gist

Use `pg` on Node as the normative direct adapter; expose edge transaction capabilities explicitly,
with cache-disabled Hyperdrive for Cloudflare and Neon HTTP limited to one-shot/predeclared atomic
batches, while keeping migrations on a direct Node control plane.
