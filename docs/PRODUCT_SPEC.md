# Kyarafit — Product Specification

_Source of truth for **what the product does**. Behavior, not implementation. For data/sync see
[`DATA_AND_SYNC.md`](DATA_AND_SYNC.md); architecture [`ARCHITECTURE.md`](ARCHITECTURE.md); UI
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). Requirement IDs (`REQ-*`) are referenced by
[`specs/refactor-test-plan.md`](specs/refactor-test-plan.md)._

Status: **Approved spec for refactor restart.** Supersedes all prior product docs (see
[`specs/doc-consolidation-plan.md`](specs/doc-consolidation-plan.md)).

---

## 1. Product vision

Kyarafit is a **mobile-first cosplay wardrobe and convention-planning app** for cosplayers who build
costumes and attend conventions. Users catalog the **elements** of a costume, organize them into
per-character **builds**, track progress with **photos and updates**, **plan conventions** day by
day, and auto-generate **packing lists** — all **local-first** so the core experience is free, fast,
and works offline. A **comprehensive social layer** (online-only) lets cosplayers share progress,
follow others, and collaborate in groups.

**Primary value proposition:** _"Plan, build, and track your cosplays in one place — free, offline,
and yours. Upgrade only when you want it everywhere."_

**What makes it different:** local-first (free users cost ~nothing and never lose access offline);
the **only** paid lever is cloud convenience (sync, backup, publishing); progress-photo-centric
build tracking tuned for the cosplay workflow.

### 1.1 Workflows that matter most (in priority order)

1. Create a build → add elements → track progress (status + photos + updates).
2. Plan a convention → assign builds to days → generate a packing list.
3. Work through build tasks (the planner) to finish a costume on time.
4. Share progress / discover others (social, online).

### 1.2 Preserve / simplify / remove

| Decision                         | Items                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Preserve** (must keep working) | Auth/accounts, Builds + build detail, Conventions + day plans, Packing lists, Planner/tasks, Subscription/billing, Images   |
| **Simplify**                     | Elements model (one canonical model, managed per-build); Planner **UX/presentation** (model stays, see §4.5); navigation/IA |
| **Remove**                       | `closetItems` legacy model, `buildTasks` table/shim, standalone Closet page, Python background-removal image service        |

---

## 2. Users & roles

| Role                        | Description                                                             | Source                                              |
| --------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| Anonymous viewer            | Not signed in; can only open public shared build pages                  | —                                                   |
| Free user                   | Signed-in; local-first personal data; online-only social; no cloud sync | `users.tier = FREE`                                 |
| Paid user (Pro / Supporter) | Free + cloud sync, cloud image backup, publishing, group creation       | `users.tier = PRO`/`SUPPORTER` (identical features) |
| Group member                | Any signed-in user participating in a group they joined                 | `groupMembers.role`                                 |
| Admin                       | Internal moderation/ops                                                 | `users.role = admin`                                |

- **REQ-001** An account is **required** to use the app beyond viewing public shared pages. Sign-in is Google/email (Better Auth).
- **REQ-002** Pro and Supporter grant **identical** feature access; gate paid features by `isPaid`, never a specific tier.

---

## 3. Freemium model (testable rules)

The **only** paid levers are features that cost real cloud resources. Everything that runs on-device
is free.

### 3.1 Capability matrix

| Capability                                                               | Free | Paid | Req     |
| ------------------------------------------------------------------------ | ---- | ---- | ------- |
| Create/edit/delete elements, builds, conventions, packing, tasks (local) | ✅   | ✅   | REQ-010 |
| Local images (device storage, unlimited, in export)                      | ✅   | ✅   | REQ-011 |
| External image URLs                                                      | ✅   | ✅   | REQ-011 |
| Export / import (all formats: CSV, JSON-ZIP, PDF)                        | ✅   | ✅   | REQ-012 |
| Advanced planner (dependencies, recurrence, templates, time/cost)        | ✅   | ✅   | REQ-013 |
| Browse feed/discover, view profiles & public builds (online)             | ✅   | ✅   | REQ-014 |
| Follow / like / comment, join & participate in groups (online)           | ✅   | ✅   | REQ-014 |
| **Automatic cloud sync + multi-device**                                  | ❌   | ✅   | REQ-015 |
| **Cloud image storage / backup**                                         | ❌   | ✅   | REQ-016 |
| **Publish a build publicly / public share links**                        | ❌   | ✅   | REQ-017 |
| **Post to social feed / be discoverable**                                | ❌   | ✅   | REQ-018 |
| **Create a group**                                                       | ❌   | ✅   | REQ-019 |
| Priority support                                                         | ❌   | ✅   | REQ-020 |

