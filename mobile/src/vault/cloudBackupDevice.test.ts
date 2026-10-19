import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestVault } from "@/test-support/vaultHarness";
import { __setActiveVaultForTests } from "./activeVault";
import { setOfflineConnectivity } from "@/offline/connectivity";
import { writeVaultBackup } from "./portabilityDevice";
import { readVaultArchiveImages, readVaultArchiveManifest } from "./archive";

const fs = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  directories: new Set<string>(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, Share: {} }));
vi.mock("expo-file-system", () => {
  const uri = (parts: (string | { uri: string })[]) =>
    parts.map((part) => (typeof part === "string" ? part : part.uri).replace(/\/$/, "")).join("/");
  class Directory {
    readonly uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = uri(parts);
    }
    get exists() {
      return fs.directories.has(this.uri);
    }
    create() {
      fs.directories.add(this.uri);
    }
  }
  class File {
    readonly uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = uri(parts);
    }
    get exists() {
      return fs.files.has(this.uri);
    }
    get size() {
      return fs.files.get(this.uri)?.length ?? 0;
    }
    create() {
      fs.files.set(this.uri, new Uint8Array());
    }
    delete() {
      fs.files.delete(this.uri);
    }
    write(bytes: Uint8Array) {
      fs.files.set(this.uri, Uint8Array.from(bytes));
    }
    bytesSync() {
      return fs.files.get(this.uri)!;
    }
    open() {
      return {
        close: () => {},
        writeBytes: (bytes: Uint8Array) => {
          const previous = fs.files.get(this.uri)!;
          const next = new Uint8Array(previous.length + bytes.length);
          next.set(previous);
          next.set(bytes, previous.length);
          fs.files.set(this.uri, next);
        },
      };
    }
  }
  return { Directory, File, Paths: { cache: { uri: "file:///cache" } } };
});

const PHOTO = Uint8Array.from([1, 2, 3, 4]);
beforeEach(() => {
  fs.files.clear();
  fs.directories.clear();
  setOfflineConnectivity(true);
  const vault = makeTestVault({ subject: "owner" });
  vault.store.commit((db) =>
    db.insert("builds", {
      userId: "owner",
      name: "Cloud",
      status: "idea",
      imageStorageId: "storage",
    })
  );
  __setActiveVaultForTests(vault.store);
});
afterEach(() => {
  __setActiveVaultForTests(null);
  vi.unstubAllGlobals();
  setOfflineConnectivity(true);
});

describe("device cloud-original backup", () => {
  it("resolves and fetches the original and streams its bytes into the archive", async () => {
    const resolve = vi.fn(async () => "https://example.com/original");
    const fetch = vi.fn(async () => new Response(PHOTO));
    vi.stubGlobal("fetch", fetch);
    const backup = await writeVaultBackup(resolve);
    expect(resolve).toHaveBeenCalledWith("storage");
    expect(fetch).toHaveBeenCalledWith("https://example.com/original");
    expect(backup.summary).toMatchObject({ images: 1, missingImages: [] });
    const bytes = fs.files.get(backup.uri)!;
    let offset = 0;
    const reader = {
      read: (length: number) => {
        const result = bytes.subarray(offset, offset + length);
        offset += length;
        return result;
      },
    };
    const manifest = readVaultArchiveManifest(reader);
    const originals: Uint8Array[] = [];
    readVaultArchiveImages(reader, manifest, (_key, image) => originals.push(image));
    expect(originals).toEqual([PHOTO]);
    expect(manifest.rows[0].doc.imageStorageId).toBeUndefined();
    expect(manifest.rows[0].doc.imageUrl).toBe(`kyarafit-image:${manifest.images[0].key}`);
  });

  it("does not request cloud originals offline and records the omission", async () => {
    setOfflineConnectivity(false);
    const resolve = vi.fn(async () => "https://example.com/original");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const backup = await writeVaultBackup(resolve);
    expect(resolve).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(backup.summary.images).toBe(0);
    expect(backup.summary.missingImages).toHaveLength(1);
  });

  it("stops after a vault switch while the URL request is pending", async () => {
    let finish!: (url: string) => void;
    const resolve = vi.fn(
      () =>
        new Promise<string>((done) => {
          finish = done;
        })
    );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const pending = writeVaultBackup(resolve);
    const rejected = expect(pending).rejects.toThrow("active account changed");
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledOnce());
    __setActiveVaultForTests(makeTestVault({ subject: "other" }).store);
    finish("https://example.com/original");
    await rejected;
    expect(fetch).not.toHaveBeenCalled();
    expect(fs.files.size).toBe(0);
  });
});
