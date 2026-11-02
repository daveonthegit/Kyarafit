import { describe, it, expect } from "vitest";
import {
  OFFLINE_QUERY_SKIP,
  offlineQueryKey,
  stableStringify,
} from "@kyarafit/design-system/domain/offlineQueryCache";

describe("stableStringify", () => {
  it("is independent of object key order", () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it("preserves array order", () => {
    expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
  });

  it("sorts nested object keys recursively", () => {
    expect(stableStringify({ x: { a: 1, b: 2 } })).toBe(stableStringify({ x: { b: 2, a: 1 } }));
  });
});

describe("offlineQueryKey", () => {
  it("returns null for skipped queries", () => {
    expect(offlineQueryKey("builds:list", OFFLINE_QUERY_SKIP)).toBeNull();
  });

  it("treats undefined args as an empty object", () => {
    expect(offlineQueryKey("builds:list", undefined)).toBe(offlineQueryKey("builds:list", {}));
  });

  it("produces equal keys for deep-equal args regardless of key order", () => {
    expect(offlineQueryKey("builds:list", { status: "wip", userId: "u1" })).toBe(
      offlineQueryKey("builds:list", { userId: "u1", status: "wip" })
    );
  });

  it("produces different keys for different args", () => {
    expect(offlineQueryKey("builds:list", { status: "wip" })).not.toBe(
      offlineQueryKey("builds:list", { status: "done" })
    );
  });

  it("namespaces by function name", () => {
    expect(offlineQueryKey("builds:list", {})).not.toBe(offlineQueryKey("closet:list", {}));
    expect(offlineQueryKey("builds:list", {})).toMatch(/^builds:list:/);
  });
});
