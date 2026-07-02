import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { uploadLocalImages, type ImageUploadDeps } from "./syncWorker";
import { setOfflineConnectivity } from "./connectivity";

/**
 * Paid image upload-on-sync (DATA_AND_SYNC.md §7, REQ-D70/D71) — mobile mirror of the web test.
 * On drain a local ImageRef is uploaded to Convex storage and flipped to `cloud`, keeping the local
 * copy as cache. Free users NEVER upload (REQ-D10 zero-Convex-calls invariant); upload failures
 * preserve the local ref for retry (REQ-D70, local is the durable home).
 *
 * The offline modules pulled in by `syncWorker` reach SQLite (`./db`) and the file system
 * (`expo-file-system/legacy`); both are mocked here since the orchestration takes injected deps.
 */

vi.mock("./db", () => ({
  getOfflineDb: () => {
    throw new Error("db unavailable in unit test");
  },
}));

vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: null,
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  copyAsync: vi.fn(),
  deleteAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
}));

beforeEach(() => {
  setOfflineConnectivity(true);
});

function fakeUploadClient(): { client: ConvexReactClient; calls: { fn: string; args: unknown }[] } {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    query: vi.fn(() => Promise.resolve(null)),
    mutation: vi.fn((ref: unknown, args: unknown) => {
      const fn = getFunctionName(ref as never);
      calls.push({ fn, args });
      if (fn === "files:generateUploadUrl") return Promise.resolve("file:///upload/x");
      return Promise.resolve({ _id: "x" });
    }),
  } as unknown as ConvexReactClient;
  return { client, calls };
}

function depsWith(
  rows: Record<string, Record<string, unknown>[]>,
  upload: ImageUploadDeps["uploadBytes"],
  written: { table: string; id: string; doc: Record<string, unknown> }[]
): ImageUploadDeps {
  return {
    listSyncedRows: (table) => rows[table] ?? [],
    writeSyncedRow: (table, id, _userId, doc) => written.push({ table, id, doc }),
    readImageBytes: async () => ({ body: "file:///local/local_a", contentType: "image/jpeg" }),
    uploadBytes: upload,
  };
}

const progressUpdateRow = {
  buildProgressUpdates: [
    {
      _id: "pu_1",
      userId: "user_1",
      imageRefs: [{ kind: "local", uri: "file:///local/local_a", imageKey: "local_a" }],
    },
  ],
};

describe("uploadLocalImages (mobile, REQ-D71)", () => {
  it("should_upload_local_image_and_convert_to_cloud_on_sync_for_paid", async () => {
    const { client, calls } = fakeUploadClient();
    const written: { table: string; id: string; doc: Record<string, unknown> }[] = [];
    const deps = depsWith(progressUpdateRow, async () => "storage_1", written);

    const result = await uploadLocalImages(client, "PRO", deps);

    expect(result).toEqual({ uploaded: 1, failed: 0 });
    expect(calls.map((c) => c.fn)).toEqual([
      "files:generateUploadUrl",
      "buildProgressUpdates:update",
    ]);
    expect(calls[1].args).toEqual({
      id: "pu_1",
      userId: "user_1",
      imageRefs: [{ kind: "cloud", storageId: "storage_1", imageKey: "local_a" }],
    });
    expect(written[0].doc.imageRefs).toEqual([
      { kind: "cloud", storageId: "storage_1", imageKey: "local_a" },
    ]);
  });

  it("should_not_attempt_any_upload_or_convex_call_for_free_users", async () => {
    const { client, calls } = fakeUploadClient();
    const uploadBytes = vi.fn(async () => "storage_1");
    const deps = depsWith(progressUpdateRow, uploadBytes, []);

    const result = await uploadLocalImages(client, "FREE", deps);

    expect(result).toEqual({ uploaded: 0, failed: 0 });
    expect(client.mutation).not.toHaveBeenCalled();
    expect(uploadBytes).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("should_preserve_local_ref_and_retry_next_sync_on_upload_failure", async () => {
    const { client } = fakeUploadClient();
    const written: { table: string; id: string; doc: Record<string, unknown> }[] = [];
    const deps = depsWith(progressUpdateRow, async () => null, written);

    const result = await uploadLocalImages(client, "PRO", deps);

    expect(result).toEqual({ uploaded: 0, failed: 1 });
    expect(written).toHaveLength(0); // local ref intact, no flip

    const written2: { table: string; id: string; doc: Record<string, unknown> }[] = [];
    const deps2 = depsWith(progressUpdateRow, async () => "storage_9", written2);
    const retry = await uploadLocalImages(client, "PRO", deps2);

    expect(retry).toEqual({ uploaded: 1, failed: 0 });
    expect(written2[0].doc.imageRefs).toEqual([
      { kind: "cloud", storageId: "storage_9", imageKey: "local_a" },
    ]);
  });
});
