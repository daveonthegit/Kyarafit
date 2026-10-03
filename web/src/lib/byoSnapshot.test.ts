import { describe, expect, it } from "vitest";
import {
  BYO_PERSONAL_TABLES,
  BYO_TOMBSTONE_RETENTION_MS,
  emptyByoSnapshot,
  parseByoSnapshot,
  serializeByoSnapshot,
  SnapshotFormatError,
  validateByoSnapshot,
  type ByoSnapshot,
  type ByoSnapshotRecord,
  compactByoTombstones,
  mergeByoSnapshots,
  mergeMediaManifests,
} from "@kyarafit/design-system/domain";
import fixture from "./fixtures/byoSnapshot.v1.json";

const hash = "a".repeat(64);
const secondHash = "b".repeat(64);

function row(overrides: Partial<ByoSnapshotRecord> = {}): ByoSnapshotRecord {
  return {
    id: "build-local-1",
    updatedAt: 10,
    deletedAt: null,
    data: { title: "Original", nested: { values: [null, true, 1] } },
    mediaHashes: [],
    ...overrides,
  };
}

function snapshot(...rows: ByoSnapshotRecord[]): ByoSnapshot {
  const result = emptyByoSnapshot();
  result.tables.builds = rows;
  return result;
}

function frozen<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}

// Seeded generation deliberately includes equal clocks, skew, deletes and compact markers.
// No new property-testing dependency: trials are reproducible on web and Convex toolchains.
function randomSnapshots(seed: number) {
  let state = seed;
  function random(max: number): number {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 8) % max;
  }
  return function generate(): ByoSnapshot {
    const result = emptyByoSnapshot();
    result.media = [{ hash, byteLength: 4 }];
    if (random(2)) result.media.push({ hash: secondHash, byteLength: 8 });
    for (const table of BYO_PERSONAL_TABLES) {
      for (let i = 0; i < 4; i++) {
        const kind = random(4);
        const updatedAt = random(4) * 1_000_000;
        if (kind === 0) continue;
        if (kind === 1) {
          result.retired[table].push({ id: String(i), updatedAt, deletedAt: updatedAt });
        } else {
          result.tables[table].push(
            row({
              id: String(i),
              updatedAt,
              deletedAt: kind === 2 ? updatedAt : null,
              data: { value: random(5), nested: { b: random(3), a: "x" } },
              mediaHashes: random(2) ? [hash] : [],
            })
          );
        }
      }
    }
    return result;
  };
}

describe("BYO snapshot record-level convergence", () => {
  it("is commutative, associative and idempotent across 200 reproducible trials", () => {
    const generate = randomSnapshots(149);
    for (let trial = 0; trial < 200; trial++) {
      const [a, b, c] = [generate(), generate(), generate()];
      expect(mergeByoSnapshots(a, b)).toEqual(mergeByoSnapshots(b, a));
      expect(mergeByoSnapshots(a, a)).toEqual(validateByoSnapshot(a));
      expect(mergeByoSnapshots(mergeByoSnapshots(a, b), c)).toEqual(
        mergeByoSnapshots(a, mergeByoSnapshots(b, c))
      );
    }
  });

  it("selects an entire newer record, not a field-level merge", () => {
    const a = snapshot(row({ data: { title: "old", note: "only on A" } }));
    const b = snapshot(row({ updatedAt: 11, data: { title: "new" } }));
    expect(mergeByoSnapshots(a, b).tables.builds).toEqual(b.tables.builds);
  });

  it("breaks equal-clock ties by canonical JSON, independent of object insertion order", () => {
    const a = snapshot(row({ data: { title: "a", note: "same" } }));
    const b = snapshot(row({ data: { note: "same", title: "z" } }));
    expect(mergeByoSnapshots(a, b).tables.builds[0].data.title).toBe("z");
    expect(serializeByoSnapshot(mergeByoSnapshots(a, b))).toBe(
      serializeByoSnapshot(mergeByoSnapshots(b, a))
    );
    expect(serializeByoSnapshot(a)).toBe(
      serializeByoSnapshot(snapshot(row({ data: { note: "same", title: "a" } })))
    );
  });

  it("uses deletion time as a write and prefers deletion at equal effective clocks", () => {
    const deleted = snapshot(row({ updatedAt: 1, deletedAt: 20 }));
    for (const updatedAt of [1, 10, 20]) {
      expect(
        mergeByoSnapshots(deleted, snapshot(row({ updatedAt }))).tables.builds[0].deletedAt
      ).toBe(20);
    }
    expect(
      mergeByoSnapshots(deleted, snapshot(row({ updatedAt: 21 }))).tables.builds[0].deletedAt
    ).toBe(null);
  });

  it("does not rewrite skewed clocks; a future tombstone cannot be expired early", () => {
    const future = snapshot(row({ updatedAt: 1_000_000, deletedAt: 1_000_000 }));
    expect(mergeByoSnapshots(future, snapshot(row({ updatedAt: 100 }))).tables.builds[0]).toEqual(
      future.tables.builds[0]
    );
    expect(compactByoTombstones(future, 100)).toEqual(future);
  });

  it("does not mutate inputs or share result payloads with callers", () => {
    const a = frozen(snapshot(row()));
    const b = frozen(snapshot(row({ updatedAt: 12 })));
    const output = mergeByoSnapshots(a, b);
    output.tables.builds[0].data.title = "mutated";
    expect(a.tables.builds[0].data.title).toBe("Original");
    expect(b.tables.builds[0].data.title).toBe("Original");
  });

  it("keeps identities scoped to their table", () => {
    const a = snapshot(row());
    const b = emptyByoSnapshot();
    b.tables.conventions = [row({ updatedAt: 100 })];
    const result = mergeByoSnapshots(a, b);
    expect(result.tables.builds).toHaveLength(1);
    expect(result.tables.conventions).toHaveLength(1);
  });
});

