import { describe, expect, it, vi } from "vitest";
import { makeTestVault } from "@/test-support/vaultHarness";
import { VaultArchiveError, VAULT_ARCHIVE_MAGIC, writeVaultArchive } from "./archive";
import {
  collectVaultImageKeys,
  collectVaultPhotos,
  vaultImageCodec,
  vaultImageKey,
  VAULT_IMAGE_TOKEN,
} from "./images";
import { VaultStore } from "./store";
import { __setActiveVaultForTests, requireActiveVault } from "./activeVault";
import { exportVault, importVault, type VaultPhotoFiles } from "./portability";

/** In-memory photo directory standing in for `<documents>/vaults/<key>/images/`. */
function memoryPhotos(initial: Record<string, Uint8Array> = {}) {
  const files = new Map(Object.entries(initial));
  const photos: VaultPhotoFiles = {
    size: (key) => files.get(key)?.length ?? null,
    read: (key) => {
      const bytes = files.get(key);
      if (!bytes) throw new Error(`missing ${key}`);
      return bytes;
    },
    write: (key, bytes) => {
      files.set(key, Uint8Array.from(bytes));
    },
  };
  return { files, photos };
}

function memoryArchive() {
  const chunks: Uint8Array[] = [];
  return {
    writer: { write: (bytes: Uint8Array) => chunks.push(Uint8Array.from(bytes)) },
    bytes(): Uint8Array {
      const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return out;
    },
  };
}

function readerFor(bytes: Uint8Array) {
  let offset = 0;
  return {
    get remainingBytes() {
      return bytes.length - offset;
    },
    read(length: number): Uint8Array {
      const slice = bytes.subarray(offset, offset + length);
      offset += slice.length;
      return slice;
    },
  };
}

const PHOTO = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 250, 251, 0, 7]);

/** A small but realistic vault: build with photo + nested element + task, convention with packing. */
function seededVault(subject = "user_a") {
  const vault = makeTestVault({ subject });
  const build = vault.mutate<{ _id: string }>("builds:create", {
    name: "Ganyu — 日本語 ✨",
    status: "wip",
    imageUrl: `${VAULT_IMAGE_TOKEN}img_hero`,
  });
  const element = vault.mutate<{ _id: string }>("cosplayNodes:create", {
    nodeType: "element",
    name: "Horns",
    tags: ["props"],
  });
  vault.mutate("builds:addNodesToBuild", { buildId: build._id, cosplayNodeIds: [element._id] });
  vault.mutate("workflow:create", {
    title: "Sand horns",
    kind: "task",
    category: "props",
    status: "todo",
    attachments: [{ entityType: "cosplayNode", entityId: element._id, role: "primary" }],
  });
  const convention = vault.mutate<{ _id: string }>("conventions:create", {
    name: "Anime Expo",
    startDate: "2027-07-01",
    endDate: "2027-07-04",
  });
  vault.mutate("conventions:replacePlan", {
    conventionId: convention._id,
    plan: [{ date: "2027-07-01", buildId: build._id }],
  });
  vault.mutate("conventions:regeneratePacking", { conventionId: convention._id });
  return { vault, buildId: build._id, conventionId: convention._id };
}

function cloudOnlyVault() {
  const vault = makeTestVault({ subject: "cloud_owner" });
  vault.store.commit((db) => {
    const buildId = db.insert("builds", {
      userId: vault.subject,
      name: "Build",
      status: "idea",
      imageStorageId: "cloud-build",
      imageUrl: "https://example.com/old-url",
    });
    db.insert("cosplayNodes", {
      userId: vault.subject,
      name: "Element",
      nodeType: "element",
      tags: [],
      buildId,
      imageStorageId: "cloud-element",
    });
    db.insert("conventions", {
      userId: vault.subject,
      name: "Con",
      startDate: "2027-01-01",
      endDate: "2027-01-02",
      imageStorageId: "cloud-convention",
    });
    for (const table of ["buildReferenceImages", "buildProcessPictures"])
      db.insert(table, {
        userId: vault.subject,
        buildId,
        sortOrder: 0,
        imageStorageId: `cloud-${table}`,
      });
  });
  return vault;
}

