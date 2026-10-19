# ADR-0004 — The per-account local vault is the authoritative home of personal data

Date: 2026-10-18 · Decision status: accepted · Implementation status: implemented (mobile)

## Context

The owner wants an offline-focused cosplay planner that is as free as possible, with paid features
for online use. Accounts are required, but once signed in the app must be fully usable offline.
The architecture review of the Glass branch found the opposite in code: personal-data hooks always
asked Convex first and used SQLite only as a fallback cache, creation and photo flows required an
upload, sign-out deleted the local database, failed local writes could return a fake id, and storage
maintenance could evict queued operations and id mappings.

## Decision

- **One vault per account.** Each signed-in account gets its own SQLite file
  (`kyarafit-vault-<key>.db`) and photo directory. It is the source of truth for builds, elements,
  tasks, conventions, day plans, packing and photo references — for free and paid users, online or
  offline. Screens read and write it through local handlers keyed by the existing Convex function
  names (`mobile/src/vault/handlers`); the UI never calls Convex for personal data.
- **Sign-out locks; it does not delete.** Only "Remove from this device" (Settings → Data) or
  account deletion deletes a vault, after explicit confirmation.
- **Durable offline sign-in.** After the first online sign-in the persisted account record unlocks
  its vault at launch with no network. A missing, slow or expired remote session never blocks local
  use; an expired session shows a transient "sign in again" notice and blocks only online features.
- **Writes are transactional and loud.** A command commits its rows (and, for paid vaults, its
  replication intent) in one SQLite transaction and resolves only after commit; failures throw
  `VaultWriteError` and are surfaced once app-wide.
- **The replication queue and id map are never evicted.** Only the disposable online-query cache is
  size-capped.
- **Photos are saved into the vault first** and stored as portable `kyarafit-image:<key>` tokens.
  Uploading is a paid-sync step, never a prerequisite for creating anything.

## Consequences

- Free users make no personal-data Convex calls; online-only surfaces (social, groups,
  collaborators, public pages, billing, profile) still call Convex and fail fast offline.
- Builds shared by others are not in the viewer's vault; they open read-only through the online
  viewer.
- The existing Convex replication path (queue drain, warm-up pull, upgrade backfill) is retained
  but not extended. Its correctness gaps (cursor pagination, tombstones, conflict policy) and the
  paid sync provider choice (Convex vs. PowerSync) are the next decision, not settled here.
- Delivered in follow-up pull requests, per the owner's split decision: a free whole-vault backup
  and restore that includes original photos (stacked on this change), and web account isolation
  plus visible write failures (independent). Converting web's cloud-first reads/writes and removing
  personal-data Convex calls for free web users is deferred beyond those.
- The paid-sync replay protocol (server-side reconciliation of every row a queued command creates,
  so replays never duplicate rows or leave unmapped local ids) is set aside for the paid-sync step.
  Until then the existing replay maps only the creates it already supported.
