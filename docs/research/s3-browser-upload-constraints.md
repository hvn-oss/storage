# S3-Compatible Browser Upload Constraints

Research for [issue #2](https://github.com/hvn-oss/storage/issues/2), 2026-08-04.

## Executive conclusion

A browser-direct v1 can use one portable data plane across AWS S3 general-purpose buckets and
DigitalOcean Spaces:

- single-request `PutObject` for objects no larger than 5 GB;
- multipart uploads with 5 MiB to 5 GiB parts, except that the final part has no minimum, no more
  than 10,000 parts, and no more than 5 TB total;
- one short-lived SigV4 presigned URL per `PutObject` or `UploadPart` request;
- browser capture of every successful part's opaque `ETag`; and
- trusted-server initiation, completion, abort, and post-completion `HeadObject` verification.

The last point is an architecture recommendation, not a protocol limitation. Both providers expose
the multipart control operations and they can be SigV4-presigned. Keeping them on the trusted side
shrinks the browser's authority, prevents an untrusted client from choosing final metadata or the
completion manifest, centralizes cleanup, and avoids making XML control responses part of the public
browser protocol.

The hard common integrity guarantee should be **provider acceptance plus final size and immutable
application metadata verification**, not "the ETag is the file MD5" and not AWS's modern checksum
API. `Content-MD5` and the overlapping CRC32/CRC32C/SHA1/SHA256 headers can be optional adapter
capabilities, but multipart ETags are not whole-object digests and the providers do not document an
identical final checksum contract.

## Scope and confidence rule

This report covers AWS S3 general-purpose buckets and DigitalOcean Spaces Standard Storage. AWS S3
directory buckets and DigitalOcean Spaces Cold Storage have materially different API/CORS
capabilities and are outside the portable v1 profile. DigitalOcean describes Spaces as providing
"partial support" for S3 features and says unsupported operations return `NotImplemented`; this
report therefore treats behavior absent from DigitalOcean's own API/compatibility documentation as
provider-specific or unknown, even when AWS supports it.[^do-compat]

Only first-party API documentation, SDK source, and the WHATWG Fetch standard are used.

## Hard common-denominator contract

| Concern                  | Portable guarantee                                                                                                        | Do not assume portably                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Single upload            | `PUT` object, success is `200`, object limit 5 GB                                                                         | Conditional create, version ID, AWS KMS, AWS Object Lock                                                   |
| Multipart lifecycle      | Create, upload part, complete, abort, list parts/uploads are documented by both                                           | Provider-identical lifecycle retention or abort races                                                      |
| Multipart dimensions     | Part numbers 1-10,000; parts 5 MiB-5 GiB; final part may be smaller; 10,000 parts; total no more than 5 TB                | AWS's current larger maximum object size                                                                   |
| Presigning               | SigV4 query presigning is supported; URL is a bearer capability for one method/path/query/header shape                    | A provider-neutral maximum lifetime or revocation policy                                                   |
| Browser request body     | Raw `Blob`/file slice can be the `PUT` body; browser owns `Host` and `Content-Length`                                     | Setting `Host`, `Content-Length`, `Date`, or `Origin` in JavaScript                                        |
| Part completion data     | Store the exact `ETag` returned for every `(uploadId, partNumber)` and submit it with the ordered completion manifest     | Reconstructing an ETag later or treating it as a digest                                                    |
| Integrity                | Both document `Content-MD5` and overlapping explicit checksum request headers; AWS explicitly validates `Content-MD5`     | Identical validation/defaults, final multipart checksum semantics, or checksum retrieval on every object   |
| Post-upload verification | Trusted side can `HEAD` and compare `Content-Length`, content type, ETag, and application metadata                        | DigitalOcean's consistency model being identical to AWS's strong consistency                               |
| CORS                     | Bucket rule can allow `PUT`, `POST`, `DELETE`, `HEAD` and request headers; response headers can be exposed                | CORS granting storage authorization, or `ETag` being readable without exposure                             |
| Retry                    | A part retry to the same upload ID and part number replaces that part; failed parts do not require restarting other parts | Blindly retrying create, treating every complete `200` as success, or assuming one abort frees raced parts |

Sources for dimensions and operations: AWS's single-operation limit is 5 GB, while its current
multipart documentation allows up to 50 TB (48.8 TiB in the limits table).[^aws-upload][^aws-limits]
Spaces documents 5 GB single PUTs, 5 MiB-5 GiB parts, 10,000 parts, and a 5 TB total.[^do-limits]
The lower 5 TB total is therefore the portable ceiling.

## Operation semantics

### Single `PutObject`

`PutObject` is atomic at the object level on AWS: S3 never creates a partial object, and success
means the entire object was added.[^aws-put] Spaces documents `PutObject`, requires `Content-Length`
when a body is present, and returns `200` with an `ETag`.[^do-api]

The browser cannot explicitly set `Content-Length`; Fetch defines it, along with `Host`, `Date`, and
`Origin`, as a forbidden request header controlled by the user agent.[^fetch-headers] This is
compatible with Spaces' requirement because a `Blob` has a known length and the browser emits the
transport header. A signer must not require JavaScript to reproduce the value.

A single PUT to an existing key overwrites it unless versioning or a conditional request changes the
result. AWS explicitly documents replacement by a reused presigned URL.[^aws-presign] DigitalOcean
documents versioning, but its API page does not document `If-None-Match` for `PutObject` even though
AWS does.[^do-api][^aws-put] Consequently:

- use collision-resistant, server-selected object keys;
- treat retrying the same bytes to the same key as convergent, but not as an idempotency proof when
  concurrent writers can use that key;
- do not put conditional-create semantics in the provider-neutral interface without a Spaces
  conformance test and explicit capability; and
- perform a trusted `HEAD` after an ambiguous network outcome rather than assuming failure.

### Multipart initiation

`CreateMultipartUpload` is `POST /key?uploads` and returns a unique `UploadId`. Metadata and content
properties belong on this request and become properties of the completed
object.[^aws-create][^aws-mpu] Spaces documents the same operation and XML result.[^do-api]

Creation is not safely retryable as an idempotent operation: every successful call can allocate a
new upload ID. If the response is lost, a retry can leave an orphan. The adapter should persist an
upload session as soon as it receives the ID, and bucket lifecycle cleanup should be a backstop. AWS
multipart uploads have no intrinsic expiry and remain billable until completed or aborted; AWS
recommends an incomplete-upload lifecycle rule.[^aws-mpu] Spaces automatically removes incomplete
multipart uploads older than 30 days and also supports lifecycle removal
rules.[^do-limits][^do-compat] These are different cleanup guarantees, so the application still
needs explicit abort and stale session reconciliation.

### Part upload

`UploadPart` is a `PUT` whose signed query contains both `partNumber` and `uploadId`. Parts can be
uploaded independently, concurrently, and in any order. Uploading the same part number again for the
same upload ID replaces the previous part.[^aws-part][^aws-mpu] Spaces documents the same request,
requires `Content-Length`, and returns an `ETag`.[^do-api]

This yields the useful portable retry unit:

1. Generate or refresh a URL for the same upload ID and part number.
2. Retry the exact file slice with bounded exponential backoff and jitter for network failures,
   `429` if observed, and `5xx`/`503 Slow Down`.
3. Replace the locally stored ETag only after a successful retry.
4. Never retry with a different slice under the same part number.

Spaces explicitly directs applications to use exponential backoff for `503 Slow Down`.[^do-limits]
AWS recommends retrying failed multipart requests and notes that retransmitting one part does not
affect the others.[^aws-complete][^aws-mpu]

The application must retain the exact returned ETag. AWS requires each uploaded part's part number
and ETag in completion and says not to build the completion manifest from `ListParts`; maintain the
client's own list instead.[^aws-part][^aws-mpu] Since `ETag` is not a CORS-safelisted response
header, bucket CORS must expose it before browser JavaScript can read it.[^fetch-headers]

### Completion

`CompleteMultipartUpload` is `POST /key?uploadId=...` with an XML body listing part numbers in
ascending order and their exact ETags. S3 concatenates only the listed parts in ascending part
number order. Non-final parts below 5 MiB, missing/mismatched parts, and out-of-order manifests
fail.[^aws-complete] Spaces documents the same request and completion result.[^do-api]

Completion has two important ambiguity hazards:

- AWS can send HTTP `200` and then embed an XML `<Error>` in the response body, so status alone is
  not success. AWS SDKs parse this case; direct REST callers must do so themselves.[^aws-complete]
- A connection can fail after the provider commits the object but before the caller receives the
  success body. The caller must reconcile with `HEAD` and session state before deciding to retry or
  abort.

For the recommended server-side completion path, use the SDK or parse the XML result/error, then
`HEAD` the object. If completion is ever browser-direct, the browser protocol must expose `POST` and
`Content-Type` in CORS, parse the XML body even on HTTP 200, and send the manifest through a URL
whose method, key, upload ID, and required headers match the signature. AWS says failed completion
requests, including 500 responses, should be retried.[^aws-complete] Because Spaces does not
separately document completion idempotency, a portable retry policy should reconcile first when the
result is ambiguous.

### Abort

`AbortMultipartUpload` is `DELETE /key?uploadId=...`. A successful AWS abort returns `204` and
prevents later uploads under that ID, but in-flight part PUTs can still succeed after the abort. AWS
says abort may need to be repeated and recommends `ListParts` until the list is empty.[^aws-abort]
Spaces documents abort and requires write/delete access.[^do-api]

Therefore abort is best-effort cleanup, not a transaction rollback:

- stop and await browser part requests first;
- call abort;
- treat `204` as success and `404 NoSuchUpload` as already completed/aborted for cleanup purposes;
- optionally list/re-abort when strict storage cleanup matters; and
- retain lifecycle cleanup as a final safety net.

Never expose a broad delete credential to the browser. If browser-direct abort is required, issue a
URL scoped to exactly one upload ID.

## Presigned URL constraints

### Capability and expiration

A presigned URL is a bearer token whose effective permission is bounded by the signing principal.
AWS URLs can be reused until expiration, can overwrite an existing key, and expire at the earlier of
their configured lifetime or the signing credential's expiry/revocation. SigV4 SDK/CLI URLs can be
valid for at most seven days; AWS checks expiration when the request starts, so a reconnect after
expiry fails.[^aws-presign] The Smithy SigV4 source enforces a seven-day maximum.[^smithy-signature]

Spaces documents SigV2 and SigV4 presigned URL support but does not publish a maximum presigned
lifetime on its compatibility page.[^do-compat] Its access-key documentation describes regeneration
and deletion, but not temporary credential expiry.[^do-access] Thus seven days is an AWS fact, not a
hard cross-provider guarantee.

Portable policy:

- default to roughly 10-15 minutes, shorter where practical;
- return an absolute expiry to the browser and refresh before starting a part that may run past it;
- allow regeneration for an unchanged operation identity `(method, key, uploadId?, partNumber?)`;
- never log complete URLs because they are bearer capabilities; and
- do not presign all 10,000 possible parts up front.

### What is actually signed

SigV4 authenticates the HTTP method, canonical URI, sorted canonical query, selected canonical
headers, and payload hash marker. `host` is mandatory; included `x-amz-*` headers and any selected
standard headers are bound to their values.[^aws-sigv4] Query presigning adds the credential scope,
date, expiry, signed-header list, optional session token, and signature to the
URL.[^smithy-signature] For S3, the AWS presigner sets `x-amz-content-sha256` to `UNSIGNED-PAYLOAD`,
sets the host, and uses a 15-minute default.[^aws-presigner]

The practical browser contract is not merely a URL. It is:

```text
method + URL + required request headers + expiresAt
```

Every header named by `X-Amz-SignedHeaders` must arrive with the signed value. Conversely, a caller
must not infer that a header is bound merely because the application supplied it to an SDK command:
the current AWS S3 presigner deliberately marks `content-type` unsignable by default, while keeping
SSE headers unhoisted unless configured otherwise.[^aws-presigner] The adapter should return the
headers the browser must send and test the generated request shape against each provider.

Avoid signing browser-forbidden or volatile headers. `host` is the required exception and is
generated from the URL by the browser. Do not bind `Content-Length`, user agent, connection headers,
or browser-generated `Origin`. Bind `Content-Type`, `Content-MD5`, checksum headers, metadata, or
SSE headers only when they are a deliberate invariant and are included consistently in both the
signature and browser request.

The URL also fixes endpoint style. DigitalOcean's SDK guide uses a regional endpoint such as
`https://nyc3.digitaloceanspaces.com`, virtual-host addressing, and provider-specific signing region
configuration.[^do-sdk] Endpoint, addressing style, region/signing region, and credentials must
therefore be adapter configuration, not derived with AWS-only assumptions. Avoid dots in Spaces
bucket names for browser virtual-host access because wildcard TLS certificates do not match
them.[^do-limits]

## Browser CORS contract

CORS is browser permission to reveal a response, not storage authorization. AWS states that bucket
policies and ACLs still apply when CORS is enabled; Spaces says the same.[^aws-cors][^do-cors]
Presigned authorization and CORS must both succeed.

For the recommended browser data plane, configure the exact application origins and:

```xml
<AllowedMethod>PUT</AllowedMethod>
<AllowedMethod>HEAD</AllowedMethod> <!-- only if browser HEAD is used -->
<AllowedHeader>content-type</AllowedHeader>
<AllowedHeader>content-md5</AllowedHeader> <!-- if enabled -->
<AllowedHeader>x-amz-*</AllowedHeader>     <!-- narrow further if practical -->
<ExposeHeader>ETag</ExposeHeader>
<!-- Expose selected x-amz-checksum-* headers only if the capability uses them. -->
```

Add `POST` for browser initiation/completion and `DELETE` for browser abort only if those operations
are intentionally delegated. AWS and Spaces CORS configurations both support `GET`, `PUT`, `POST`,
`DELETE`, and `HEAD`, allowed headers, exposed response headers, and preflight cache
age.[^aws-cors-config][^do-cors]

Cross-origin `PUT` always requires preflight because Fetch safelists only `GET`, `HEAD`, and `POST`
methods. `Content-Type` is request-safelisted only for three narrow media types, not normal binary
types such as `application/octet-stream`; checksum and `x-amz-*` headers are also non-safelisted.
JavaScript can read only the CORS-safelisted response headers plus names allowed by
`Access-Control-Expose-Headers`; `ETag` is not in the safelist.[^fetch-headers]

Operational implications:

- The CORS rule must cover every header the browser actually sends, including signed headers.
- Use explicit production origins instead of `*`; a presigned URL remains a bearer token even
  without cookies.
- Expose `ETag` or multipart completion is impossible in browser JavaScript.
- `Content-Length` is already response-safelisted, so browser `HEAD` can read object size without
  exposing it.[^fetch-headers]
- CORS failures often appear to JavaScript as generic network errors; retain provider request IDs
  server-side and optionally expose them during diagnostics.
- Spaces CDN can cache responses without new CORS headers; DigitalOcean instructs users to purge CDN
  cache after CORS changes.[^do-cors]
- Upload to the origin endpoint, not the Spaces CDN. DigitalOcean limits presigned PUT/multipart
  payloads sent through its CDN to 8,100 KiB and says presigned transfers are not
  CDN-cacheable.[^do-limits][^do-sdk]

## ETags, checksums, and verification

### ETag rules

An ETag is first an opaque validator. AWS explicitly says the final multipart ETag is not
necessarily an MD5 and documents its familiar checksum-of-part-MD5s form with a `-partCount`
suffix.[^aws-mpu][^aws-integrity] Encryption and upload method can also make a single-object AWS
ETag differ from the object MD5.[^aws-integrity] DigitalOcean's API reference labels its object ETag
an MD5 and documents part ETags, but does not define an identical final multipart ETag algorithm in
its completion section.[^do-api]

Portable rules:

- preserve quotes/bytes exactly as returned when sending part ETags to completion;
- store final ETag as an opaque version token, useful for reconciliation and conditional reads;
- never present final multipart ETag as a whole-file digest; and
- never infer file identity or deduplicate solely from ETag.

### Explicit checksums

The strongest overlapping upload-integrity primitive is a precomputed `Content-MD5`. AWS validates
it and rejects a mismatch; Spaces lists `Content-MD5` for both `PutObject` and
`UploadPart`.[^aws-put][^do-api] Both providers also document CRC32, CRC32C, SHA1, and SHA256
request headers for single PUT and part PUT.[^aws-put][^aws-part][^do-api]

However, AWS now has a substantially richer checksum model: default CRC64NVME, full versus composite
multipart checksums, checksum-type negotiation at initiation/completion, and checksum retrieval with
`HeadObject` checksum mode.[^aws-integrity][^aws-head] Spaces documents only the overlapping
algorithm headers and omits AWS's full/composite checksum-type contract and newer algorithms from
its multipart control operations.[^do-api]

Implications for v1:

- Make checksums a capability, not a required method on the base adapter.
- `Content-MD5` is portable but expensive for large browser files because Web Crypto does not
  provide MD5 and the browser must read/hash bytes before upload.
- CRC32C can be incrementally computed and is a better future browser capability, but provider
  conformance should be tested before it is a required cross-provider invariant.
- Do not let a current AWS SDK silently add provider-specific checksum middleware to a Spaces
  request without inspecting the resulting headers. Prefer explicit REST-shaped presigning.
- Keep an application digest in trusted metadata/database when content identity is a product
  requirement; do not overload ETag.

### Trusted `HEAD` verification

`HeadObject` returns metadata without the body. AWS returns `Content-Length`, ETag, content type,
user metadata, and optional checksums; it requires read permission and returns generic `403` versus
`404` depending on list permission.[^aws-head] Spaces documents `HeadObject` under read access and
supports checksum mode.[^do-api]

After PUT or successful multipart completion, the trusted side should:

1. `HEAD` the exact bucket/key through the provider adapter.
2. Require `Content-Length === declared file size`.
3. Require expected immutable metadata, such as an application upload/session ID and intended
   content type, where those fields were set on PUT/initiation.
4. Record final ETag and provider version ID/checksum only when returned.
5. Mark the application upload complete only after these checks pass.

AWS guarantees strong read-after-write consistency for object PUT/DELETE and metadata `HEAD`, so an
immediate AWS HEAD sees a successful write.[^aws-consistency] DigitalOcean does not state an
equivalent consistency guarantee in the reviewed Spaces docs. The portable verifier therefore needs
bounded retry for not-found/stale observations after a confirmed completion, while still failing
closed after a deadline.

`HEAD` proves that an object with the expected size and metadata is present; without a validated
full-object checksum it does not prove byte-for-byte equality. That distinction belongs in the
adapter and product contracts.

## Edge-runtime signing

Signing must happen in trusted compute, never in the browser: a secret access key exposed to the
browser grants reusable storage credentials, whereas a presigned URL delegates one constrained
request. SigV4 itself needs SHA-256, HMAC-SHA-256, UTF-8/hex encoding, deterministic URI/query
encoding, and a UTC clock, all implementable in edge runtimes with Web Crypto.

The current AWS JavaScript implementation has two useful but distinct layers:

- `@aws-sdk/s3-request-presigner` resolves and serializes an S3 command through the client
  middleware, then intercepts before authentication and formats the presigned
  URL.[^aws-get-signed-url]
- Smithy's `SignatureV4` accepts an injected SHA-256 constructor, enforces the seven-day maximum,
  and performs the canonical SigV4 algorithm.[^smithy-signature]

The presigner package currently declares a Node `>=20` engine even though its modular signer can be
bundled with portable crypto.[^aws-presigner-package] Therefore "runs at the edge" is not a protocol
guarantee or enough reason to import the full S3 client. The later adapter decision should compare:

- bundle size and cold-start cost of `S3Client` plus `s3-request-presigner`;
- whether the target edge runtime supports the package's exports, credential providers, globals, and
  injected hash implementation;
- a smaller Smithy signer or Web-Crypto SigV4 implementation over explicitly constructed HTTP
  requests; and
- conformance fixtures for AWS and Spaces covering encoded keys, query ordering, session tokens,
  virtual-host endpoints, required headers, and clock skew.

DigitalOcean signs with service `s3` and a credential scope containing its region slug in the direct
API documentation, while its JavaScript AWS SDK example configures the custom endpoint and
`us-east-1` SDK region.[^do-api][^do-sdk] This reinforces that signing region must be provider
configuration verified by integration tests, not a universal derivation.

## Implications for the later storage-adapter decision

The adapter seam should be deeper than "return an S3 client". A provider-neutral control plane can
own these operations:

```text
createUpload({ key, size, contentType, metadata })
  -> { mode: "single" | "multipart", uploadId?, partSize }

presignPut({ key, contentType, checksum? })
  -> { method, url, headers, expiresAt }

presignPart({ key, uploadId, partNumber, checksum? })
  -> { method, url, headers, expiresAt }

completeMultipart({ key, uploadId, parts: [{ partNumber, etag }] })
abortMultipart({ key, uploadId })
verifyObject({ key, expectedSize, expectedMetadata })
```

Provider capabilities/configuration should include endpoint, addressing style, signing region,
maximum object/part dimensions, checksum algorithms/types, versioning, conditional writes, and
cleanup policy. The v1 planner should enforce the common dimensions before any URL is issued and
choose a part size that stays under 10,000 parts. A practical lower bound is:

```text
partSize >= max(5 MiB, ceil(fileSize / 10_000))
```

rounded upward to the adapter's preferred increment and never above 5 GiB.

Keep these concerns out of the browser-facing contract:

- provider credentials and signing-region quirks;
- XML parsing for initiation/completion;
- AWS-only checksums and conditional writes;
- orphan reconciliation and lifecycle policy;
- post-upload trust decision; and
- interpretation of ambiguous retries.

The browser upload engine should understand only file slicing, bounded concurrency, URL refresh,
required headers, progress, retry classification, ETag capture, cancellation, and reporting the
ordered part manifest to the trusted control plane.

## Decision questions surfaced

1. Is v1 content integrity satisfied by provider transport validation plus trusted size/metadata
   verification, or must the product expose a portable whole-file digest? The latter requires an
   explicit browser hashing and metadata strategy.
2. Must v1 prevent overwriting an existing key at the storage layer? If yes, collision-resistant
   keys alone are insufficient; Spaces conditional-write behavior needs a conformance test or the
   application must enforce uniqueness before issuing capabilities.
3. Are DigitalOcean Spaces objects above 5 TB a product requirement? If yes, Spaces cannot satisfy
   it under the documented limits and the adapter cannot hide that difference.
4. Which edge runtimes must signing support, and what maximum bundle/cold-start budget applies? This
   decides between the full AWS command presigner and a smaller explicit SigV4 signer.
5. Should completion and abort ever be delegated to the browser? The protocol permits it, but the
   recommended v1 keeps them trusted-side for authority, parsing, reconciliation, and cleanup.
6. What URL lifetime and maximum single-part duration must mobile/slow-network uploads support?
   Refresh occurs only before a request; a dropped connection cannot resume through an expired URL.
7. Will uploads target only origin endpoints? Spaces CDN's 8,100 KiB presigned-upload cap makes CDN
   upload URLs incompatible with normal multipart sizing.

## Primary sources

[^aws-put]:
    AWS S3 API, [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html).

[^aws-create]:
    AWS S3 API,
    [CreateMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html).

[^aws-part]:
    AWS S3 API, [UploadPart](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html).

[^aws-complete]:
    AWS S3 API,
    [CompleteMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html).

[^aws-abort]:
    AWS S3 API,
    [AbortMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html).

[^aws-head]:
    AWS S3 API, [HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html).

[^aws-upload]:
    AWS S3 User Guide,
    [Uploading objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/upload-objects.html).

[^aws-limits]:
    AWS S3 User Guide,
    [Multipart upload limits](https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html).

[^aws-mpu]:
    AWS S3 User Guide,
    [Uploading and copying objects using multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html).

[^aws-presign]:
    AWS S3 User Guide,
    [Download and upload objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html).

[^aws-sigv4]:
    AWS IAM User Guide,
    [Create a signed AWS API request](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html).

[^aws-cors]:
    AWS S3 User Guide,
    [Using cross-origin resource sharing](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html).

[^aws-cors-config]:
    AWS S3 User Guide,
    [Elements of a CORS configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html).

[^aws-integrity]:
    AWS S3 User Guide,
    [Checking object integrity for data uploads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html).

[^aws-consistency]:
    AWS S3 User Guide,
    [Amazon S3 data consistency model](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html#ConsistencyModel).

[^do-api]:
    DigitalOcean, [Spaces API Reference](https://docs.digitalocean.com/reference/api/spaces/).

[^do-compat]:
    DigitalOcean,
    [Spaces S3 compatibility](https://docs.digitalocean.com/products/spaces/reference/s3-compatibility/).

[^do-limits]:
    DigitalOcean, [Spaces limits](https://docs.digitalocean.com/products/spaces/details/limits/).

[^do-cors]:
    DigitalOcean,
    [Configure CORS](https://docs.digitalocean.com/products/spaces/how-to/configure-cors/).

[^do-sdk]:
    DigitalOcean,
    [Use Spaces with AWS S3 SDKs](https://docs.digitalocean.com/products/spaces/reference/aws-sdks/).

[^do-access]:
    DigitalOcean,
    [Manage access to Spaces](https://docs.digitalocean.com/products/spaces/how-to/manage-access/).

[^fetch-headers]:
    WHATWG,
    [Fetch Standard: methods, CORS-safelisted and forbidden headers](https://fetch.spec.whatwg.org/#terminology-headers).

[^aws-get-signed-url]:
    AWS SDK for JavaScript v3 source,
    [`getSignedUrl.ts`](https://github.com/aws/aws-sdk-js-v3/blob/main/packages/s3-request-presigner/src/getSignedUrl.ts).

[^aws-presigner]:
    AWS SDK for JavaScript v3 source,
    [`presigner.ts`](https://github.com/aws/aws-sdk-js-v3/blob/main/packages/s3-request-presigner/src/presigner.ts).

[^aws-presigner-package]:
    AWS SDK for JavaScript v3 source,
    [`s3-request-presigner/package.json`](https://github.com/aws/aws-sdk-js-v3/blob/main/packages/s3-request-presigner/package.json).

[^smithy-signature]:
    Smithy TypeScript source,
    [`SignatureV4.ts`](https://github.com/smithy-lang/smithy-typescript/blob/main/packages/signature-v4/src/SignatureV4.ts)
    and
    [`constants.ts`](https://github.com/smithy-lang/smithy-typescript/blob/main/packages/signature-v4/src/constants.ts).
