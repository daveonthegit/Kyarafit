import { describe, expect, it } from "vitest";
import { importKey } from "./importKey";
import { emptyCollections, runImport } from "./dataPortability";

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

  it("re-imports with identical keys even after a lost response and missing local state", async () => {
    const imported = { ...emptyCollections(), builds: [{ id: "source-row", name: "Build" }] };
    const keys: string[] = [];
    const createRow = async (collection: string, row: { id: string }) => {
      keys.push(importKey("owner", collection, row));
    };
    await runImport({ imported, existing: emptyCollections(), createRow });
    await runImport({ imported, existing: emptyCollections(), createRow });
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(1);
    await runImport({ imported, existing: imported, createRow });
    expect(keys).toHaveLength(2);
  });
});
