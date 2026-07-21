# BYO sync uses a merged snapshot file with per-record LWW, not an op-log or CRDT

Free-tier multi-device sync ("BYO sync") writes a single versioned snapshot (`kyarafit.json`,
`schemaVersion` field, every record carrying `updatedAt`) plus a sibling folder of immutable
original media files named by content hash into storage the user owns (Google Drive first, via the
non-sensitive `drive.file` scope, piggybacking on the existing Better Auth Google client through
incremental consent). Devices converge by downloading, merging per-record last-writer-wins,
applying locally, and re-uploading; deletes are tombstones (`deletedAt`, retained ~90 days) so an
older snapshot cannot resurrect a deleted record. We deliberately rejected op-logs and CRDTs: for
one person's wardrobe data on two-ish devices, record-level LWW only loses data when the same
record is edited offline on two devices in the same window, and that cost is far below the
complexity of a CRDT engine. Concurrent snapshot uploads are tolerated, not locked against —
merge is commutative given LWW + tombstones, so the next read converges. Exactly one remote is
authoritative for personal data at a time: sync method is a mutually exclusive Settings choice
(`Off / Google Drive / Kyarafit Cloud`), and the `cloud_sync` entitlement means precisely "may
select Kyarafit Cloud (managed sync)". The snapshot format lives in users' own Drive folders, so
changing it later requires versioned migration forever — hence `schemaVersion` from day one. The
merge engine is pure functions in `@kyarafit/design-system/domain` behind a transport interface;
Drive/iCloud/manual-file are adapters.
