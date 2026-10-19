import { describe, expect, it } from "vitest";
import { makeTestVault } from "@/test-support/vaultHarness";
import type { VaultDoc } from "@/vault/store";

function seedBuild(vault: ReturnType<typeof makeTestVault>, name = "Zelda"): string {
  return vault.store.commit((db) =>
    db.insert("builds", { userId: vault.subject, name, status: "wip" })
  );
}

describe.each(["buildReferenceImages", "buildProcessPictures"] as const)("%s gallery", (table) => {
  it("adds photos in order, reorders, and removes them", () => {
    const vault = makeTestVault();
    const buildId = seedBuild(vault);

    const a = vault.mutate<VaultDoc>(`${table}:add`, {
      buildId,
      imageUrl: "kyarafit-image:img_a",
    });
    vault.tick();
    const b = vault.mutate<VaultDoc>(`${table}:add`, {
      buildId,
      imageUrl: "file:///docs/vaults/k/images/img_b",
    });
    vault.tick();
    const c = vault.mutate<VaultDoc>(`${table}:add`, { buildId, imageStorageId: "storage_c" });

    expect([a.sortOrder, b.sortOrder, c.sortOrder]).toEqual([0, 1, 2]);
    expect(a.userId).toBe(vault.subject);
    expect(a.version).toBe(1);

    const listed = () =>
      vault.query<VaultDoc[]>(`${table}:listByBuild`, { buildId }).map((row) => row._id);
    expect(listed()).toEqual([a._id, b._id, c._id]);

    // Unknown ids are ignored; omitted rows keep their relative order at the end.
    vault.mutate(`${table}:reorder`, { buildId, orderedIds: [c._id, "nope", a._id] });
    expect(listed()).toEqual([c._id, a._id, b._id]);

    vault.mutate(`${table}:remove`, { id: a._id });
    expect(listed()).toEqual([c._id, b._id]);
  });

  it("requires an image and an existing build", () => {
    const vault = makeTestVault();
    const buildId = seedBuild(vault);
    expect(() => vault.mutate(`${table}:add`, { buildId })).toThrow(
      "Either imageStorageId or imageUrl is required"
    );
    expect(() =>
      vault.mutate(`${table}:add`, { buildId: "local:missing", imageUrl: "kyarafit-image:x" })
    ).toThrow("Build not found");
    expect(vault.query(`${table}:listByBuild`, { buildId: "local:missing" })).toEqual([]);
  });
});

describe("buildProgressUpdates", () => {
  it("lists newest first, edits, and soft-deletes", () => {
    const vault = makeTestVault();
    const buildId = seedBuild(vault);
    const first = vault.mutate<VaultDoc>("buildProgressUpdates:add", {
      buildId,
      note: "  cut the pattern ",
      progressPercent: 10,
      imageRefs: [{ kind: "local", uri: "kyarafit-image:img_1", imageKey: "img_1" }],
    });
    vault.tick(60_000);
    const second = vault.mutate<VaultDoc>("buildProgressUpdates:add", {
      buildId,
      note: "sewed it",
      publish: true,
    });

    expect(first.note).toBe("cut the pattern");
    expect(first.publishedToFeed).toBe(false);
    expect(second.publishedToFeed).toBe(true);
    expect(second.imageRefs).toEqual([]);

    const ids = () =>
      vault.query<VaultDoc[]>("buildProgressUpdates:listByBuild", { buildId }).map((u) => u._id);
    expect(ids()).toEqual([second._id, first._id]);

    const updated = vault.mutate<VaultDoc>("buildProgressUpdates:update", {
      id: first._id,
      note: null,
      progressPercent: 55,
    });
    expect("note" in updated).toBe(false);
    expect(updated.progressPercent).toBe(55);
    expect(updated.version).toBe(2);

    vault.mutate("buildProgressUpdates:remove", { id: second._id });
    expect(ids()).toEqual([first._id]);
    // Soft delete: the row stays in the vault with a tombstone timestamp.
    expect(vault.store.reader().get(second._id)?.deletedAt).toBe(vault.now());
    expect(() =>
      vault.mutate("buildProgressUpdates:update", { id: second._id, note: "x" })
    ).toThrow("not found");
  });

  it("validates progress and image count", () => {
    const vault = makeTestVault();
    const buildId = seedBuild(vault);
    expect(() =>
      vault.mutate("buildProgressUpdates:add", { buildId, progressPercent: 150 })
    ).toThrow("Progress percent must be between 0 and 100");
    const refs = Array.from({ length: 21 }, (_, i) => ({
      kind: "external",
      url: `https://x/${i}`,
    }));
    expect(() => vault.mutate("buildProgressUpdates:add", { buildId, imageRefs: refs })).toThrow(
      "Too many progress images"
    );
  });
});
