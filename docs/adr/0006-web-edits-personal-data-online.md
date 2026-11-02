# ADR-0006 — Web edits personal data online again

Date: 2026-11-02 · Decision status: accepted (owner decision, 2026-11-02) · Implementation
status: implemented (web) · Supersedes: the web portion of
[ADR-0005](0005-managed-sync-is-a-convex-row-replica.md) ("Web has no vault yet: personal-data
views show published projections read-only")

## Context

ADR-0005 made the domain tables (`builds`, `conventions`, `cosplayNodes`, …) published projections
of the mobile vault and stopped web from writing them. The refusal lived only in the web client
(`useOfflineMutation` threw before calling Convex); the server mutations still accept
session-authenticated writes.

The mobile app was never published. Every real Kyarafit user works on the web, including an active
account with hundreds of builds, so the read-only web left them with a viewer. The owner chose to
turn web editing back on before releasing the Glass Studio redesign.

## Decision

1. **Web writes personal data straight to Convex while online.** `useOfflineMutation` no longer
   refuses the personal modules (builds, conventions, elements/cosplayNodes, build tasks, workflow,
   reference and process pictures, progress updates, the development seed). It calls the existing
   server mutation, which authenticates the session actor and validates ownership as before. No
   server or schema change is needed.
2. **No offline writes on web.** Web still has no vault: an edit made offline is refused before it
   is sent or queued, and nothing is written to the browser's local store.
3. **Failures are visible.** Every failed web write (offline, validation, server error) is reported
   once in a transient glass toast (`WriteFailureToast`), replacing the blocking `window.alert` the
   refusal used. It shows only while its condition holds, so it fits ADR-0002.
4. **Notices follow the behaviour.** The "web shows published copies only" copy is removed.
   Settings → Backup & data says web edits save to the account right away and need a connection.

## Consequences

- For web, the domain tables are again the user's primary copy, as they are on the live site.
- **Tension with ADR-0005 §6, deferred.** Mobile's publish model treats domain rows as overwritable
  projections of the vault: a re-publish overwrites a copy's content fields, and nothing flows back
  into the vault. If the mobile app ships with managed sync while web keeps editing domain rows,
  a mobile publish could overwrite web edits. This is moot while mobile is unpublished. It must be
  resolved (for example by giving web a vault, or by publishing from the domain row) before mobile
  launches with web editing still on.
- Web restore, command replay, the domain pull and upgrade backfill stay removed. Export fetches the
  account's server rows on demand and merges the browser's retained local store (server copy wins);
  offline it exports the local store alone and says so.
- Social actions (groups, collaborators, likes, comments) are unchanged.
- Behavioural coverage: `web/src/lib/offline/webPersonalWrites.test.tsx` sends one call per web
  personal mutation through `useOfflineMutation`, online and offline.