describe("BYO deletion retention", () => {
  it("retains full tombstones until 90 days, then removes payload and retains a compact barrier", () => {
    const deleted = snapshot(row({ updatedAt: 20, deletedAt: 20, mediaHashes: [hash] }));
    deleted.media = [{ hash, byteLength: 4 }];
    expect(compactByoTombstones(deleted, 20 + BYO_TOMBSTONE_RETENTION_MS - 1)).toEqual(deleted);
    const compact = compactByoTombstones(deleted, 20 + BYO_TOMBSTONE_RETENTION_MS);
    expect(compact.tables.builds).toEqual([]);
    expect(compact.retired.builds).toEqual([{ id: "build-local-1", updatedAt: 20, deletedAt: 20 }]);
    expect(compact.media).toEqual(deleted.media); // No remote byte deletion in the pure engine.
    expect(compactByoTombstones(compact, 20 + BYO_TOMBSTONE_RETENTION_MS)).toEqual(compact);
  });

  it("cannot resurrect from old exports after compaction or re-upload the retired payload", () => {
    const old = snapshot(row());
    const deleted = snapshot(row({ updatedAt: 20, deletedAt: 20 }));
    const compact = compactByoTombstones(deleted, 20 + BYO_TOMBSTONE_RETENTION_MS);
    const restored = parseByoSnapshot(serializeByoSnapshot(compact));
    expect(mergeByoSnapshots(restored, old)).toEqual(compact);
    expect(mergeByoSnapshots(restored, deleted)).toEqual(compact);
    const intentionalRestore = mergeByoSnapshots(compact, snapshot(row({ updatedAt: 21 })));
    expect(intentionalRestore.retired.builds).toEqual([]);
    expect(intentionalRestore.tables.builds[0].deletedAt).toBeNull();
  });
});

