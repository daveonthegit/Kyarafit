import { describe, it, expect } from "vitest";
import { InMemoryImageBackend, LocalImageStore } from "./localImageStore";

/**
 * Web on-device local image store (PRODUCT_SPEC.md §3.1, REQ-011). FREE users keep image binaries
 * locally; the store persists/retrieves them by `imageKey`. The IndexedDB layer is injectable, so
 * here we exercise the store's logic against an in-memory backend with deterministic key/URL fakes.
 */

function makeStore() {
  let counter = 0;
  const objectUrls: Blob[] = [];
  const store = new LocalImageStore({
    backend: new InMemoryImageBackend(),
    generateKey: () => `local_${++counter}`,
    createObjectUrl: (blob) => {
      objectUrls.push(blob);
      return `blob:fake/${objectUrls.length}`;
    },
  });
  return { store };
}

function blob(text: string, type = "image/png"): Blob {
  return new Blob([text], { type });
}

describe("LocalImageStore (web on-device images, REQ-011)", () => {
  it("should_save_and_return_a_local_image_ref", async () => {
    const { store } = makeStore();

    const saved = await store.save(blob("aerith"));

    expect(saved.imageKey).toBe("local_1");
    expect(saved.ref).toEqual({ kind: "local", uri: "blob:fake/1", imageKey: "local_1" });
    expect(saved.objectUrl).toBe("blob:fake/1");
  });

  it("should_get_an_object_url_for_a_stored_image", async () => {
    const { store } = makeStore();
    const saved = await store.save(blob("cloud"));

    const url = await store.getObjectUrl(saved.imageKey);

    expect(url).toBe("blob:fake/2");
  });

  it("should_return_null_for_an_unknown_image_key", async () => {
    const { store } = makeStore();

    expect(await store.getObjectUrl("missing")).toBeNull();
    expect(await store.getBlob("missing")).toBeNull();
  });

  it("should_delete_and_list_stored_images", async () => {
    const { store } = makeStore();
    const a = await store.save(blob("a"));
    const b = await store.save(blob("b"));

    expect((await store.list()).sort()).toEqual([a.imageKey, b.imageKey].sort());

    await store.delete(a.imageKey);

    expect(await store.list()).toEqual([b.imageKey]);
    expect(await store.getObjectUrl(a.imageKey)).toBeNull();
  });
});
