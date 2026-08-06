# HVN Storage

HVN Storage is a direct-to-cloud file transfer system in which applications authorize access while
file bytes move between clients and storage providers.

## Language

**Upload Route**: A named, shared definition of upload policy that binds separate server
authorization hooks and client lifecycle hooks. _Avoid_: Endpoint, uploader

**Upload Session**: A durable grouping created for one authorization request containing one or more
files under one upload route. It owns one immutable completion deadline and other shared
authorization constraints, while its outcome is derived from its file records; one file's failure
does not fail its siblings. _Avoid_: Batch, upload

**Active Session**: An upload session with at least one authorized file.

**Settled Session**: An upload session whose file records are all ready, failed, or expired. Its
per-state file counts express complete success and every partial outcome.

**File Record**: The authoritative durable lifecycle record for one file authorized within an upload
session and bound to one unique, immutable, never-reused storage key. Each file progresses
independently. _Avoid_: Upload record, object

**Storage Key**: The opaque, non-secret identifier that locates one file's bytes at the storage
provider. HVN Storage creates it for exactly one file record and never reuses or changes it.
_Avoid_: Filename, file ID

**Authorized File**: A file permitted to transfer and request completion before its completion
window expires. Transfer progress and recoverable verification attempts do not change this state.

**Ready File**: A file whose storage object was verified at the transition to ready to exist at its
authorized key with its expected byte size and is available for authorized download. Readiness is a
point-in-time fact, not a guarantee against later use of an unexpired upload capability. _Avoid_:
Completed upload

**Download Capability**: A short-lived bearer capability issued after application authorization that
permits its holder to retrieve one Ready File directly from the storage provider. It grants no
authority over the File Record and is not durable identity. _Avoid_: Download URL

**Failed File**: A file whose lifecycle trusted server-side logic explicitly ended after determining
that its authorization can no longer produce a ready file. It retains a canonical terminal reason;
transport errors and client-reported failures are not sufficient.

**Expired File**: A file whose transition to ready did not become authoritative before its
completion deadline and which can no longer request completion.

**In-Instance Continuation**: Continuing transfer work while the same browser client instance still
holds transient scheduling state and multipart part evidence. It does not survive page reload or
browser restart. _Avoid_: Session resume

**Upload Session Recovery**: Reconstructing authoritative Upload Session and File Record lifecycle
state from durable server data after client state is unavailable. It identifies unfinished files but
does not reconstruct transient multipart part evidence.
