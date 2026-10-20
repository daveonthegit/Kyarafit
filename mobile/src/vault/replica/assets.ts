import type { VaultSql } from "../store";
import { collectVaultPhotos } from "../images";

/**
 * Photo bytes for managed sync. Replicated rows carry only portable `kyarafit-image:<key>` tokens;
 * the bytes behind each key are uploaded once to Kyarafit Cloud and registered in the server's
 * typed asset table (`replica:registerAsset`), so media access, the hosted-media quota and account
 * deletion all see them. A device that has a row but not its photo downloads the bytes into the
 * vault's photo directory.
 *
 * Bounded per pass (uploads are slow on cellular); whatever is left is picked up by the next pass.
 */

export interface ReplicaAssetIo {
  /** Whether the vault's photo directory holds this key's original. */
  hasLocal(imageKey: string): Promise<boolean>;
  /** Upload the local original and return its storage id. */
  upload(imageKey: string): Promise<string>;
  register(imageKey: string, storageId: string): Promise<void>;
  /** Download URLs for the keys already in the cloud (others are absent). */
  urls(imageKeys: string[]): Promise<{ imageKey: string; url: string }[]>;
  /** Save a downloaded original into the vault's photo directory. */
  download(imageKey: string, url: string): Promise<void>;
}

export interface ReplicaAssetResult {
  uploaded: number;
  downloaded: number;
  failed: number;
}

const URL_BATCH = 50;
const MAX_TRANSFERS_PER_PASS = 20;

/** Every vault photo key referenced by a live row (legacy cloud-only references excluded). */
export function referencedImageKeys(sql: VaultSql): string[] {
  const keys = new Set<string>();
  const rows = sql.getAllSync<{ json: string }>("SELECT json FROM entity_rows WHERE deleted = 0");
  for (const row of rows) {
    let doc: unknown;
    try {
      doc = JSON.parse(row.json);
    } catch {
      continue;
    }
    for (const photo of collectVaultPhotos(doc).values()) {
      if (!photo.storageId) keys.add(photo.key);
    }
  }
  return [...keys].sort();
}

export async function syncReplicaAssets(
  sql: VaultSql,
  io: ReplicaAssetIo,
  isCurrent: () => boolean = () => true,
  now: () => number = Date.now
): Promise<ReplicaAssetResult> {
  const result: ReplicaAssetResult = { uploaded: 0, downloaded: 0, failed: 0 };
  const known = new Set(
    sql
      .getAllSync<{ image_key: string }>("SELECT image_key FROM replica_assets")
      .map((row) => row.image_key)
  );
  const markKnown = (imageKey: string) => {
    sql.runSync("INSERT OR IGNORE INTO replica_assets (image_key, uploaded_at) VALUES (?, ?)", [
      imageKey,
      now(),
    ]);
    known.add(imageKey);
  };
  const keys = referencedImageKeys(sql);
  let transfers = 0;
  for (let i = 0; i < keys.length && transfers < MAX_TRANSFERS_PER_PASS; i += URL_BATCH) {
    const batch = keys.slice(i, i + URL_BATCH);
    const local = new Map<string, boolean>();
    for (const key of batch) local.set(key, await io.hasLocal(key));
    // Keys this device both has and already uploaded need no round trip.
    const ask = batch.filter((key) => !(local.get(key) && known.has(key)));
    if (ask.length === 0) continue;
    const remote = new Map((await io.urls(ask)).map((entry) => [entry.imageKey, entry.url]));
    if (!isCurrent()) return result;
    for (const key of ask) {
      if (transfers >= MAX_TRANSFERS_PER_PASS || !isCurrent()) break;
      const url = remote.get(key);
      try {
        if (url) {
          markKnown(key);
          if (!local.get(key)) {
            transfers += 1;
            await io.download(key, url);
            result.downloaded += 1;
          }
        } else if (local.get(key)) {
          transfers += 1;
          const storageId = await io.upload(key);
          if (!isCurrent()) return result;
          await io.register(key, storageId);
          markKnown(key);
          result.uploaded += 1;
        }
      } catch {
        // Left for the next pass; a missing photo never blocks row sync.
        result.failed += 1;
      }
    }
  }
  return result;
}
