import { Schema } from "effect";
import {
  createStorageHandler,
  defineUploadRoute,
  defineUploadRoutes,
  type PromiseServerRuntime,
  type UploadContract,
} from "./api.ts";

const AvatarInput = Schema.Struct({
  accountId: Schema.String,
  crop: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      size: Schema.Number,
    }),
  ),
});

const SessionMetadata = Schema.Struct({
  accountId: Schema.String,
  authorizedBy: Schema.String,
});

const FileMetadata = Schema.Struct({
  kind: Schema.Literal("avatar"),
});

const PublicMetadata = Schema.Struct({
  dominantColor: Schema.optional(Schema.String),
});

const avatar = defineUploadRoute({
  input: AvatarInput,
  sessionMetadata: SessionMetadata,
  fileMetadata: FileMetadata,
  publicMetadata: PublicMetadata,
  storage: "assets",
  policy: {
    maxFiles: 1,
    maxFileSize: 8 * 1024 * 1024,
    acceptedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    sessionLifetimeSeconds: 60 * 60,
    multipartThreshold: 8 * 1024 * 1024,
    partSize: 8 * 1024 * 1024,
    capabilityLifetimeSeconds: 15 * 60,
    maxCapabilityBatch: 4,
    downloadCapabilityLifetimeSeconds: 5 * 60,
  },
  async authorizeUpload({ request, input, files, allow, reject }) {
    const user = await authenticate(request);

    if (user.accountId !== input.accountId) {
      return reject({ code: "account-mismatch" });
    }

    return allow({
      sessionMetadata: {
        accountId: input.accountId,
        authorizedBy: user.id,
      },
      files: files.map(({ clientId }) => ({
        clientId,
        metadata: { kind: "avatar" as const },
      })),
    });
  },
  async authorizeOperation({ request, operation, sessionMetadata, allow, notFound }) {
    const user = await authenticate(request);

    if (user.accountId !== sessionMetadata.accountId) {
      return notFound();
    }

    if (operation === "downloadFile") {
      return allow({
        disposition: "inline",
        metadata: { dominantColor: "#465966" },
      });
    }

    return allow();
  },
});

export const uploadRoutes = defineUploadRoutes({ avatar });

// This is the only server-derived symbol browser code imports, and it is type-only.
export type AppUploadRoutes = UploadContract<typeof uploadRoutes>;

declare const runtime: PromiseServerRuntime;

export const handleStorageRequest = createStorageHandler({
  basePath: "/api/storage",
  routes: uploadRoutes,
  runtime,
});

async function authenticate(_request: Request) {
  return { id: "user-1", accountId: "account-1" };
}
