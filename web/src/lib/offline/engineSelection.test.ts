import { describe, it, expect, vi } from "vitest";
import { selectLocalStoreEngine, type EngineSelectionDeps } from "./engineSelection";
import { InMemoryLocalStore, type LocalStore } from "./localStore";

// Spec: DATA_AND_SYNC.md §5. The engine factory must prefer OPFS + wa-sqlite when available and fall
// back to IndexedDB otherwise. We inject fake capability flags + engine constructors so the pure
// selection logic is tested WITHOUT instantiating real wa-sqlite (which cannot run under jsdom).

function makeDeps(overrides: Partial<EngineSelectionDeps> = {}): {
  deps: EngineSelectionDeps;
  waSqlite: LocalStore;
  fallback: LocalStore;
  createWaSqliteStore: ReturnType<typeof vi.fn>;
  createFallbackStore: ReturnType<typeof vi.fn>;
} {
  const waSqlite = new InMemoryLocalStore();
  const fallback = new InMemoryLocalStore();
  const createWaSqliteStore = vi.fn(async () => waSqlite);
  const createFallbackStore = vi.fn(() => fallback);
  const deps: EngineSelectionDeps = {
    detectCapabilities: () => ({ opfsAvailable: true }),
    createWaSqliteStore,
    createFallbackStore,
    ...overrides,
  };
  return { deps, waSqlite, fallback, createWaSqliteStore, createFallbackStore };
}

describe("selectLocalStoreEngine", () => {
  it("should_pick_wa_sqlite_when_opfs_available", async () => {
    const { deps, waSqlite, createWaSqliteStore, createFallbackStore } = makeDeps({
      detectCapabilities: () => ({ opfsAvailable: true }),
    });

    const store = await selectLocalStoreEngine(deps);

    expect(store).toBe(waSqlite);
    expect(createWaSqliteStore).toHaveBeenCalledOnce();
    expect(createFallbackStore).not.toHaveBeenCalled();
  });

  it("should_fall_back_to_indexeddb_when_opfs_unavailable", async () => {
    const { deps, fallback, createWaSqliteStore, createFallbackStore } = makeDeps({
      detectCapabilities: () => ({ opfsAvailable: false }),
    });

    const store = await selectLocalStoreEngine(deps);

    expect(store).toBe(fallback);
    expect(createFallbackStore).toHaveBeenCalledOnce();
    expect(createWaSqliteStore).not.toHaveBeenCalled();
  });

  it("should_fall_back_when_wa_sqlite_init_fails_despite_opfs_capability", async () => {
    const { deps, fallback, createFallbackStore } = makeDeps({
      detectCapabilities: () => ({ opfsAvailable: true }),
      createWaSqliteStore: vi.fn(async () => {
        throw new Error("opfs locked");
      }),
    });

    const store = await selectLocalStoreEngine(deps);

    expect(store).toBe(fallback);
    expect(createFallbackStore).toHaveBeenCalledOnce();
  });
});
