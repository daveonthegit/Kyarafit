import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodeSqliteDatabase } from "@/test-support/nodeSqlite";
import { VaultStore } from "@/vault/store";
import { vaultImageCodec, vaultImageDir } from "@/vault/images";
import { migrateVaultSchema } from "./vaultSchema";
import { closeVaultDatabase, openVaultDatabase, vaultKeyForSubject } from "./db";

const fixture = vi.hoisted(() => ({ directory: "", failCopy: false }));
vi.mock("expo-file-system/legacy", () => ({
  get documentDirectory() {
    return `file://${fixture.directory}/`;
  },
}));
vi.mock("expo-sqlite", async () => {
  const { NodeSqliteDatabase: Sql } = await import("@/test-support/nodeSqlite");
  const fs = await import("node:fs");
  return {
    openDatabaseSync: (name: string) => new Sql(`${fixture.directory}/SQLite/${name}`),
    deleteDatabaseSync: (name: string) => fs.unlinkSync(`${fixture.directory}/SQLite/${name}`),
  };
});
vi.mock("expo-file-system", async () => {
  const fs = await import("node:fs");
  class Directory {
    constructor(readonly uri: string) {}
    get exists() {
      return fs.existsSync(this.uri.replace(/^file:\/\//, ""));
    }
    create() {
      fs.mkdirSync(this.uri.replace(/^file:\/\//, ""), { recursive: true });
    }
  }
  class File {
    readonly uri: string;
    constructor(base: string | Directory, name?: string) {
      this.uri = `${typeof base === "string" ? base : base.uri}${name ? `/${name}` : ""}`;
    }
    get exists() {
      return fs.existsSync(this.uri.replace(/^file:\/\//, ""));
    }
    copy(target: File) {
      if (fixture.failCopy) throw new Error("disk full");
      fs.copyFileSync(this.uri.replace(/^file:\/\//, ""), target.uri.replace(/^file:\/\//, ""));
    }
  }
  return { File, Directory };
});

beforeEach(() => {
  fixture.directory = mkdtempSync(path.join(process.cwd(), ".vault-adoption-"));
  fixture.failCopy = false;
  mkdirSync(`${fixture.directory}/SQLite`);
  mkdirSync(`${fixture.directory}/local-images`);
  writeFileSync(`${fixture.directory}/local-images/img_original`, Uint8Array.from([1, 2, 3]));
  const legacy = new NodeSqliteDatabase(`${fixture.directory}/SQLite/kyarafit.db`);
  migrateVaultSchema(legacy, "owner");
  const store = new VaultStore({ subject: "owner", sql: legacy, newId: () => "local:legacy" });
  store.commit((db) =>
    db.insert("builds", {
      userId: "owner",
      name: "Legacy",
      status: "idea",
      imageUrl: `file://${fixture.directory}/local-images/img_original`,
    })
  );
  legacy.closeSync();
});
afterEach(() => {
  closeVaultDatabase();
  rmSync(fixture.directory, { recursive: true, force: true });
});

describe("legacy photo adoption", () => {
  it("keeps the original available after editing and reopening", () => {
    const imageDir = vaultImageDir(`file://${fixture.directory}/`, vaultKeyForSubject("owner"));
    const createStore = () =>
      new VaultStore({
        subject: "owner",
        sql: openVaultDatabase("owner"),
        newId: () => "local:new",
        codec: vaultImageCodec(imageDir),
      });
    const store = createStore();
    store.commit((db) => db.patch("local:legacy", { name: "Edited" }));
    closeVaultDatabase();
    const reopened = createStore();
    expect(reopened.reader().get("local:legacy")?.imageUrl).toBe(`${imageDir}img_original`);
    const original = readFileSync(`${imageDir}img_original`.replace(/^file:\/\//, ""));
    expect([...original]).toEqual([1, 2, 3]);
  });

  it("leaves adoption uncommitted when copying an existing original fails", () => {
    fixture.failCopy = true;
    const db = openVaultDatabase("owner");
    expect(db.getAllSync("SELECT * FROM entity_rows")).toEqual([]);
    expect(existsSync(`${fixture.directory}/SQLite/kyarafit.db`)).toBe(true);
    closeVaultDatabase();
    fixture.failCopy = false;
    expect(openVaultDatabase("owner").getAllSync("SELECT * FROM entity_rows")).toHaveLength(1);
  });
});
