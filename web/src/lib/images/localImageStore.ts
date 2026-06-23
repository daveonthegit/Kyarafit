/**
 * Web on-device local image store (PRODUCT_SPEC.md §3.1, REQ-011). The web equivalent of mobile's
 * FileSystem document-dir store: FREE users keep image binaries LOCALLY (in the browser, via
 * IndexedDB) indefinitely — no cloud upload — and those binaries are included in export.
 *
 * Images are keyed by a stable `imageKey` (the durable handle persisted inside a `local` `ImageRef`).
 * For display the store hands back object URLs. The underlying IndexedDB layer is INJECTABLE
 * (`LocalImageBackend`) so the store's logic is unit-testable with an in-memory fake without a real
 * IndexedDB (jsdom has none); production uses the `idb`-backed default.
 */
import { openDB, type IDBPDatabase } from "idb";
import { localImageRef, type ImageRef } from "@kyarafit/design-system/domain/imageRef";

/** A stored image binary plus its metadata, keyed by `imageKey`. */
export interface StoredImageRecord {
  imageKey: string;
  blob: Blob;
  contentType: string;
  createdAt: number;
}

/** Pluggable key-value backend for image blobs. The IndexedDB layer implements this. */
export interface LocalImageBackend {
  put(record: StoredImageRecord): Promise<void>;
  get(imageKey: string): Promise<StoredImageRecord | undefined>;
  delete(imageKey: string): Promise<void>;
  /** All stored `imageKey`s. */
  list(): Promise<string[]>;
}

const DB_NAME = "kyarafit-local-images";
const STORE_NAME = "images";

/** Default IndexedDB-backed implementation (browser only). */
export class IndexedDbImageBackend implements LocalImageBackend {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private db(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, 1, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: "imageKey" });
          }
        },
      });
    }
    return this.dbPromise;
  }

  async put(record: StoredImageRecord): Promise<void> {
    const db = await this.db();
    await db.put(STORE_NAME, record);
  }

  async get(imageKey: string): Promise<StoredImageRecord | undefined> {
    const db = await this.db();
    return (await db.get(STORE_NAME, imageKey)) as StoredImageRecord | undefined;
  }

  async delete(imageKey: string): Promise<void> {
    const db = await this.db();
    await db.delete(STORE_NAME, imageKey);
  }

  async list(): Promise<string[]> {
    const db = await this.db();
    return (await db.getAllKeys(STORE_NAME)) as string[];
  }
}

/** In-memory backend — used by tests and as a safe fallback where IndexedDB is unavailable. */
export class InMemoryImageBackend implements LocalImageBackend {
  private readonly store = new Map<string, StoredImageRecord>();

  async put(record: StoredImageRecord): Promise<void> {
    this.store.set(record.imageKey, record);
  }

  async get(imageKey: string): Promise<StoredImageRecord | undefined> {
    return this.store.get(imageKey);
  }

  async delete(imageKey: string): Promise<void> {
    this.store.delete(imageKey);
  }

  async list(): Promise<string[]> {
    return [...this.store.keys()];
  }
}

function defaultGenKey(): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `local_${rand}`;
}

function defaultCreateObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export interface LocalImageStoreDeps {
  backend?: LocalImageBackend;
  /** Override object-URL creation (tests / environments without `URL.createObjectURL`). */
  createObjectUrl?: (blob: Blob) => string;
  /** Override `imageKey` generation (deterministic tests). */
  generateKey?: () => string;
}

export interface SavedLocalImage {
  imageKey: string;
  /** Object URL for immediate display (ephemeral; re-resolve via `getObjectUrl(imageKey)`). */
  objectUrl: string;
  /** The durable `local` `ImageRef` to persist on the entity. */
  ref: ImageRef;
}

/**
 * Stores/retrieves FREE users' on-device image binaries by `imageKey`. The persisted `local`
 * `ImageRef`'s `uri` is an object URL for immediate display; `imageKey` is the durable handle used
 * to re-resolve the blob (e.g. after reload) via `getObjectUrl`.
 */
export class LocalImageStore {
  private readonly backend: LocalImageBackend;
  private readonly createObjectUrl: (blob: Blob) => string;
  private readonly generateKey: () => string;

  constructor(deps: LocalImageStoreDeps = {}) {
    this.backend = deps.backend ?? new IndexedDbImageBackend();
    this.createObjectUrl = deps.createObjectUrl ?? defaultCreateObjectUrl;
    this.generateKey = deps.generateKey ?? defaultGenKey;
  }

  /** Persist a picked image blob locally and return its durable `local` `ImageRef`. */
  async save(
    blob: Blob,
    opts: { imageKey?: string; contentType?: string } = {}
  ): Promise<SavedLocalImage> {
    const imageKey = opts.imageKey ?? this.generateKey();
    const contentType = opts.contentType ?? blob.type ?? "image/jpeg";
    await this.backend.put({ imageKey, blob, contentType, createdAt: Date.now() });
    const objectUrl = this.createObjectUrl(blob);
    return { imageKey, objectUrl, ref: localImageRef(objectUrl, imageKey) };
  }

  /** Resolve a stored image to a fresh object URL, or null when the key is unknown. */
  async getObjectUrl(imageKey: string): Promise<string | null> {
    const record = await this.backend.get(imageKey);
    if (!record) return null;
    return this.createObjectUrl(record.blob);
  }

  /** Raw blob for an `imageKey` (e.g. to include in export), or null when unknown. */
  async getBlob(imageKey: string): Promise<Blob | null> {
    const record = await this.backend.get(imageKey);
    return record?.blob ?? null;
  }

  async delete(imageKey: string): Promise<void> {
    await this.backend.delete(imageKey);
  }

  async list(): Promise<string[]> {
    return this.backend.list();
  }
}

/** Shared singleton store for app code (browser). Tests construct their own with a fake backend. */
let sharedStore: LocalImageStore | null = null;
export function getLocalImageStore(): LocalImageStore {
  if (!sharedStore) sharedStore = new LocalImageStore();
  return sharedStore;
}
