# ADR-0002 — Status surfaces live in Settings, not floating chrome

Date: 2026-07-14 · Status: accepted

## Context

The Glass Studio redesign docs (`docs/redesign/03-component-changes.md`,
`04-screens.md` "Cross-cutting") specced `SyncStatus` as an omnipresent glass
chip pinned bottom-left above the tab bar on every studio screen. During the
phase-7.1 mobile device check the owner rejected it: a permanently visible
status chip competes with content ("constantly present annoying chip").

## Decision

Status readouts and their manual triggers (last-synced, pending count,
"Sync now") render inside Settings on both platforms:

- **Web:** `SyncStatus` is a "Cloud sync" section at the top of
  Settings → Backup & data (no longer mounted in `AppProviders`).
- **Mobile:** `SyncStatusSection` is a "Cloud sync" card on
  Settings → Offline (the earlier floating `SyncStatusChip` was removed).

The `shouldRunSyncWorker` gate, logic, and strings are unchanged — only
placement moved. **Transient** banners remain acceptable chrome: the offline
connectivity strip and the cloud-retention notice float below the status bar
only while their condition holds.

## Consequences

- REQ-D64's "sync state is always visible" is satisfied by the Settings
  surface plus the transient offline strip, not by persistent chrome.
- Where `docs/redesign/*` still says "SyncStatus glass chip bottom-left",
  this ADR supersedes it.
- New specs proposing persistent floating status chrome need explicit owner
  sign-off first.
