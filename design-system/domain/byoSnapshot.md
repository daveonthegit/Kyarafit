# BYO snapshot engine (v1)

Pure record-level merge for ADR-0003, exported through `@kyarafit/design-system/domain`.
This is **not wired into Settings, existing exports, managed sync, or Drive**. Managed sync's
per-field `offlineConflict` contract is unchanged.

## File contract

`kyarafit.json` contains `schemaVersion: 1`, `tables`, `retired`, and `media`.
`BYO_PERSONAL_TABLES` lists all twelve personal/local-first collections (the backfill/warm-up set).
Every collection appears, even when empty. Social, membership, auth, billing, and server state
are not personal snapshot collections.

- A record has `id`, `updatedAt`, `deletedAt` (number or null), JSON-object `data`, and `mediaHashes`.
- Ids and relationship fields must use stable portable/client identities. An adapter must map
  server ids, filter server-managed fields, and gather only the current account's personal data.
  The engine merges identity/clock envelopes; it does not authorize or validate table payloads.
- Timestamps are non-negative safe integer milliseconds. There is no implicit current time.
- `media` entries have a lowercase SHA-256 `hash` and integer `byteLength`. The immutable original
  file's name is its hash. Adapters compute and verify hashes; URLs, storage ids and hosted keys
  are not content hashes. Conflicting sizes for one hash fail as corruption.
- `retired` holds compact deletion markers (`id`, `updatedAt`, `deletedAt`), with no payload.

`parseByoSnapshot`, `validateByoSnapshot` and `serializeByoSnapshot` throw `SnapshotFormatError`
on unsupported schema versions, unknown/missing fields, duplicate ids (within a table), invalid
clocks, lossy/non-JSON payloads, or missing manifest entries. Input is copied, sorted, and normalized;
serialization is canonical. Limits are 100,000 records/markers total, 100,000 media entries,
32 JSON nesting levels, and 10,000,000 UTF-16 code units for serialized files. These are explicit
engine limits, not backend quota policies. Empty and missing remote files are different: a transport
returns null for a missing file, whereas malformed content must never be treated as empty.

Version 1 evolves the portable-bundle concept into a table/clock/media envelope; it does **not**
automatically reinterpret legacy `ExportBundle`/`DataBundle` rows lacking clocks. A future import
adapter must explicitly assign stable identities/clocks and convert fields. Future schema versions
need explicit, tested migrations before this decoder can accept them; unknown versions fail closed
so older clients cannot silently discard new data.

## Merge and deletion

`mergeByoSnapshots(a, b)` chooses one whole record per `(table, id)` using a total order:

1. Larger `max(updatedAt, deletedAt ?? 0)`.
2. At equal clocks, deletion beats live data.
3. Then larger `deletedAt`, larger `updatedAt`, compact marker over full tombstone, and finally
   lexicographically larger canonical record JSON (code-unit order, never locale-dependent).

Within compatible v1 files and consistent immutable-media metadata, merge is commutative,
associative and idempotent after normalization. Arrays and JSON-object insertion order do not
change the winner. Media manifests form a union, including unreferenced files; no byte deletion
or garbage collection occurs in the engine.

Clock skew is not corrected during merge: record LWW can lose an offline edit to a future clock.
Clamping relative to each reader's wall clock would break convergence. Devices must advance their
write clock beyond the observed record/deletion clock for an intentional edit or restoration.

`compactByoTombstones(snapshot, now)` removes full deleted records after 90 days since their latest
write/deletion and retains compact per-id markers **indefinitely**. Discarding all deletion
knowledge after 90 days would resurrect data from old exports/long-offline devices. Compact markers
block stale live records and stale full tombstones without retaining personal payloads or refs.
A strictly newer live write can deliberately restore an identity. Merge itself never ages records.

## Adapter seams (not implemented here)

- `ByoSnapshotTransport` is the B2 seam for read/write snapshot and content-hash media get/put-if-absent.
  Its implementation owns storage bootstrap, credentials, digest verification, network errors and
  retries. Account scoping and refresh/reconnect state live outside snapshot/export JSON.
  Concurrent writes are tolerated; orchestration must re-read/merge/push for convergence.
- `ByoMediaReferenceAdapter` is the **P2 compatibility seam** for extracting/restoring image refs.
  No mapping to legacy `imageRefs`, `_storage`, or future R2 media keys is guessed in this package.
- B3/B4 own export/import integration, local persistence, method switching and foreground triggers.

Tests: `npm test -w web -- src/lib/byoSnapshot.test.ts` exercises the public package interface,
including the checked-in v1 round-trip fixture and reproducible convergence-property trials.
