import { Context, Effect, Layer, Schema } from "effect";
import {
  createEffectUploadHandler,
  defineEffectUploadRoutes,
  defineEffectUploadRoute,
  effectServerLayer,
  type UploadContract,
} from "./api.ts";

interface Identity {
  readonly userId: string;
  readonly accountId: string;
}

interface Identities {
  readonly current: (request: Request) => Effect.Effect<Identity>;
}

const Identities = Context.GenericTag<Identities>("@example/Identities");

const document = defineEffectUploadRoute({
  input: Schema.Struct({ folderId: Schema.String }),
  sessionMetadata: Schema.Struct({
    folderId: Schema.String,
    ownerId: Schema.String,
  }),
  fileMetadata: Schema.Struct({ classification: Schema.String }),
  publicMetadata: Schema.Struct({ label: Schema.String }),
  storage: "documents",
  policy: {
    maxFiles: 20,
    maxFileSize: 5 * 1024 * 1024 * 1024,
    sessionLifetimeSeconds: 24 * 60 * 60,
    multipartThreshold: 16 * 1024 * 1024,
    partSize: 8 * 1024 * 1024,
    capabilityLifetimeSeconds: 15 * 60,
    maxCapabilityBatch: 8,
  },
  authorizeUpload: ({ request, input, files, allow }) =>
    Effect.gen(function* () {
      const identities = yield* Identities;
      const identity = yield* identities.current(request);

      return allow({
        sessionMetadata: {
          folderId: input.folderId,
          ownerId: identity.userId,
        },
        files: files.map(({ clientId }) => ({
          clientId,
          metadata: { classification: "private" },
        })),
      });
    }),
  authorizeOperation: ({ request, operation, sessionMetadata, allow, notFound }) =>
    Effect.gen(function* () {
      const identities = yield* Identities;
      const identity = yield* identities.current(request);

      if (identity.userId !== sessionMetadata.ownerId) {
        return notFound();
      }

      return operation === "downloadFile"
        ? allow({
            disposition: "attachment",
            metadata: { label: "Private document" },
          })
        : allow();
    }),
});

export const effectUploadRoutes = defineEffectUploadRoutes({ document });
export type EffectAppUploadRoutes = UploadContract<typeof effectUploadRoutes>;

const handle = createEffectUploadHandler({
  basePath: "/api/storage",
  routes: effectUploadRoutes,
});

declare const applicationLayer: Layer.Layer<Identities>;

export const handleStorageRequest = (request: Request) =>
  handle(request).pipe(Effect.provide(Layer.merge(effectServerLayer, applicationLayer)));
