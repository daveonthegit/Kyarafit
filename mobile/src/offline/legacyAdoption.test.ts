import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodeSqliteDatabase } from "@/test-support/nodeSqlite";
import { VaultStore } from "@/vault/store";
import { vaultImageCodec, vaultImageDir } from "@/vault/images";
import { migrateVaultSchema } from "./vaultSchema";
import { closeVaultDatabase, getOfflineDb, openVaultDatabase, vaultKeyForSubject } from "./db";
import { getActiveVault, getVaultState, lockVault, unlockVault } from "@/vault/activeVault";

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
afterEach(async () => {
  await lockVault();
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
    expect(store.reader().get("local:legacy")?.imageUrl).toBe(`${imageDir}img_original`);
    expect(JSON.parse(openVaultDatabase("owner").getFirstSync<{ json: string }>("SELECT json FROM entity_rows")!.json).imageUrl).toBe("kyarafit-image:img_original");
    store.commit((db) => db.patch("local:legacy", { name: "Edited" }));
    closeVaultDatabase();
    const reopened = createStore();
    expect(reopened.reader().get("local:legacy")?.imageUrl).toBe(`${imageDir}img_original`);
    const original = readFileSync(`${imageDir}img_original`.replace(/^file:\/\//, ""));
    expect([...original]).toEqual([1, 2, 3]);
  });

  it("merges pending overlays onto synced records of the same table and id", () => {
    const legacy = new NodeSqliteDatabase(`${fixture.directory}/SQLite/kyarafit.db`);
    legacy.execSync("ALTER TABLE entity_rows RENAME TO original_rows; CREATE TABLE entity_rows AS SELECT * FROM original_rows; UPDATE entity_rows SET synced_at = 1;");
    legacy.runSync("INSERT INTO entity_rows VALUES (?, ?, ?, ?, ?, NULL, 0)", ["builds", "local:legacy", "owner", JSON.stringify({ userId: "owner", budgetCents: 400 }), 2]);
    legacy.closeSync();
    const store = new VaultStore({ subject: "owner", sql: openVaultDatabase("owner"), newId: () => "unused" });
    expect(store.reader().get("local:legacy")).toMatchObject({ name: "Legacy", status: "idea", budgetCents: 400 });
    expect(existsSync(`${fixture.directory}/SQLite/kyarafit.db`)).toBe(false);
  });

  it.each(["incomplete", "malformed"])("publishes a retryable vault error for %s legacy records", async (kind) => {
    const legacyPath = `${fixture.directory}/SQLite/kyarafit.db`;
    const legacy = new NodeSqliteDatabase(legacyPath);
    const json = kind === "malformed" ? "{invalid" : JSON.stringify({ _id: "local:legacy", userId: "owner", budgetCents: 400 });
    legacy.runSync("UPDATE entity_rows SET json = ?", [json]);
    legacy.closeSync();
    const account = { subject: "owner", lastVerifiedAt: 1 };
    await unlockVault(account);
    expect(getVaultState()).toMatchObject({ status: "error", account, message: expect.stringContaining("Incomplete legacy recovery") });
    expect(getActiveVault()).toBeNull();
    expect(() => getOfflineDb()).toThrow();
    expect(existsSync(legacyPath)).toBe(true);
    const retained = new NodeSqliteDatabase(legacyPath);
    expect(retained.getFirstSync<{ json: string }>("SELECT json FROM entity_rows")?.json).toBe(json);
    retained.runSync("UPDATE entity_rows SET json = ?", [JSON.stringify({ userId: "owner", name: "Recovered", status: "idea", budgetCents: 400 })]);
    retained.closeSync();
    await unlockVault(account);
    expect(getVaultState().status).toBe("unlocked");
    expect(getActiveVault()?.reader().get("local:legacy")).toMatchObject({ name: "Recovered", budgetCents: 400 });
  });

  it("publishes a retryable vault error when copying an original fails", async () => {
    fixture.failCopy = true;
    const account = { subject: "owner", lastVerifiedAt: 1 };
    await unlockVault(account);
    expect(getVaultState()).toMatchObject({ status: "error", account, message: "disk full" });
    expect(getActiveVault()).toBeNull();
    expect(() => getOfflineDb()).toThrow();
    expect(existsSync(`${fixture.directory}/SQLite/kyarafit.db`)).toBe(true);
    expect([...readFileSync(`${fixture.directory}/local-images/img_original`)]).toEqual([1, 2, 3]);
    fixture.failCopy = false;
    await unlockVault(account);
    expect(getVaultState().status).toBe("unlocked");
    expect(getActiveVault()?.reader().get("local:legacy")?.name).toBe("Legacy");
  });
});
