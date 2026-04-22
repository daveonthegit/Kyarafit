# Public build detail — updated plan (editorial-informed + private parity)

**Status:** planning reference. Supersedes informal notes from the earlier “public build page parity” discussion.

**Companion docs:** mobile follow-up [mobile-rewrite/FOLLOWUP-public-build-viewer.md](mobile-rewrite/FOLLOWUP-public-build-viewer.md).

---

## Goals

1. **Parity with private web build detail** — The signed-in reference is [`web/src/app/build-detail/[id]/page.tsx`](web/src/app/build-detail/[id]/page.tsx): same **information architecture** (tabs/sections), same **data surfaces** (outline/explorer, tasks, visual board, summary, social), rendered **read-only** for anonymous or signed-in viewers who are not editing.
2. **Editorial influence, not a copy-paste** — Reuse **patterns** from [`EditorialPublicBuildDetail`](web/src/components/builds/EditorialPublicBuildDetail.tsx) for the **public** experience: strong hero typography, optional progress **donut + vertical rail**, serif section titles, generous whitespace, underline-style comment field. Do **not** fork a second divergent layout; the public page should **feel** editorial while **matching** the private page’s structure and content scope.
3. **Owner-controlled visibility** — `publicViewerSettings` (or equivalent) on `builds` determines which sections appear for non-owners; owners/collaborators keep full detail in the private route.
4. **Security** — Enforce visibility + toggles in Convex; fix ID-guessing leaks on list queries.
5. **Routes** — Single shared viewer for [`/b/[buildId]`](web/src/app/b/[buildId]/page.tsx) (public) and [`/b/s/[shareToken]`](web/src/app/b/s/[shareToken]/page.tsx) (unlisted).
6. **Cleanup** — Remove deprecated redirect-only `build-detail` wrappers per blueprint; keep `/build-detail/[id]` as the authenticated editor. Remove **`EditorialPublicBuildDetail.tsx`** once the replacement viewer is live (see Editorial section below).

---

## Parity matrix: private vs public viewer

Reference layout in private detail (non-edit mode): **Kyarafit / character** crumb, **wide hero** (`aspect-[21/9]` / `sm:aspect-[3/1]`) with **title on gradient**, optional **deadline** strip, then **tabs** — Explorer · Tasks · Visual board · Summary.

| Private section (`build-detail/[id]`) | Public viewer behavior |
|---------------------------------------|-------------------------|
| Hero + title + focal | Same aspect and overlay pattern as private view mode for consistency; editorial tweaks (e.g. contrast, spacing) only if they **align** with this hero (avoid the old narrow `4:3` card-only layout). |
| Deadline row | Same display when `targetDate` exists and toggle allows “summary/date” style fields. |
| **Explorer** — notes + `BuildNodeManagerSection` | Read-only outline: same tree/list of linked nodes **without** create/link FABs; notes block when toggle on. Prefer extracting a **`BuildExplorerReadOnly`** (or props on existing section) over duplicating markup. |
| **Tasks** — `WorkflowTree` | Read-only task tree (no check-off unless product explicitly allows authenticated visitors later). Editorial **task list** styling can inform row typography; structure should match **WorkflowTree** content, not a simplified fake list unless WorkflowTree gains a `readOnly` mode. |
| **Visual board** — `BuildVisualBoard` + DnD | **Read-only board**: same cards/layout, **no** drag-and-drop, link to `/elements/[id]` preserved where appropriate. |
| **Summary** — `BuildSummarySection` | Same metrics when toggle allows; editorial **donut / vertical rail** can live **beside or inside** Summary to add glanceable progress without replacing **BuildSummarySection** data. |
| **Collaborators** | Read-only list (no Invite/Remove). |
| Likes / comments | Keep existing public behavior; align styling with editorial comments block where useful. |
| FABs, modals, edit sheet, visibility controls | **Omit** on public viewer; editing stays on `/build-detail/[id]`. |

**Gap note:** Private detail does not currently show reference/process **photo galleries** on the same tabs in the snippet reviewed; if those exist elsewhere on private detail or mobile `DetailBody`, add them to this matrix when discovered so public parity stays accurate.

---

## Editorial elements to borrow (design decisions)

Use [`EditorialPublicBuildDetail`](web/src/components/builds/EditorialPublicBuildDetail.tsx) as a **style reference**, not the sole layout:

- **Typography:** `font-serif` headings, uppercase meta labels (`tracking-widest`), comment section hierarchy.
- **Progress:** `EditorialProgressDonut` + `EditorialVerticalProgressRail` — place in **Summary** tab or hero-adjacent column when toggles expose progress (avoid duplicating hero + card progress from the **old** narrow `/b/[buildId]` page).
- **Hero treatment:** Editorial’s **gradient overlay + title-on-image** is already close to **private** view mode; align public hero to **private** sizes first, then apply editorial polish (e.g. subtle grayscale) **only** if it does not clash with brand parity between private and public **view** modes.
- **Comments form:** Editorial underline input is acceptable for public comments.

**After** the new public viewer ships and `/b/*` routes use it: **delete** [`web/src/components/builds/EditorialPublicBuildDetail.tsx`](web/src/components/builds/EditorialPublicBuildDetail.tsx) (it is not imported anywhere today). **Keep** shared pieces that remain useful — e.g. `EditorialProgressDonut` / `EditorialVerticalProgressRail` from [`EditorialBuildProgress`](web/src/components/builds/EditorialBuildProgress.tsx) — by importing them from that module in the new viewer, not by retaining the old wrapper component.

---

## Convex and API shape

- **`builds.publicViewerSettings`** — Booleans per section (e.g. explorer/outline, tasks, visualBoard, summaryMetrics, notes, collaborators, reference/process if applicable).
- **`buildPublicViewer` access helper** — Resolve `public` vs `unlisted` (share token) vs owner/collaborator.
- **`builds.getPublicViewerBundle`** — Returns everything the public UI needs in one round-trip (or a small fixed set of queries), **filtering** by toggles and access.
- **Harden** `buildTasks.listByBuild`, `cosplayNodes.listBuildVisualNodes`, `buildReferenceImages.listByBuild`, `buildProcessPictures.listByBuild` so arbitrary clients cannot scrape **private** builds by id.

---

## Implementation order (suggested)

1. Schema + `publicViewerSettings` + `builds.update`.
2. Access helper + `getPublicViewerBundle` + query hardening.
3. Read-only variants: `WorkflowTree`, `BuildVisualBoard`, explorer section — or wrapper components with `readOnly` prop.
4. New **`PublicBuildDetailView`** composing tabbed IA matching private detail + editorial accents.
5. Wire `/b/[buildId]` and `/b/s/[shareToken]`; remove duplicated inline JSX.
6. Owner toggles UI next to Visibility on `/build-detail/[id]`.
7. Optional: `generateMetadata` for OG.
8. Deprecated redirect routes cleanup.
9. **Delete** `EditorialPublicBuildDetail.tsx`; confirm no stray imports or Storybook references.

---

## Mobile

Deferred: [mobile-rewrite/FOLLOWUP-public-build-viewer.md](mobile-rewrite/FOLLOWUP-public-build-viewer.md).