- **REQ-010** All personal-data CRUD works for free users with **zero** Convex data calls (auth-only network traffic). See [`DATA_AND_SYNC.md`](DATA_AND_SYNC.md) §local-first.
- **REQ-011** Free users store images on-device indefinitely; images are included in export. Users may instead reference external image URLs. No cloud upload occurs for free users (except REQ-021).
- **REQ-012** Export and import are free for everyone, all formats. There is no export-based upsell.
- **REQ-013** Advanced planner features are **free** (changed from prior behavior).
- **REQ-014** Social read/interaction (browse, view, follow, like, comment, join/participate in groups) is **free but online-only**.
- **REQ-015** Automatic cloud sync and multi-device access require a paid tier.
- **REQ-016** Cloud image storage/backup requires a paid tier (cap 2 GB, REQ-052).
- **REQ-017** Publishing a build publicly (visibility = public/unlisted, generating a `shareToken`) requires a paid tier.
- **REQ-018** Posting into the social feed / appearing in discover requires a paid tier.
- **REQ-019** Creating a group requires a paid tier; joining and participating are free.
- **REQ-020** Priority support is paid.

### 3.2 Group-cosplay cloud exception (abuse-guarded)

- **REQ-021** A **free** user may cloud-host a build **only when** that build is linked to a group cosplay in a group they are a current member of. Guards:
  - Only builds with a `groupId` for a group where the user is an active member may sync to cloud.
  - The build's cloud presence is **scoped to group participation**: if the user leaves the group or the group/link is removed, the build's cloud copy reverts to the downgrade-freeze path (REQ-058) — it is not deleted from the user's local store.
  - A free user may cloud-host at most **N** group builds (default **N = 5**; configurable) and only images attached to those builds count against a separate small group-cloud allowance (default **100 MB**).
  - This exception never enables general sync of the user's other personal data.

### 3.3 Limit / expiry behavior

- **REQ-022** Hitting a paid-only action as a free user shows a non-blocking **upgrade prompt** explaining the benefit; it never destroys or blocks local work.
- **REQ-023** Subscription expiry / downgrade follows the downgrade flow (REQ-055–058); no data is lost.
- **REQ-024** Exceeding the cloud storage cap blocks **new cloud uploads** only; existing cloud data and all local data are untouched (REQ-053).

---

## 4. Core modules

Each module lists: purpose, key flows, and state behavior. Empty/loading/error/offline state rules
are standardized in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §states; per-module specifics are noted.

### 4.1 Auth & onboarding

- **Purpose:** required account; gateway to personal data and social.
- **Flows:** sign up (Google/email) → first-run sets up local store → optional welcome. Sign in on a new device (paid) pulls cloud data. Sign out. Delete account.
- **REQ-030** First successful sign-in initializes the local store and `users.upsert`; no data sync is triggered for free users.
- **REQ-031** Sign-out keeps local data on the device but warns **free** users to export first (data is at risk if another account signs in on the same device). Paid users' data is safe in cloud.
- **REQ-032** Account deletion removes the user's cloud data and offers a local export; it requires explicit confirmation.
- **REQ-033** Expired session → app drops to a signed-out state but does **not** wipe local data; re-auth restores access.

### 4.2 Elements (catalog) — managed per build

- **Purpose:** the parts that make up a costume (wig, armor piece, fabric, prop, etc.). One canonical model named **Elements** (replaces `closetItems` + `cosplayNodes`). **Not a top-level page** — elements are created and managed **within a build**.
- **Capabilities:** hierarchy (an element may contain sub-elements); status tracking (purchase/build/material); cost; images; notes; source URL.
- **Reuse:** instead of complex per-build shared state, a user **duplicates** an element into another build.
- **REQ-040** Elements are created, edited, reordered, and deleted within a build's detail screen.
- **REQ-041** An element may have child sub-elements (one or more levels); deleting a parent prompts about its children.
- **REQ-042** "Duplicate to build" copies an element (and optionally its sub-tree) into another build as an independent element.
- **REQ-043** A cross-build "all my elements" view MAY exist as a filter/search surface, but element management remains build-scoped (no standalone Closet destination).
- **REQ-044** Element status contributes to the build's progress (see REQ-046).

### 4.3 Builds & build detail