describe("versioned BYO file contract", () => {
  it("round-trips a v1 export fixture with every personal table, relationships and media", () => {
    const parsed = validateByoSnapshot(fixture);
    expect(Object.keys(parsed.tables)).toEqual([...BYO_PERSONAL_TABLES]);
    for (const table of BYO_PERSONAL_TABLES) expect(parsed.tables[table]).toHaveLength(1);
    expect(parseByoSnapshot(serializeByoSnapshot(parsed))).toEqual(parsed);
    expect(parsed.tables.buildProgressUpdates[0].mediaHashes).toEqual([hash]);
    expect(parsed.tables.workflowAttachments[0].data.entityId).toBe("build-local-1");
  });

  it.each([0, 2, "1", null, undefined])("rejects unsupported schemaVersion %s", (schemaVersion) => {
    expect(() => validateByoSnapshot({ ...emptyByoSnapshot(), schemaVersion })).toThrow(
      SnapshotFormatError
    );
  });

  it("refuses truncated and malformed files rather than treating them as empty", () => {
    for (const serialized of ["{", "null", "[]", "{}", "x".repeat(10_000_001)]) {
      expect(() => parseByoSnapshot(serialized)).toThrow(SnapshotFormatError);
    }
    expect(() => validateByoSnapshot({ ...emptyByoSnapshot(), tokens: {} })).toThrow(
      SnapshotFormatError
    );
    expect(() => validateByoSnapshot({ ...emptyByoSnapshot(), tables: { builds: [] } })).toThrow(
      SnapshotFormatError
    );
  });

  it.each([-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects malformed clocks %s",
    (updatedAt) => {
      expect(() => validateByoSnapshot(snapshot(row({ updatedAt })))).toThrow(SnapshotFormatError);
      expect(() => compactByoTombstones(emptyByoSnapshot(), updatedAt)).toThrow(
        SnapshotFormatError
      );
    }
  );

  it("rejects missing data, unknown fields, duplicate ids and overlapping deletion markers", () => {
    expect(() => validateByoSnapshot(snapshot(row(), row()))).toThrow(SnapshotFormatError);
    const overlap = snapshot(row());
    overlap.retired.builds = [{ id: "build-local-1", updatedAt: 20, deletedAt: 20 }];
    expect(() => validateByoSnapshot(overlap)).toThrow(SnapshotFormatError);
    for (const malformed of [
      { ...row(), data: null },
      { ...row(), id: "" },
      { ...row(), deletedAt: "today" },
      { ...row(), fieldClock: {} },
      { ...row(), data: { missing: undefined } },
      { ...row(), data: { date: new Date() } },
      { ...row(), data: { float: Infinity } },
      { ...row(), data: { sparse: Array(2) } },
    ]) {
      const input = emptyByoSnapshot();
      expect(() =>
        validateByoSnapshot({ ...input, tables: { ...input.tables, builds: [malformed] } })
      ).toThrow(SnapshotFormatError);
    }
  });

  it("rejects cyclic/deep payloads and oversized collections", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const base = emptyByoSnapshot();
    expect(() =>
      validateByoSnapshot({
        ...base,
        tables: { ...base.tables, builds: [{ ...row(), data: cyclic }] },
      })
    ).toThrow(SnapshotFormatError);
    expect(() =>
      validateByoSnapshot(
        snapshot(...Array.from({ length: 100_001 }, (_, i) => row({ id: String(i) })))
      )
    ).toThrow(SnapshotFormatError);
  });

  it("round-trips payloads at the declared nesting limit", () => {
    let data: Record<string, unknown> = { value: "leaf" };
    for (let level = 0; level < 31; level++) data = { child: data };
    const input = snapshot(row());
    const validated = validateByoSnapshot({
      ...input,
      tables: { ...input.tables, builds: [{ ...row(), data }] },
    });
    expect(parseByoSnapshot(serializeByoSnapshot(validated))).toEqual(validated);
  });

  it("preserves unusual JSON property names without prototype pollution", () => {
    const input = snapshot(
      row({ data: JSON.parse('{"__proto__":{"polluted":true},"constructor":"value"}') })
    );
    const output = parseByoSnapshot(serializeByoSnapshot(input));
    expect(Object.prototype.hasOwnProperty.call(output.tables.builds[0].data, "__proto__")).toBe(
      true
    );
    expect(Object.getPrototypeOf(output.tables.builds[0].data)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call({}, "polluted")).toBe(false);
  });
});

describe("content-hash immutable-media manifest", () => {
  it("deduplicates and orders immutable hashes independently of manifest insertion order", () => {
    const a = [{ hash, byteLength: 4 }];
    const b = [{ hash: secondHash, byteLength: 0 }, ...a];
    expect(mergeMediaManifests(a, b)).toEqual(mergeMediaManifests(b, a));
    expect(mergeMediaManifests(b, b)).toEqual([...a, { hash: secondHash, byteLength: 0 }]);
  });

  it("rejects conflicting immutable metadata, invalid hashes/sizes and missing media", () => {
    expect(() => mergeMediaManifests([{ hash, byteLength: 4 }], [{ hash, byteLength: 5 }])).toThrow(
      SnapshotFormatError
    );
    for (const entry of [
      { hash: "storage-id", byteLength: 4 },
      { hash: hash.toUpperCase(), byteLength: 4 },
      { hash, byteLength: -1 },
      { hash, byteLength: 1.5 },
      { hash, byteLength: 4, url: "https://example.invalid/image" },
    ])
      expect(() => mergeMediaManifests([entry])).toThrow(SnapshotFormatError);
    expect(() => validateByoSnapshot(snapshot(row({ mediaHashes: [hash] })))).toThrow(
      SnapshotFormatError
    );
  });

  it("keeps the manifest union even when a losing record held the only reference", () => {
    const a = snapshot(row({ mediaHashes: [hash] }));
    a.media = [{ hash, byteLength: 4 }];
    const b = snapshot(row({ updatedAt: 20 }));
    expect(mergeByoSnapshots(a, b).media).toEqual(a.media);
    expect(mergeByoSnapshots(a, b).tables.builds[0].mediaHashes).toEqual([]);
  });
});
