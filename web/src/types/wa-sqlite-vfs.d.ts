/**
 * Ambient types for the wa-sqlite example VFS we use as the OPFS storage backend.
 *
 * wa-sqlite ships runtime types for its core API (`SQLiteAPI`, the `SQLITE_*` constants) but NOT for
 * the example VFS classes under `src/examples/*`. We only consume `AccessHandlePoolVFS` (the
 * synchronous OPFS AccessHandle pool VFS), so we declare just the surface we touch here to keep
 * `strict` + `noImplicitAny` happy without pulling the whole example tree into the type graph.
 */
declare module "wa-sqlite/src/examples/AccessHandlePoolVFS.js" {
  /**
   * OPFS-backed VFS using `FileSystemSyncAccessHandle`. Works with the synchronous wa-sqlite build
   * (no Asyncify) and does NOT require cross-origin isolation (COOP/COEP). Runs on the main thread
   * in browsers that expose `createSyncAccessHandle`.
   */
  export class AccessHandlePoolVFS {
    constructor(directoryPath: string);
    /** Resolves once the OPFS access-handle pool has been acquired and is usable. */
    readonly isReady: Promise<void>;
    readonly name: string;
    close(): Promise<void>;
  }
}