- **Purpose:** a single character costume; the central object.
- **Build detail sections:** summary/progress, elements, tasks (planner view scoped to the build), **reference images**, **process/progress photos**, **progress updates** (new), notes, visibility/sharing.
- **REQ-045** A build has: name, character, status, optional target date, optional budget, optional hero image with focal point, visibility.
- **REQ-046** Build progress is derived from element status and task completion (with optional manual override).
- **REQ-047 (Reference images)** A build holds an ordered gallery of reference images (inspiration). Free: local/external URLs. Add/reorder/caption/delete.
- **REQ-048 (Process photos)** A build holds an ordered gallery of process/WIP photos with optional captions and dates.
- **REQ-049 (Progress updates)** A build has a **dated progress log**: each update has a timestamp, optional note, optional photos, and optional progress percent. Updates render as a timeline on build detail. For **paid** users with publishing on, an update MAY be posted to the social feed (REQ-018). Free users keep updates locally.
- **REQ-050** Visibility states: `private` (default), `unlisted` (link-only), `public`. Setting `unlisted`/`public` requires paid (REQ-017); `publicViewerSettings` toggles which sections anonymous viewers see.

### 4.4 Conventions, day plans & packing

- **Purpose:** plan which builds to wear on which days and what to bring.
- **REQ-051** A convention has name, location, date range, optional image, and per-day plans.
- **REQ-052** Each day plan assigns build(s) to that day.
- **REQ-053** Packing lists are auto-generated from the builds assigned across the convention's days, plus manual items; items are checkable. Regeneration preserves manual items and checked state where possible.
- **REQ-054** Conventions, day plans, and packing are local-first (work fully offline).

### 4.5 Planner / tasks

