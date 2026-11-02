import { describe, it, expect } from "vitest";
import {
  entityRowToValues,
  entityRowFromValues,
  pendingMutationFromValues,
  isWaSqliteOpfsSupported,
} from "./waSqliteStore";
import type { StoredEntityRow } from "./localStore";

// Spec: DATA_AND_SYNC.md §5. These cover the wa-sqlite engine's PURE helpers only (row
// (de)serialization + capability probe). The wa-sqlite WASM/OPFS engine itself is never
// instantiated here — it cannot run under jsdom — that path is exercised in real browsers.

describe("entity row (de)serialization", () => {
  const row: StoredEntityRow = {
    table: "builds",
    id: "local:b1",
    userId: "user_1",
    json: '{"name":"Mei"}',
    updatedAt: 1700,
    deleted: false,
    synced: true,
  };

  it("serializes booleans to 0/1 integers in column order", () => {
    expect(entityRowToValues(row)).toEqual([
      "builds",
      "local:b1",
      "user_1",
      '{"name":"Mei"}',
      1700,
      0, // deleted
      1, // synced
    ]);
  });

  it("round-trips through serialize -> deserialize", () => {
    expect(entityRowFromValues(entityRowToValues(row))).toEqual(row);
  });

  it("coerces integer flags back to booleans", () => {
    const deleted = entityRowFromValues(["builds", "b2", "u", "{}", 5, 1, 0]);
    expect(deleted.deleted).toBe(true);
    expect(deleted.synced).toBe(false);
  });
});

describe("pendingMutationFromValues", () => {
  it("maps SQLite rows to PendingMutation, preserving a null client_id", () => {
    expect(pendingMutationFromValues([7, "key-1", "builds.create", "{}", 2, null])).toEqual({
      id: 7,
      idempotency_key: "key-1",
      fn: "builds.create",
      args_json: "{}",
      retry_count: 2,
      client_id: null,
    });
  });

  it("keeps a present client_id as a string", () => {
    const mutation = pendingMutationFromValues([1, "k", "fn", "{}", 0, "local:abc"]);
    expect(mutation.client_id).toBe("local:abc");
  });
});

describe("isWaSqliteOpfsSupported", () => {
  it("returns false in the jsdom test environment (no OPFS sync access handles)", () => {
    expect(isWaSqliteOpfsSupported()).toBe(false);
  });
});
