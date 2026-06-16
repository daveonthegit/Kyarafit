import { describe, it, expect } from "vitest";
import {
  LOCAL_ID_PREFIX,
  hasUnmappedClientId,
  isClientId,
  rewriteIdsDeep,
} from "@kyarafit/design-system/domain/offlineIdMap";

describe("isClientId", () => {
  it("recognizes prefixed client ids", () => {
    expect(isClientId(`${LOCAL_ID_PREFIX}abc`)).toBe(true);
  });

  it("rejects real ids and non-strings", () => {
    expect(isClientId("j97abc123")).toBe(false);
    expect(isClientId(undefined)).toBe(false);
    expect(isClientId(42)).toBe(false);
    expect(isClientId(null)).toBe(false);
  });
});

describe("rewriteIdsDeep", () => {
  const map = { "local:b1": "server-b1", "local:n2": "server-n2" } as const;

  it("rewrites a top-level string", () => {
    expect(rewriteIdsDeep("local:b1", map)).toBe("server-b1");
  });

  it("leaves unmapped strings (including unsynced client ids) untouched", () => {
    expect(rewriteIdsDeep("local:unsynced", map)).toBe("local:unsynced");
    expect(rewriteIdsDeep("plain", map)).toBe("plain");
  });

  it("rewrites nested object + array values, preserving keys and non-strings", () => {
    const input = {
      buildId: "local:b1",
      count: 3,
      flag: true,
      nodeIds: ["local:n2", "other"],
      nested: { ref: "local:b1" },
    };
    expect(rewriteIdsDeep(input, map)).toEqual({
      buildId: "server-b1",
      count: 3,
      flag: true,
      nodeIds: ["server-n2", "other"],
      nested: { ref: "server-b1" },
    });
  });

  it("does not mutate the input", () => {
    const input = { buildId: "local:b1" };
    rewriteIdsDeep(input, map);
    expect(input.buildId).toBe("local:b1");
  });
});

describe("hasUnmappedClientId", () => {
  const map = { "local:b1": "server-b1" } as const;

  it("is true when an unmapped client id is referenced", () => {
    expect(hasUnmappedClientId({ buildId: "local:unsynced" }, map)).toBe(true);
    expect(hasUnmappedClientId(["local:unsynced"], map)).toBe(true);
  });

  it("is false when all client ids are mapped or absent", () => {
    expect(hasUnmappedClientId({ buildId: "local:b1" }, map)).toBe(false);
    expect(hasUnmappedClientId({ name: "no ids here" }, map)).toBe(false);
  });
});
