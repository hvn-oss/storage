import { Effect } from "effect";
import { createEffectUploadClient, createUploadClient } from "./api.ts";
import type { AppUploadRoutes } from "./server.promise.example.ts";

const uploads = createUploadClient<AppUploadRoutes>({
  baseUrl: new URL("/api/storage", location.origin),
});

declare const avatar: File;

const upload = uploads.upload("avatar", {
  idempotencyKey: crypto.randomUUID(),
  input: {
    accountId: "account-1",
    crop: { x: 0, y: 0, size: 512 },
  },
  files: [{ clientId: "avatar", file: avatar }],
  onProgress(progress) {
    console.log(progress.bytesSent, progress.bytesTotal);
  },
  onFileReady(file) {
    console.log(file.id);
  },
});

const unsubscribe = upload.subscribe((progress) => {
  console.log(progress.activeRequests);
});

const result = await upload.result;
unsubscribe();

const ready = result.files.find((file) => file._tag === "Ready");

if (ready?._tag === "Ready") {
  const response = await uploads.download("avatar", ready.file.id);
  console.log(response.metadata?.dominantColor);
}

const effectUploads = createEffectUploadClient<AppUploadRoutes>({
  baseUrl: "/api/storage",
});

const uploadProgram = effectUploads
  .upload("avatar", {
    idempotencyKey: crypto.randomUUID(),
    input: { accountId: "account-1" },
    files: [{ clientId: "avatar", file: avatar }],
  })
  .pipe(
    Effect.flatMap((handle) => handle.result),
    Effect.tap((uploadResult) => Effect.logInfo("Upload settled", uploadResult)),
    Effect.catchTags({
      RateLimited: (error) => Effect.logWarning("Retry later", error),
      TemporarilyUnavailable: (error) => Effect.logWarning("Retry later", error),
    }),
  );

void Effect.scoped(uploadProgram);

// @ts-expect-error The registry has no route named "video".
void uploads.upload("video", {
  idempotencyKey: crypto.randomUUID(),
  input: { accountId: "account-1" },
  files: [{ clientId: "avatar", file: avatar }],
});

void uploads.upload("avatar", {
  idempotencyKey: crypto.randomUUID(),
  // @ts-expect-error Avatar input requires accountId.
  input: {},
  files: [{ clientId: "avatar", file: avatar }],
});
