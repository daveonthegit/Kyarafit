# Packing List

**Purpose:** Per-convention packing list with total progress, essentials section, by-build (cosplay) sections, search, add item, and regenerate. Same on web and mobile.

**Scope:** In: Packing page/screen, Convex packingListItems and convention APIs. Out: Go REST API; web lib/api/conventions.ts (web uses Convex).

**Current state:**

- **Convex:** [convex/conventions.ts](convex/conventions.ts) — packing list: list items by conventionId, update item (checked), add manual item, regenerate from plan. Schema: packingListItems (userId, conventionId, date, buildId, closetItemId, label, checked).
- **Web:** [web/src/app/conventions/[id]/packing/page.tsx](web/src/app/conventions/[id]/packing/page.tsx) — fetches convention and packing items; groups by general vs by date; ChecklistRow per item; regenerate button.
- **Gaps:** Header with search filter; total progress (X of Y items, progress bar); by-build expandable sections with per-group progress; add-item FAB/button; ensure Convex mutations used for update/add/regenerate.

**Next steps:**

1. **Header + search:** Title (e.g. "Packing List" or convention name), back link; search/filter by label (client-side filter on displayed items).
2. **Total progress:** Compute packed count vs total; show "X of Y items", progress bar, percentage. Optional: "Last synced" when using Convex (real-time; no separate sync indicator needed).
3. **Essentials:** Section for items with no buildId (and optional no date). Flat list with checkbox + label.
4. **By-build sections:** Group items by buildId; each group expandable; show build name, per-group progress (e.g. "5/8 packed"); when expanded, list sub-items with checkbox.
5. **Add item:** Button/FAB to add manual packing item (label, optional buildId/date); call Convex addManualPackingItem or create mutation.
6. **Mobile:** Same packing list UI and Convex (or SQLite when offline) data.

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Packing list), [convex/conventions.ts](convex/conventions.ts), [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
