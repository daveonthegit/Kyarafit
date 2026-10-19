import { describe, expect, it, vi } from "vitest";
import { importKey } from "./importKey";
import { emptyCollections, NonEmptyVaultError, runImport } from "./dataPortability";

describe("import retry keys", () => {
  it("is stable on re-import, but isolates accounts and collections", () => {
    const row = { id: "source-row" };
    const key = importKey("owner", "builds", row);
    expect(importKey("owner", "builds", { ...row })).toBe(key);
    expect(importKey("other", "builds", row)).not.toBe(key);
    expect(importKey("owner", "conventions", row)).not.toBe(key);
  });

  it("does not alias delimiters in tuple components", () => {
    expect(importKey("a:b", "c", { id: "d" })).not.toBe(importKey("a", "b:c", { id: "d" }));
    expect(importKey("a", "b:c", { id: "d" })).not.toBe(importKey("a", "b", { id: "c:d" }));
  });

  it("refuses a restore into a non-empty vault before creating anything", async () => {
    const imported = { ...emptyCollections(), builds: [{ id: "source-row", name: "Build" }] };
    const createRow = vi.fn(async (_collection: string, row: { id: string }) => row.id);
    await expect(runImport({ imported, existing: imported, createRow })).rejects.toBeInstanceOf(
      NonEmptyVaultError
    );
    expect(createRow).not.toHaveBeenCalled();
  });
});