- **Purpose:** track everything needed to finish builds on time. Model is the existing rich `workflowItems` tree (kept); the **UX is redesigned for clarity** (the prior design was confusing — see [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §planner).
- **REQ-060** Tasks form a tree (parent/child) scoped to a build or standalone; support status, due/target/start dates, priority, weight, manual progress, reminders, time/cost estimates, dependencies, recurrence, and templates. (All free — REQ-013.)
- **REQ-061** A task may attach to an element and/or a build; completing tasks rolls progress up to the element and build (REQ-046).
- **REQ-062** A cross-build planner view shows what's due/overdue across all builds.
- **REQ-063** Planner UX requirements: a clear primary task list, obvious add/complete actions, scannable due dates, and progressive disclosure of advanced fields (don't show dependencies/recurrence/time-cost up front). Offline writes are visible immediately.

### 4.6 Groups / collaboration (online-only)

- **REQ-070** Creating a group is paid (REQ-019); the group's shared data is hosted under the creator's synced account.
- **REQ-071** Joining and participating (shared convention days, build collaboration) is free but **online-only**; offline shows an offline banner.
- **REQ-072** Group cosplay builds enable the free-user cloud exception (REQ-021).

### 4.7 Social (online-only)

- **REQ-080** Free signed-in users may browse the feed/discover, view public profiles and public builds, follow, like, and comment — all online-only.
- **REQ-081** Posting to the feed / being discoverable / public profiles requires paid (REQ-018) — but note interactions on others' content are free (REQ-080).
- **REQ-082** Social surfaces show an offline banner when disconnected; they are never available offline.
- **REQ-083** Moderation: report/block affordances; admin moderation tools (REQ for admin TBD — open question OQ-3).

### 4.8 Settings & subscription

- **REQ-090** Settings (preferences, appearance, notifications, account, subscription) are available on both platforms; preferences are local-first.
- **REQ-091** Subscription screen shows current tier, what paid unlocks, sync status + last-synced (REQ-046 in DATA_AND_SYNC), and manage/upgrade actions. Billing screens are online-only.

### 4.9 Import / export / backup

- **REQ-095** Export (CSV per entity, JSON-ZIP full graph + images, PDF) is free; see [`DATA_AND_SYNC.md`](DATA_AND_SYNC.md) §export.
- **REQ-096** Import rehydrates data + images into the local store, remaps ids, merges last-write-wins, and is idempotent on re-import.

---

## 5. Cross-cutting expected behavior

- **REQ-100** Every list/detail screen for local-first data renders instantly from the local store and reflects offline writes immediately (no spinner waiting on network).
- **REQ-101** Online-only surfaces (social, groups, billing, public pages) show a clear offline banner and a retry path when disconnected.
- **REQ-102** Web and mobile are at full feature parity for all modules (acceptable platform differences are listed in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §parity).

---

## 6. Edge cases

| ID    | Scenario                                              | Expected behavior                                                            |
| ----- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| EC-01 | Create/edit/delete while offline (local-first module) | Succeeds locally, visible immediately, queued for sync (paid)                |
| EC-02 | Free user attempts paid action                        | Upgrade prompt; local work never blocked/lost                                |
| EC-03 | Same record edited on two devices (paid)              | Per-field last-write-wins by `updatedAt` (REQ-040 DATA_AND_SYNC)             |
| EC-04 | Duplicate offline create replayed twice               | Server idempotency dedupes (no duplicate row)                                |
| EC-05 | Open online-only surface offline                      | Offline banner + retry; no crash, no stale write                             |
| EC-06 | Sign out on shared device (free)                      | Warned to export; local data remains until overwritten                       |
| EC-07 | Storage cap exceeded (paid)                           | New cloud uploads blocked; existing data intact; prompt to trim/upgrade      |
| EC-08 | Downgrade with synced data                            | Sync stops; local works; cloud kept (grace) then frozen; never deletes local |
| EC-09 | Free user leaves a group with a cloud-hosted build    | Build's cloud copy freezes; local copy unaffected (REQ-021)                  |
| EC-10 | Delete parent element with children                   | Prompt; cascade or re-parent per user choice                                 |
| EC-11 | Packing regenerated after day plan change             | Manual items + checked state preserved where possible                        |
| EC-12 | Public build opened by anonymous viewer               | Shows only sections allowed by `publicViewerSettings`; no private data       |
| EC-13 | Invalid/expired share token                           | Friendly "not found / no longer shared" page                                 |
| EC-14 | Import a file exported on another device              | Idempotent merge; no duplicates on re-import                                 |
| EC-15 | Large dataset (1000+ elements/tasks)                  | Lists paginate/virtualize; remain smooth (REQ perf)                          |

---

## 7. Acceptance criteria (Given/When/Then)

- **AC-01 (REQ-010)** Given a signed-in free user with network blocked at the Convex data layer, When they create a build, add elements, and edit tasks, Then all operations succeed locally and only auth endpoints are contacted.
- **AC-02 (REQ-015/Phase2)** Given a free user, When the app runs, Then the sync worker never starts and no `entity_rows` warm-up or queue drain calls Convex.
- **AC-03 (REQ-015)** Given a paid user who created data offline, When they reconnect, Then queued writes replay exactly once (no duplicates) and become visible on a second device.
- **AC-04 (REQ-013)** Given a free user, When they open advanced planner features (dependencies, recurrence, templates), Then they are usable with no upgrade prompt.
- **AC-05 (REQ-017)** Given a free user, When they try to set a build to public or generate a share link, Then they see an upgrade prompt and the build stays private.
- **AC-06 (REQ-021)** Given a free user who is a member of a group, When a build is linked to that group's cosplay, Then that build (and its images, within the group allowance) may sync to cloud, while their other builds do not.
- **AC-07 (REQ-049)** Given a build with no progress updates, When the user opens build detail, Then an empty state invites adding the first progress update; adding one shows it in a dated timeline immediately (offline-capable for the owner).
- **AC-08 (REQ-031)** Given a free user signs out, When sign-out is requested, Then they are warned to export and confirm before local data is left on a shared device.
- **AC-09 (REQ-040 Elements)** Given a build, When the user manages elements, Then there is no separate Closet navigation destination; element CRUD happens inside the build.
- **AC-10 (EC-03)** Given the same build edited on two paid devices (different fields), When both sync, Then both field edits survive (per-field LWW), not a whole-document clobber.

---

## 8. Non-goals

- Real-time collaborative editing / CRDTs (LWW only).
- Free-tier cloud sync of arbitrary personal data (only the group-cosplay exception, REQ-021).
- A marketplace / commerce / payments beyond subscription.
- AI background removal as a hosted service (dropped; may revisit on-device later).
- Offline support for social/groups/billing/public pages (intentionally online-only).

---

## 9. Open questions

- **OQ-1 (design)** Final visual direction undecided — produce 2–3 mockup directions (refined-editorial vs minimal-modern vs warm-playful) referencing Pinterest/Linear/Notion, plus a proposed palette and IA, before implementation. Owner: design round.
- **OQ-2 (nav/IA)** Exact primary navigation set, given Elements is build-scoped (not a tab). Proposal in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §IA — needs sign-off.
- **OQ-3 (moderation)** Depth of social moderation tooling for v1 (report/block minimum vs admin queue).
- **OQ-4 (group exception tuning)** Final values for REQ-021 guards (N builds, MB allowance).
- **OQ-5 (progress-update social)** Whether progress updates post to the feed automatically or via explicit share action (assumed: explicit).
