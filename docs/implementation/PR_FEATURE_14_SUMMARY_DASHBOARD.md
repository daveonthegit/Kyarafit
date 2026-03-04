# Feature 14: Build Summary Dashboard — Implementation Design

## STEP 0 — Chosen feature

- **Feature:** Build summary dashboard (FEATURES_CANONICAL §14).
- **Why next:** Competitor parity (Cosplanner Summary); high value; no new tables — derives from existing builds, buildTasks, buildItemLinks, closetItems.
- **Acceptance criteria (verbatim):**
  - User can open a Summary view for a build (tab or section on build detail).
  - Summary shows: build status, progress % (and bar), initial date, due date, elapsed time, remaining time; elements to buy (bought/pending/total), to make (made/ongoing/total), total elements; optional developing time, budget, total spend, difference (budget − spend).
  - Data is derived from build, buildItemLinks (with type/status), buildTasks; optional future tables for time/spend if added.
  - Optionally: Share/export summary.

## STEP 1 — Implementation design

### Scope for this PR (no element type/status yet)

- **buildItemLinks** has no `type` or `status` in schema yet (FEATURES_CANONICAL §3 “Elements ≈ closet items” is separate). We implement summary with current data:
  - Status, progress %, bar, initial date, due date, elapsed/remaining.
  - **Linked items:** total count + “complete” count (from closet item status); no “to buy / to make” breakdown until schema extended.
  - Budget, total spend, difference.
  - “Developing time” omitted (no table); Share/export optional later.

### Data model

- **No schema/migration changes.** All data from existing tables.

### Backend

- **New Convex query:** `builds.getSummary`
  - Args: `{ buildId: v.id("builds"), userId: v.string() }` (auth).
  - Returns: `{ status, progressPercent, tasksChecked, tasksTotal, createdDate (ISO), targetDate, elapsedDays, remainingDays, linkedItemCount, linkedItemsCompleteCount, totalCostCents, budgetCents, budgetDifferenceCents }`.
  - Handler: get build (verify userId), get tasks (by_buildId), get links (by_buildId), resolve closet items for cost + status; compute and return. Use `_creationTime` from build (Convex doc field).

### Frontend

- **Build detail page:** Add a “Summary” section (or tab). Use section to avoid tab refactor; place after “Completion” / “Deadline” in the left column or as a dedicated block.
  - **Option A:** Summary as a collapsible section below current left-column content.
  - **Option B:** Summary as a second “view” toggle (Overview | Summary). Chosen: **section** below the existing left-column content (image, meta, completion, deadline, budget) so one scroll shows overview + summary.
  - Content: status, progress bar, Initial date, Due date, Elapsed, Remaining; Linked items (X of Y complete); Budget / Spent / Difference (reuse existing formatCents). Loading/empty/error: use same patterns as build detail (query skip when no id/userId).

### Edge cases and errors

- Build not found or not owned by user → getSummary returns null; UI shows “Summary unavailable” or hide section.
- No target date → remaining “—” or “No deadline”; elapsed still from creation.
- No budget → hide budget row or show “Budget not set”.
- Zero linked items → “0 of 0 complete”.

### Security

- getSummary requires `userId`; handler verifies `build.userId === args.userId`; return null otherwise (no leak).

### Tests

- **Convex:** No existing Convex unit test pattern in repo; add a simple test in `web` that mocks or we add Convex tests later. Prefer: **frontend test** that renders a Summary section with mock summary data (Vitest + React Testing Library).
- **Manual:** Open build detail, confirm Summary section shows and numbers match tasks/links/budget.

### Files to touch/create

| Path                                                     | Action                                               |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `convex/builds.ts`                                       | Add `getSummary` query                               |
| `web/src/app/build-detail/page.tsx`                      | Add Summary section; call `api.builds.getSummary`    |
| `web/src/components/builds/BuildSummarySection.tsx`      | New: present summary data (optional: inline in page) |
| `web/src/components/builds/BuildSummarySection.test.tsx` | New: unit test with mock data                        |
| `docs/implementation/FEATURE_STATUS.md`                  | Update Feature 14 → Implemented, evidence            |
| `docs/implementation/GAP_ANALYSIS.md`                    | Remove or update Build summary dashboard gap         |
| `docs/implementation/COMMIT_PLAN.md`                     | Check off if PR matches a row                        |

---

## Implementation notes

- Use existing `formatCents` and date formatting from build detail.
- Build doc from Convex includes `_creationTime` (number); convert to ISO for “initial date” and compute elapsed/remaining in query (single source of truth).
