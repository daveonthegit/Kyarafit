# ADR-0005 — Managed sync is a Convex row replica; domain tables are published projections

Date: 2026-10-20 · Decision status: accepted (owner approved the sync spike's six
recommendations) · Implementation status: implemented (mobile); staging gate pending

## Context

ADR-0004 made the per-account vault authoritative but kept the old Convex path for paid sync:
replaying queued domain commands, a warm-up pull over `sync.listChangedSince`, and an upgrade
backfill. That path skipped records across tables (one max-timestamp cursor over independently
limited scans), had no delete stream, rewrote server ids, and could park an expired-online
session's writes as failed. A bounded spike compared a narrow Convex row replica with
Postgres + PowerSync on the same scenarios. Both converged; Convex needed no new database,
native module or fixed cost.

## Decision

1. **Convex row replica.** Devices replicate row state, not commands: one field patch or delete
   per changed vault row, keyed by the vault's own id (`convex/replica.ts`,
   `mobile/src/vault/replica`). Every applied op takes a per-account `rev`; pulls page over it, so
   a cursor always acknowledges a complete prefix. The legacy mobile replay, warm-up and backfill
   path is deleted. PowerSync remains the fallback if the staging gate fails.
2. **Conflicts are kept, not lost.** Per field, the later arrival at the server wins and delete
   wins; every losing value is recorded and streamed to devices. Each build shows "changes that
   didn't apply", restorable with one tap as a new edit (Settings → Offline lists all of them).
3. **Cross-row integrity on the server.** A row put under a deleted parent, or left under a parent
   another device deletes, is repaired: build content moves to a visible "Recovered" build,
   elements and optional links are unlinked, and rows that cannot exist without their parent are
   removed with a restorable record (`REPLICA_LINK_RULES`).
4. **Opaque replica documents plus a typed asset table.** Replica docs carry
   `kyarafit-image:<key>` tokens; the blob behind each key is registered in `replicaAssets`, so
   media access, the hosted-media quota, downgrade purge and account deletion see it.
5. **90-day retention.** Op dedupe records, tombstones and conflict records older than 90 days are
   purged daily. A device whose cursor predates purged history resnapshots: it pulls the whole
   replica and drops synced rows the replica no longer has, keeping its own unsynced edits.
6. **Domain tables are published projections.** `builds`, `conventions`, … are written only by an
   explicit publish (`convex/publications.ts`): inviting a collaborator or adding a build or
   convention to a group publishes (or refreshes) its server copy first. Nothing flows back into
   the vault; deleting a published vault row removes its server copy once online.

Standing product decisions are unchanged: an account is required, the app is fully usable offline
after sign-in, and signing out keeps local data.

## Consequences

- Free vaults record nothing and make no personal-data calls; replication starts on the first
  confirmed paid session and pauses (never discards) on a lapsed plan or expired session.
- **The staging gate is still open.** Scenario tests run on `convex-test` in CI and can target a
  real non-production deployment (docs/TESTING.md); they have not yet run on one. Optimistic
  concurrency on the per-account head and transaction limits are only verifiable there.
- Web has no vault yet: it keeps its legacy worker and the server endpoints it calls
  (`sync.listChangedSince`, `tierTransition.backfillRows`). For an account using both platforms,
  web edits domain rows that mobile no longer reads, until web gets a vault.
- Collaborator edits to a published copy are not merged back into the owner's vault, and a
  re-publish overwrites the copy's content fields. Social settings on the copy (visibility, share
  token, group) are kept.
- Rows synced by the legacy path are uploaded to the replica under their existing vault ids when a
  device enables replication. A second legacy device that pulled the same records under server
  ids would upload them as separate rows; there are no paying users today, so no migration was
  written.
