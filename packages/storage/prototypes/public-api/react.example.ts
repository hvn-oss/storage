import { createStorageHooks } from "./api.ts";
import type { AppUploadRoutes } from "./server.promise.example.ts";

const { useStorage } = createStorageHooks<AppUploadRoutes>({
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

  const download = async (fileId: string) => {
    const response = await avatar.download(fileId);
    return response.metadata?.dominantColor;
  };

  // Render details are omitted. The prototype is testing controller shape and inference.
  return {
    state: avatar.state,
    progress: avatar.progress,
    result: avatar.result,
    onFiles,
    download,
    pause: avatar.pause,
    continue: avatar.continue,
    cancel: avatar.cancel,
  };
}
