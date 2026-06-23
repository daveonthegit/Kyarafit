# Design System & Parity

_Source of truth for **UI/UX principles, information architecture, components, states, accessibility,
and web/mobile parity**. Product → [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md)._

> **Visual direction is an OPEN QUESTION (OQ-1).** This doc locks **principles, IA, component
> contracts, and state rules** now. Concrete visual language (final type, color, mockups) is a
> follow-up: produce 2–3 directions (refined-editorial · minimal-modern · warm-playful) referencing
> **Pinterest, Linear, Notion**, plus a proposed palette, for sign-off before implementation.

---

## 1. Design principles

1. **Consistency over cleverness.** One pattern per job; no one-off components, no cards-inside-cards, no per-screen spacing.
2. **Balanced & breathable.** Efficient but not cramped (user pref: balanced density, balanced imagery).
3. **Content/photo-forward but not at the expense of data.** Cosplay is visual; progress/planning are co-equal.
4. **Premium feel.** It must look worth paying for (current pain: "doesn't feel premium").
5. **Instant & honest.** Local-first screens never spin on network; sync/offline state is always visible (REQ-D64).
6. **Progressive disclosure.** Advanced features (esp. planner) are tucked behind clear affordances, not shown up front.

---

## 2. Information architecture (proposed — OQ-2)

Elements are **not** a top-level destination (managed per-build). Proposed primary nav:

| Destination | Purpose                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------- |
| **Home**    | Dashboard: active builds, what's due (planner), upcoming conventions, recent progress updates |
| **Builds**  | Grid of builds → build detail (elements, tasks, photos, progress updates, sharing)            |
| **Plan**    | Conventions + day plans + packing + cross-build planner ("what's due")                        |
| **Social**  | Feed / discover (online-only)                                                                 |
| **Profile** | Public profile, settings, subscription, sync status                                           |

- Mobile: bottom tab bar (these 5). Web: left sidebar / top nav (same 5).
- **Create** is a prominent action (FAB on mobile / primary button on web) offering: new build, new convention, new task, add progress update.
- Elements live inside **build detail**; an optional "all elements" search/filter is reachable from a build or Home, not as a tab.

---

## 3. Component spec (shared contract, platform-native impl)

Same name + prop shape on web and mobile (B3/N1 in [`ARCHITECTURE.md`](ARCHITECTURE.md)). UI is
platform-native; the **contract** is shared.

| Primitive              | Role                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `PageHeader`           | Title + meta + primary action                                                       |
| `SectionCard`          | One bordered surface for a section (never nest cards)                               |
| `EmptyState`           | Icon + message + primary CTA                                                        |
| `DataBoundary`         | Wraps async/local data: handles loading / empty / error uniformly                   |
| `OfflineBanner`        | Online-only surfaces when disconnected                                              |
| `SyncStatus`           | Connectivity + pending count + last-synced + manual sync (paid)                     |
| `PendingBadge`         | Per-row "not yet synced" indicator                                                  |
| `UpgradePrompt`        | Non-blocking paywall for paid actions (REQ-022)                                     |
| `Gallery`              | Ordered, reorderable image grid (reference / process photos)                        |
| `ProgressTimeline`     | Dated progress-update entries (REQ-049)                                             |
| `TaskList` / `TaskRow` | Planner list with progressive disclosure (REQ-063)                                  |
| `FormField`            | Labeled input with validation message slot                                          |
| Buttons                | One button system: `primary`, `secondary`, `ghost`, `destructive`, sizes `sm/md/lg` |

- **CMP-1** No bespoke buttons/cards/spacing outside this system.
- **CMP-2** Spacing/typography/radius/shadow come only from tokens (`design_tokens.json` / `rn_tokens.ts`).

---

## 4. Standard states (every data surface)

| State                 | Rule                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Loading               | Skeleton/placeholder; **local-first surfaces show cached data instantly instead of a spinner** |
| Empty                 | `EmptyState` with a clear CTA (e.g. "Add your first element")                                  |
| Error                 | Inline, actionable message + retry; never a dead end                                           |
| Offline (local-first) | Works normally; `PendingBadge` on unsynced rows                                                |
| Offline (online-only) | `OfflineBanner` + retry; no partial writes                                                     |
| Partial/syncing       | `SyncStatus` reflects progress; never blocks interaction                                       |

---

## 5. Reference / process / progress media (REQ-047–049)

- **Reference images:** inspiration gallery; add via pick/capture/URL; reorder; caption; delete.
- **Process photos:** WIP gallery with optional dates/captions.
- **Progress updates:** dated timeline entries (note + photos + optional %); paid users may publish an update to the feed (explicit action — OQ-5). Empty state invites the first update (AC-07).
- All media follow `ImageRef` rules ([`DATA_AND_SYNC.md`](DATA_AND_SYNC.md) §7): local-first, free.

---

## 6. Planner UX (the redesign — REQ-063)

The model stays rich; the presentation must become clear:

- A **single primary task list** per build + a cross-build "what's due" view.
- Obvious **add** and **complete** affordances; scannable due dates; overdue clearly marked.
- **Progressive disclosure:** dependencies, recurrence, templates, time/cost, reminders live behind an "advanced"/expand affordance — not in the default row.
- Offline writes appear immediately (REQ-052).

---

## 7. Accessibility & theming (required)

- **A11Y-1** WCAG AA contrast; minimum touch targets; labels/roles on all interactive elements.
- **A11Y-2** Full **dark mode** parity on both platforms.
- **A11Y-3** Respect OS **dynamic type** / font scaling.
- **A11Y-4** Honor **reduced-motion**.
- **A11Y-5** Full **i18n parity**: en / ja / es on **both** web and mobile (web is currently partial — close the gap).

---

## 8. Parity matrix

Acceptable platform differences: navigation chrome, gestures vs hover/right-click, camera vs file
picker, responsive layout density, a few platform-only utility screens (e.g. dev tools). Everything
else must match.

| Feature                                    | Web      | Mobile   | Shared logic               | Notes                         |
| ------------------------------------------ | -------- | -------- | -------------------------- | ----------------------------- |
| Elements (per-build)                       | ✅       | ✅       | `design-system/domain`     | full parity                   |
| Builds + detail                            | ✅       | ✅       | shared                     | full parity                   |
| Reference / process / progress media       | ✅       | ✅       | shared                     | capture differs (camera/file) |
| Conventions + day plans + packing          | ✅       | ✅       | shared                     | full parity                   |
| Planner / tasks                            | ✅       | ✅       | `workflowDomain`, overlays | full parity                   |
| Social (feed/follow/like/comment/profiles) | ✅       | ✅       | shared                     | online-only both              |
| Groups / collaboration                     | ✅       | ✅       | shared                     | online-only both              |
| Settings + subscription                    | ✅       | ✅       | entitlements               | billing online-only           |
| Export / import                            | ✅       | ✅       | shared (`fflate`)          | full parity                   |
| Offline bridge + sync UI                   | ✅       | ✅       | shared sync logic          | per-platform `LocalStore`     |
| Dev tools                                  | dev-only | dev-only | —                          | platform-only allowed         |

- **PAR-1** A feature shipped on one platform must ship on the other before release (no drift).
- **PAR-2** Shared logic divergence is a bug; differences must be UI-only and justified by §8 allowances.
