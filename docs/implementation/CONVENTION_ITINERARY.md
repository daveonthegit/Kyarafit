# Convention Itinerary

**Purpose:** Show convention itinerary view: day-by-day build cards, task summary, countdown, optional sync/offline indicator and logistics. Same feature set on web and mobile.

**Scope:** In: Itinerary page/screen, Convex queries (conventions, conventionDayPlans, builds, buildTasks, packingListItems). Out: Go API, fetchPlan/fetchBuildTasks from legacy API client.

**Current state:**

- **Convex:** [convex/conventions.ts](convex/conventions.ts) — get, list, getPlan (day plans), packing list; builds and buildTasks via [convex/builds.ts](convex/builds.ts), [convex/buildTasks.ts](convex/buildTasks.ts).
- **Web:** [web/src/app/itinerary/page.tsx](web/src/app/itinerary/page.tsx) — may be stub ("Assign a build from your convention plan") or basic; needs full day-by-day view with build cards and countdown.
- **Data:** Convention day plan = conventionDayPlans (conventionId, date, buildId, notes). For each day, load build (image, name, status) and optionally build tasks / packing count for "ready to pack" or "missing items".

**Next steps:**

1. **Itinerary page:** Select convention (or default to first/upcoming). Load convention and day plan via `api.conventions.get` / getPlan equivalent. For each day, load build via `api.builds.get`; optionally load buildTasks and packing items for status (e.g. "Ready to pack (12 items)", "Missing: X").
2. **UI:** Header with convention name, back nav; countdown to start date; per-day section: date label, build card (thumbnail, name, status line). Optional: sync/offline line; logistics section if convention or user has relevant fields.
3. **Mobile:** Same itinerary screen with same data from Convex (or SQLite when offline if synced).

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Itinerary), [convex/conventions.ts](convex/conventions.ts), [PACKING_LIST.md](PACKING_LIST.md), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
