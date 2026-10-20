import * as FileSystem from "expo-file-system/legacy";
import { api } from "convex/_generated/api";
import { REPLICA_PROTOCOL_VERSION } from "@kyarafit/design-system/domain/replicaProtocol";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import type { ReplicaAssetIo } from "./assets";
import type { ReplicaConvexClient } from "./convexTransport";

/** Photo-byte transfers for the vault whose photos live in `imageDir` (see `./assets`). */
export function deviceReplicaAssetIo(
  client: ReplicaConvexClient,
  subject: string,
  imageDir: string
): ReplicaAssetIo {
  const protocol = REPLICA_PROTOCOL_VERSION;
  return {
    hasLocal: async (imageKey) => (await FileSystem.getInfoAsync(`${imageDir}${imageKey}`)).exists,
    upload: async (imageKey) => {
      const uploadUrl = (await client.mutation(api.files.generateUploadUrl, {})) as string;
      return uploadUriToConvexStorage(`${imageDir}${imageKey}`, uploadUrl, "image/jpeg");
    },
    register: async (imageKey, storageId) => {
      await client.mutation(api.replica.registerAsset, {
        protocol,
        subject,
        imageKey,
        storageId,
      });
    },
    urls: async (imageKeys) =>
      (await client.query(api.replica.assetUrls, { protocol, subject, imageKeys })) as {
        imageKey: string;
        url: string;
      }[],
    download: async (imageKey, url) => {
      const dir = await FileSystem.getInfoAsync(imageDir);
      if (!dir.exists) await FileSystem.makeDirectoryAsync(imageDir, { intermediates: true });
      // Download beside the target and move into place, so a dropped transfer never leaves a
      // truncated photo under the real key.
      const partial = `${imageDir}${imageKey}.partial`;
      const result = await FileSystem.downloadAsync(url, partial);
      if (result.status !== 200) {
        await FileSystem.deleteAsync(partial, { idempotent: true });
        throw new Error(`Photo download failed (${result.status})`);
      }
      await FileSystem.moveAsync({ from: partial, to: `${imageDir}${imageKey}` });
    },
  };
}
