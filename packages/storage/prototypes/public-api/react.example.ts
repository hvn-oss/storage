import { createReactUploadHooks } from "./api.ts";
import type { AppUploadRoutes } from "./server.promise.example.ts";

const { useStorage } = createReactUploadHooks<AppUploadRoutes>({
  baseUrl: "/api/storage",
});

export function AvatarUploader() {
  const avatar = useStorage("avatar");

  const onFiles = async (files: FileList) => {
    const file = files.item(0);
    if (file === null) return;

    await avatar.upload({
      idempotencyKey: crypto.randomUUID(),
      input: { accountId: "account-1" },
      files: [{ clientId: "avatar", file }],
    });
  };

  // Render details are omitted. The prototype is testing controller shape and inference.
  return {
    state: avatar.state,
    progress: avatar.progress,
    result: avatar.result,
    onFiles,
    pause: avatar.pause,
    continue: avatar.continue,
    cancel: avatar.cancel,
  };
}