describe("vault export / import", () => {
  it("ignores backed-up device preferences without reporting omissions", async () => {
    const source = makeTestVault();
    const sourceBuild = source.mutate<{ _id: string }>("builds:create", {
      name: "Source build",
      status: "idea",
    });
    source.mutate("users:setFocusedBuild", { buildId: sourceBuild._id });
    const archive = memoryArchive();
    await exportVault(source.store, memoryPhotos().photos, archive.writer);
    expect(source.store.reader().query("vaultSettings").collect()).toHaveLength(1);

    const target = makeTestVault();
    target.mutate("builds:create", { name: "First build", status: "idea" });
    const targetBuild = target.mutate<{ _id: string }>("builds:create", {
      name: "Destination focus",
      status: "idea",
    });
    target.mutate("users:setFocusedBuild", { buildId: targetBuild._id });
    const settings = target.store.reader().query("vaultSettings").collect();
    expect(settings[0]._id).not.toBe(source.store.reader().query("vaultSettings").first()?._id);
    const result = importVault(target.store, memoryPhotos().photos, readerFor(archive.bytes()));
    expect(result.rows).toMatchObject({ inserted: 0, updated: 0, unknown: 0 });
    expect(result.rowsOmitted).toBe(0);
    expect(target.store.reader().query("vaultSettings").collect()).toEqual(settings);
    expect(target.query("users:getFocusedBuildId")).toBe(targetBuild._id);
    target.mutate("users:setFocusedBuild", {});
    expect(target.query("users:getFocusedBuildId")).toBeNull();
    importVault(target.store, memoryPhotos().photos, readerFor(archive.bytes()));
    expect(target.store.reader().query("vaultSettings").collect()).toEqual([]);
    expect(target.query("users:getFocusedBuildId")).toBeNull();

    const fresh = makeTestVault();
    const freshResult = importVault(fresh.store, memoryPhotos().photos, readerFor(archive.bytes()));
    expect(freshResult.rows).toMatchObject({ inserted: 1, skipped: 0, unknown: 0 });
    expect(freshResult.rowsOmitted).toBe(0);
    expect(fresh.store.reader().query("vaultSettings").collect()).toEqual([]);
    expect(fresh.query("users:getFocusedBuildId")).toBeNull();
  });

  it("merges a record that has a local id in the backup and a cloud id on this device", async () => {
    // Device A created the build offline (local id) and later synced it; its backup keeps local ids.
    const source = makeTestVault({ subject: "owner" });
    const build = source.mutate<{ _id: string }>("builds:create", {
      name: "Raiden",
      status: "wip",
    });
    const element = source.mutate<{ _id: string }>("cosplayNodes:create", {
      nodeType: "element",
      name: "Sword",
      tags: [],
    });
    source.mutate("builds:addNodesToBuild", { buildId: build._id, cosplayNodeIds: [element._id] });
    const archive = memoryArchive();
    await exportVault(source.store, memoryPhotos().photos, archive.writer);

    // Device B pulled the same records from the cloud: server ids, original local ids as clientId.
    const target = makeTestVault({ subject: "owner" });
    const sourceRows = source.store.exportRows();
    for (const row of sourceRows) {
      const serverId = `srv_${row.id.replace(/[^A-Za-z0-9]/g, "")}`;
      const doc = JSON.parse(
        JSON.stringify(row.doc).split(`"${build._id}"`).join('"srv_build"')
      ) as Record<string, unknown>;
      target.sql.runSync(
        `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
         VALUES (?, ?, 'owner', ?, 1, 1, 0)`,
        [
          row.table,
          row.id === build._id ? "srv_build" : serverId,
          JSON.stringify({ ...doc, clientId: row.id }),
        ]
      );
    }
    target.store.reloadFromDisk();
    const before = target.store.exportRows().length;

    const restored = importVault(target.store, memoryPhotos().photos, readerFor(archive.bytes()));

    expect(restored.rows.inserted).toBe(0);
    expect(target.store.exportRows()).toHaveLength(before);
    const builds = target.query<{ _id: string }[]>("builds:list", {});
    expect(builds.map((b) => b._id)).toEqual(["srv_build"]);
  });

  it("merges a backup carrying cloud ids into the device that knows them as local ids", async () => {
    const device = makeTestVault({ subject: "owner" });
    const build = device.mutate<{ _id: string }>("builds:create", {
      name: "Raiden",
      status: "wip",
    });
    device.sql.runSync("INSERT INTO id_map (client_id, server_id, synced_at) VALUES (?, ?, 1)", [
      build._id,
      "srv_build",
    ]);
    // A backup made on another device names the build by its cloud id.
    const other = makeTestVault({ subject: "owner" });
    other.sql.runSync(
      `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
       VALUES ('builds', 'srv_build', 'owner', ?, 1, 1, 0)`,
      [
        JSON.stringify({
          name: "Raiden",
          status: "wip",
          userId: "owner",
          _creationTime: 1,
          updatedAt: 1,
        }),
      ]
    );
    other.store.reloadFromDisk();
    const archive = memoryArchive();
    await exportVault(other.store, memoryPhotos().photos, archive.writer);

    const restored = importVault(device.store, memoryPhotos().photos, readerFor(archive.bytes()));

    expect(restored.rows.inserted).toBe(0);
    expect(device.query<{ _id: string }[]>("builds:list", {}).map((b) => b._id)).toEqual([
      build._id,
    ]);
  });

  it("downloads cloud-only originals sequentially and restores them as local photos", async () => {
    const source = cloudOnlyVault();
    const sourcePhotos = memoryPhotos();
    const archive = memoryArchive();
    let active = 0;
    let maximum = 0;
    const download = vi.fn(async (_storageId: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return PHOTO;
    });
    const summary = await exportVault(source.store, sourcePhotos.photos, archive.writer, {
      online: () => true,
      download,
      assertCurrent: () => {},
    });
    expect(collectVaultImageKeys(source.store.exportRows()).size).toBe(5);
    expect(download.mock.calls.map(([id]) => id).sort()).toEqual(
      [
        "cloud-build",
        "cloud-element",
        "cloud-convention",
        "cloud-buildReferenceImages",
        "cloud-buildProcessPictures",
      ].sort()
    );
    expect(maximum).toBe(1);
    expect(summary.images).toBe(5);
    expect(summary.missingImages).toEqual([]);
    expect(
      source.store.exportRows().every((row) => typeof row.doc.imageStorageId === "string")
    ).toBe(true);
    const target = makeTestVault({ subject: "fresh" });
    const targetPhotos = memoryPhotos();
    const restored = importVault(target.store, targetPhotos.photos, readerFor(archive.bytes()));
    expect(restored.photosWritten).toBe(5);
    const reopened = new VaultStore({
      subject: "fresh",
      sql: target.sql,
      newId: () => "unused",
      codec: vaultImageCodec("file:///fresh/vaults/fresh/images/"),
    });
    for (const row of reopened.exportRows()) {
      const photo = [...collectVaultPhotos(row.doc).values()][0];
      expect(reopened.reader().get(row.id)?.imageUrl).toBe(
        `file:///fresh/vaults/fresh/images/${photo.key}`
      );
      expect(reopened.reader().get(row.id)?.imageStorageId).toBeUndefined();
      expect(targetPhotos.files.get(photo.key)).toEqual(PHOTO);
    }
  });

  it("restores cloud originals onto rows the device already pulled with the same timestamp", async () => {
    const source = cloudOnlyVault();
    const archive = memoryArchive();
    await exportVault(source.store, memoryPhotos().photos, archive.writer, {
      online: () => true,
      download: async () => PHOTO,
      assertCurrent: () => {},
    });
    // A fresh paid device warmed the same cloud rows (same ids and updatedAt) before importing.
    const target = makeTestVault({ subject: "cloud_owner" });
    for (const row of source.store.exportRows()) {
      target.sql.runSync(
        `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
         VALUES (?, ?, 'cloud_owner', ?, 1, 1, 0)`,
        [row.table, row.id, JSON.stringify(row.doc)]
      );
    }
    target.store.reloadFromDisk();
    const targetPhotos = memoryPhotos();
    const restored = importVault(target.store, targetPhotos.photos, readerFor(archive.bytes()));
    expect(restored.rows.inserted + restored.rows.updated).toBe(0);
    expect(restored.photosMissing).toEqual([]);
    for (const row of target.store.exportRows()) {
      expect(row.doc.imageStorageId, row.table).toBeUndefined();
      const key = vaultImageKey(String(row.doc.imageUrl));
      expect(key && targetPhotos.files.get(key)).toEqual(PHOTO);
    }
    // Sync state is untouched: the rows were acknowledged by the cloud and stay that way.
    expect(
      target.sql.getFirstSync<{ c: number }>(
        "SELECT COUNT(*) AS c FROM entity_rows WHERE synced_at IS NULL"
      )?.c
    ).toBe(0);
  });

  it("reports every cloud-only original as missing when exporting offline", async () => {
    const source = cloudOnlyVault();
    const archive = memoryArchive();
    const download = vi.fn(async () => PHOTO);
    const summary = await exportVault(source.store, memoryPhotos().photos, archive.writer, {
      online: () => false,
      download,
      assertCurrent: () => {},
    });
    expect(download).not.toHaveBeenCalled();
    expect(summary.images).toBe(0);
    expect(summary.missingImages).toHaveLength(5);
    const target = makeTestVault();
    const restored = importVault(target.store, memoryPhotos().photos, readerFor(archive.bytes()));
    expect(restored.photosMissing).toEqual(summary.missingImages);
  });

  it("reports failed downloads but propagates local persistence failures", async () => {
    const source = cloudOnlyVault();
    const archive = memoryArchive();
    const summary = await exportVault(source.store, memoryPhotos().photos, archive.writer, {
      online: () => true,
      assertCurrent: () => {},
      download: async (id) => {
        if (id === "cloud-element") throw new Error("network failure");
        return PHOTO;
      },
    });
    expect(summary.images).toBe(4);
    expect(summary.missingImages).toHaveLength(1);
    const photos = memoryPhotos().photos;
    photos.write = () => {
      throw new Error("disk full");
    };
    await expect(
      exportVault(source.store, photos, memoryArchive().writer, {
        online: () => true,
        assertCurrent: () => {},
        download: async () => PHOTO,
      })
    ).rejects.toThrow("disk full");
  });

  it("stops a pending cloud download before it can write after a vault switch", async () => {
    const source = cloudOnlyVault();
    const other = makeTestVault({ subject: "other" });
    const photos = memoryPhotos();
    const archive = memoryArchive();
    __setActiveVaultForTests(source.store);
    try {
      await expect(
        exportVault(source.store, photos.photos, archive.writer, {
          online: () => true,
          assertCurrent: () => {
            requireActiveVault(source.store);
          },
          download: async () => {
            __setActiveVaultForTests(other.store);
            return PHOTO;
          },
        })
      ).rejects.toThrow("active account changed");
      expect(photos.files.size).toBe(0);
      expect(archive.bytes().length).toBe(0);
      expect(other.store.exportRows()).toEqual([]);
    } finally {
      __setActiveVaultForTests(null);
    }
  });
  it("exports mirrored originals and reports missing structured image references", async () => {
    const { vault } = seededVault();
    vault.store.commit((db) =>
      db.insert("buildProgressUpdates", {
        userId: vault.subject,
        imageRefs: [
          { kind: "cloud", storageId: "storage", imageKey: "img_mirrored" },
          { kind: "local", imageKey: "img_missing", uri: "kyarafit-image:img_missing" },
        ],
      })
    );
    const keys = collectVaultImageKeys(vault.store.exportRows().map((row) => row.doc));
    expect([...keys].sort()).toEqual(["img_hero", "img_mirrored", "img_missing"]);
    const archive = memoryArchive();
    const summary = await exportVault(
      vault.store,
      memoryPhotos({ img_hero: PHOTO, img_mirrored: PHOTO }).photos,
      archive.writer
    );
    expect(summary.images).toBe(2);
    expect(summary.missingImages).toEqual(["img_missing"]);
    const target = makeTestVault({ subject: "other" });
    const photos = memoryPhotos();
    importVault(target.store, photos.photos, readerFor(archive.bytes()));
    expect(photos.files.get("img_mirrored")).toEqual(PHOTO);
  });
  it("round-trips every row and photo byte into a fresh vault on another account", async () => {
    const { vault: source } = seededVault("user_a");
    const { photos: sourcePhotos } = memoryPhotos({ img_hero: PHOTO });
    const archive = memoryArchive();

    const exported = await exportVault(source.store, sourcePhotos, archive.writer, undefined, 123);
    expect(exported.images).toBe(1);
    expect(exported.missingImages).toEqual([]);

    const target = makeTestVault({ subject: "user_b" });
    const { files: targetFiles, photos: targetPhotos } = memoryPhotos();
    const summary = importVault(target.store, targetPhotos, readerFor(archive.bytes()));

    const sourceRows = source.store.exportRows();
    // The fixture really covers every planner domain (guards against a silently empty seed).
    expect(new Set(sourceRows.map((row) => row.table))).toEqual(
      new Set([
        "builds",
        "cosplayNodes",
        "workflowItems",
        "workflowAttachments",
        "conventions",
        "conventionDayPlans",
        "packingListItems",
      ])
    );
    expect(summary.rows).toEqual({
      inserted: sourceRows.length,
      updated: 0,
      skipped: 0,
      conflicts: 0,
      unknown: 0,
    });
    expect(summary.photosMissing).toEqual([]);
    expect(Array.from(targetFiles.get("img_hero") ?? [])).toEqual(Array.from(PHOTO));

    // Same rows, same ids, same content — re-owned to the importing account.
    const reowned = sourceRows.map((row) => ({
      ...row,
      doc: JSON.parse(JSON.stringify(row.doc).split('"user_a"').join('"user_b"')),
    }));
    expect(target.store.exportRows()).toEqual(reowned);

    // And the derived views agree.
    const sourceBuilds = source.query<{ name: string; tasksTotal: number }[]>("builds:list", {});
    const targetBuilds = target.query<{ name: string; tasksTotal: number }[]>("builds:list", {});
    expect(targetBuilds.map((b) => [b.name, b.tasksTotal])).toEqual(
      sourceBuilds.map((b) => [b.name, b.tasksTotal])
    );
  });

  it("is idempotent: importing the same backup twice changes nothing the second time", async () => {
    const { vault: source } = seededVault();
    const archive = memoryArchive();
    await exportVault(source.store, memoryPhotos({ img_hero: PHOTO }).photos, archive.writer);
    const target = makeTestVault({ subject: "user_b" });
    const { photos } = memoryPhotos();
    importVault(target.store, photos, readerFor(archive.bytes()));
    const before = target.store.exportRows();

    const again = importVault(target.store, photos, readerFor(archive.bytes()));
    expect(again.rows.inserted).toBe(0);
    expect(again.rows.updated).toBe(0);
    expect(again.photosAlreadyPresent).toBe(1);
    expect(target.store.exportRows()).toEqual(before);
  });

  it("keeps newer local edits and takes newer backup copies", async () => {
    const { vault, buildId } = seededVault();
    const archive = memoryArchive();
    await exportVault(vault.store, memoryPhotos({ img_hero: PHOTO }).photos, archive.writer);
    vault.tick(60_000);
    vault.mutate("builds:update", { id: buildId, name: "Edited after backup" });

    const result = importVault(vault.store, memoryPhotos().photos, readerFor(archive.bytes()));
    expect(result.rows.inserted).toBe(0);
    expect(vault.query<{ name: string }>("builds:get", { id: buildId }).name).toBe(
      "Edited after backup"
    );
  });

  it("reports photos that were missing at export instead of claiming a full restore", async () => {
    const { vault } = seededVault();
    const archive = memoryArchive();
    const exported = await exportVault(vault.store, memoryPhotos().photos, archive.writer);
    expect(exported.missingImages).toEqual(["img_hero"]);

    const target = makeTestVault({ subject: "user_b" });
    const summary = importVault(target.store, memoryPhotos().photos, readerFor(archive.bytes()));
    expect(summary.photosMissing).toEqual(["img_hero"]);
    expect(summary.rows.inserted).toBeGreaterThan(0);
  });

  it("rejects a truncated backup before changing any row", async () => {
    const { vault } = seededVault();
    const archive = memoryArchive();
    await exportVault(vault.store, memoryPhotos({ img_hero: PHOTO }).photos, archive.writer);
    const truncated = archive.bytes().subarray(0, archive.bytes().length - 3);

    const target = makeTestVault({ subject: "user_b" });
    expect(() => importVault(target.store, memoryPhotos().photos, readerFor(truncated))).toThrow(
      VaultArchiveError
    );
    expect(target.store.exportRows()).toEqual([]);
  });

  it.each(["cosplayNodes", "workflowItems"])(
    "keeps local parents when merging %s would create a cycle",
    (table) => {
      const target = makeTestVault();
      const parent = table === "cosplayNodes" ? "parentNodeId" : "parentId";
      target.store.importRows(
        [
          { table, id: "A", doc: { [parent]: "B", updatedAt: 10, ancestorIds: ["B"] } },
          { table, id: "B", doc: { updatedAt: 1, ancestorIds: [] } },
          { table, id: "C", doc: { [parent]: "B", updatedAt: 1, ancestorIds: ["B"] } },
        ],
        target.subject
      );
      const result = target.store.importRows(
        [
          { table, id: "A", doc: { updatedAt: 1, ancestorIds: [] } },
          { table, id: "B", doc: { [parent]: "A", updatedAt: 20, ancestorIds: ["A"] } },
        ],
        target.subject
      );
      expect(result.conflicts).toBe(1);
      expect(target.store.reader().get("A")?.[parent]).toBe("B");
      expect(target.store.reader().get("B")?.[parent]).toBeUndefined();
      if (table === "workflowItems") {
        expect(target.store.reader().get("B")?.ancestorIds).toEqual([]);
        expect(target.store.reader().get("C")?.ancestorIds).toEqual(["B"]);
        const moved = target.store.importRows(
          [
            { table, id: "B", doc: { parentId: "D", updatedAt: 30 } },
            { table, id: "D", doc: { updatedAt: 1 } },
          ],
          target.subject
        );
        expect(moved.conflicts).toBe(0);
        expect(target.store.reader().get("A")?.ancestorIds).toEqual(["D", "B"]);
        expect(target.store.reader().get("C")?.ancestorIds).toEqual(["D", "B"]);
      }
    }
  );

  it.each(["cosplayNodes", "workflowItems"])(
    "restores healthy %s rows into a partially unreadable vault",
    async (table) => {
      const source = makeTestVault({ subject: "source" });
      const parentField = table === "cosplayNodes" ? "parentNodeId" : "parentId";
      source.store.importRows(
        [
          { table, id: "damaged", doc: { userId: "source", name: "Recovered" } },
          { table, id: "child", doc: { userId: "source", [parentField]: "damaged" } },
          { table, id: "local:aliased", doc: { userId: "source", updatedAt: 2, name: "Matched" } },
        ],
        "source"
      );
      const archive = memoryArchive();
      await exportVault(source.store, memoryPhotos().photos, archive.writer);
      const target = makeTestVault({ subject: "target" });
      for (const [id, json] of [
        ["damaged", "broken JSON"],
        ["unrelated", "also broken"],
        ["null-row", "null"],
        ["array-row", "[]"],
        ["cloud-held", JSON.stringify({ clientId: "local:aliased", updatedAt: 1 })],
      ]) {
        target.sql.runSync(
          "INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted) VALUES (?, ?, ?, ?, 99, 99, 0)",
          [table, id, target.subject, json]
        );
      }
      const result = importVault(target.store, memoryPhotos().photos, readerFor(archive.bytes()));
      expect(result.rows).toMatchObject({ inserted: 1, updated: 2, conflicts: 0 });
      expect(target.store.reader().get("damaged")).toMatchObject({
        name: "Recovered",
        userId: "target",
      });
      expect(target.store.reader().get("cloud-held")?.name).toBe("Matched");
      expect(target.store.reader().get("local:aliased")).toBeNull();
      expect(target.store.reader().get("child")?.[parentField]).toBe("damaged");
      if (table === "workflowItems") {
        expect(target.store.reader().get("child")?.ancestorIds).toEqual(["damaged"]);
      }
      for (const [id, json] of [
        ["unrelated", "also broken"],
        ["null-row", "null"],
        ["array-row", "[]"],
      ]) {
        expect(
          target.sql.getFirstSync(
            "SELECT json, synced_at FROM entity_rows WHERE table_name = ? AND id = ?",
            [table, id]
          )
        ).toEqual({ json, synced_at: 99 });
      }
    }
  );

  it("reports unreadable exported rows and unsupported imported rows as omissions", async () => {
    const source = makeTestVault();
    source.sql.runSync(
      "INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0)",
      ["builds", "bad", source.subject, "broken JSON", 1]
    );
    const archive = memoryArchive();
    const exported = await exportVault(source.store, memoryPhotos().photos, archive.writer);
    expect(exported.rowsOmitted).toBe(1);
    const target = makeTestVault();
    const restored = importVault(target.store, memoryPhotos().photos, readerFor(archive.bytes()));
    expect(restored.rowsOmitted).toBe(1);
    const unsupported = memoryArchive();
    writeVaultArchive(
      {
        subject: source.subject,
        now: 1,
        rows: [{ table: "unsupported", id: "x", doc: {} }],
        imageSize: () => null,
        readImage: () => new Uint8Array(),
      },
      unsupported.writer
    );
    const skipped = importVault(
      target.store,
      memoryPhotos().photos,
      readerFor(unsupported.bytes())
    );
    expect(skipped.rowsOmitted).toBe(1);
    expect(skipped.rows.unknown).toBe(1);
    expect(target.store.exportRows()).toEqual([]);
  });

  it("validates every photo length before writing any replacement", () => {
    const archive = memoryArchive();
    writeVaultArchive(
      {
        subject: "owner",
        now: 1,
        rows: [
          { table: "builds", id: "one", doc: { imageUrl: `${VAULT_IMAGE_TOKEN}one` } },
          { table: "builds", id: "two", doc: { imageUrl: `${VAULT_IMAGE_TOKEN}two` } },
        ],
        imageSize: () => PHOTO.length,
        readImage: () => PHOTO,
      },
      archive.writer
    );
    const target = makeTestVault();
    const original = Uint8Array.from([9]);
    const directory = memoryPhotos({ one: original });
    const write = vi.spyOn(directory.photos, "write");
    const truncated = archive.bytes().slice(0, -1);
    expect(() => importVault(target.store, directory.photos, readerFor(truncated))).toThrow(
      VaultArchiveError
    );
    expect(write).not.toHaveBeenCalled();
    expect(directory.files.get("one")).toEqual(original);
    expect(target.store.exportRows()).toEqual([]);
  });

  it("rejects files that are not Kyarafit backups and backups from a newer app", () => {
    const target = makeTestVault();
    const notABackup = Uint8Array.from('{"rows":[]}', (c) => c.charCodeAt(0));
    expect(() => importVault(target.store, memoryPhotos().photos, readerFor(notABackup))).toThrow(
      "not a Kyarafit backup"
    );

    const manifest = JSON.stringify({
      format: "kyarafit-vault",
      version: 99,
      rows: [],
      images: [],
    });
    const newer = Uint8Array.from(
      `${VAULT_ARCHIVE_MAGIC}${String(manifest.length).padStart(16, "0")}\n${manifest}`,
      (c) => c.charCodeAt(0)
    );
    expect(() => importVault(target.store, memoryPhotos().photos, readerFor(newer))).toThrow(
      "newer version"
    );
  });
});
