# Packing List: Feature Guide and Implementation

Build the **convention packing list** so it supports total progress, essentials, build‑grouped (cosplay) sections, and add-item flows. Do not copy the style/aesthetic of any reference screen—only implement the features below in the app’s own design.

---

**Feature parity**: Implement the same packing list features on web and mobile: header with search, total progress and sync status, essentials, by-build expandable sections, add-item FAB. Web steps reference web paths; mobile should provide the same packing screen for a convention.

## Goal

- **Current state**: [web/src/app/conventions/[id]/packing/page.tsx](web/src/app/conventions/[id]/packing/page.tsx) shows convention packing with "GENERAL ESSENTIALS" and items grouped by date; regenerate button; ChecklistRow per item. Backend has packing_list_items (convention_id, date, build_id, closet_item_id, label, checked).
- **Target**: Packing list implements the [feature guide](#packing-list-feature-guide) below: header with search, total progress with sync status, essentials section, cosplay/build‑grouped expandable sections with per‑group progress, and add item/category. **Web and mobile**: same packing list feature set per convention. Use the app’s existing design system.

---

## Packing list: feature guide

Use this as the **feature** target for the packing list screen. Do not copy the reference screen’s style—only implement these capabilities.

- **Header**: **Back** navigation; **title** (e.g. "Packing List" or convention name); **search** (icon or field to search/filter items in the list).
- **Total progress**: **Overall progress** section: "X of Y items" (packed count vs total), **progress bar**, and **percentage** (e.g. 65%). **Sync status** line (e.g. "Saved locally & synced" or "Last synced: X ago") when relevant.
- **Essentials (or General) section**: **Flat list** of general items not tied to a build: each row has a **checkbox** (packed/unpacked) and **label**; optional **sub-description** per item (e.g. "Physical or Digital PDF", "Check for valid expiry"). These map to packing list items with no build_id (and optionally no date).
- **Cosplay projects / by-build grouping**: **Grouped sections** by build (cosplay project): each group is **expandable/collapsible** (chevron or toggle). Each group shows:
  - **Build/project name** (e.g. "Raiden Shogun", "Hatsune Miku").
  - **Progress summary** (e.g. "5/8 packed", "10/10 packed") for that group.
  - Optional **subtitle** (e.g. "Genshin Impact", "Vocaloid") from build character or notes.
  - When expanded: **sub-items** (packing items for that build) with checkbox and label.
  - Optional icon or thumbnail per group (build image).
- **Add new item / category**: **FAB or button** (e.g. "+") to **add a new item** (to essentials or to a build) or to **add a new category/group**. Support at least: add manual packing item (label, optional build/date); optional "add build to list" if not yet in the plan.
- **Persistence and sync**: Items are saved (local and/or synced); checkboxes update via API. Regenerate list from convention plan remains available where it fits (e.g. header or settings).

See also [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md) (itinerary links to packing) and backend convention packing API (fetchPacking, updatePackingItem, regeneratePacking, addManualPackingItem).

---

## Prerequisites

- [web/src/app/conventions/[id]/packing/page.tsx](web/src/app/conventions/[id]/packing/page.tsx): Fetches convention and packing items; groups by general vs by date; uses ChecklistRow; has regenerate.
- API: fetchPacking(id), updatePackingItem(itemId, { checked }), regeneratePacking(id); addManualPackingItem if present (check [web/src/lib/api/conventions.ts](web/src/lib/api/conventions.ts)).
- PackingListItem: id, conventionId, date, buildId, closetItemId, label, checked. Grouping by build_id gives "cosplay projects" sections.

---

## Step 1: Packing page — header and search

**What to do**

- In the packing page header: keep **back** link to convention. Use a clear **title** (e.g. "Packing List" or convention name). Add a **search** control (icon that expands to a field, or always-visible filter): filter the displayed items by label (client-side filter). Use the app’s design tokens—do not copy the reference aesthetic.

**Files to touch**

- `web/src/app/conventions/[id]/packing/page.tsx`

**Cursor prompt**

```
In web/src/app/conventions/[id]/packing/page.tsx, add header and search: (1) Keep back link; ensure title is clear (e.g. "Packing List" or convention name). (2) Add a search icon or search field that filters the packing list items by label (client-side). (3) Use the app's existing design system. Run npm run build.
```

---

## Step 2: Packing page — total progress and sync status

**What to do**

- Add a **total progress** block: compute **packed count** (items where checked) and **total count**; show "X of Y items" and a **progress bar** (packed/total) and **percentage**. Add a short **sync status** line (e.g. "Saved locally & synced" or "Last synced: X ago") using existing sync status if available, or a static note. Use existing typography and spacing.

**Files to touch**

- `web/src/app/conventions/[id]/packing/page.tsx`

**Cursor prompt**

```
On the convention packing page, add total progress: (1) "X of Y items" (checked count of total) and a horizontal progress bar and percentage. (2) A sync status line ("Saved locally & synced" or "Last synced: X ago"). Use existing design tokens. Run npm run build.
```

---

## Step 3: Packing page — essentials section with optional sub-description

**What to do**

- Keep or rename the **Essentials** (or "General essentials") section: flat list of items with no build_id (and no date, or general date). Each row: **checkbox** and **label**. If the backend or types support a **sub-description** or notes per packing item, show it under the label (e.g. smaller text); otherwise show label only. Use ChecklistRow or equivalent.

**Files to touch**

- `web/src/app/conventions/[id]/packing/page.tsx`; backend/types if adding sub-description/notes to packing items.

**Cursor prompt**

```
On the packing page, ensure the essentials (general) section shows a flat list with checkbox and label per item. If packing list items have a notes or sub-description field, display it under the label; otherwise label only. Use existing ChecklistRow or design. Run npm run build.
```

---

## Step 4: Packing page — cosplay projects (by-build) expandable sections

**What to do**

- **Group items by build_id**: For items that have a build_id, group them by build. Each group is an **expandable/collapsible** section. Section header: **build name** (resolve build_id to build name via builds API or inline), **progress** for that build (e.g. "5/8 packed"), and optional subtitle (build character or source). When expanded, show the list of packing items in that group with checkbox and label. Use the app’s accordion or collapse pattern; do not copy the reference style.

**Files to touch**

- `web/src/app/conventions/[id]/packing/page.tsx`; may need to fetch builds to resolve build_id to name.

**Cursor prompt**

```
On the packing page, add cosplay projects (by-build) sections: (1) Group packing items by build_id. (2) For each build group, show an expandable/collapsible section with build name (resolve build_id via fetchBuilds or convention plan), progress (e.g. "5/8 packed" for that build), and optional subtitle. (3) When expanded, list the items in that group with checkbox and label. (4) Use the app's accordion/collapse pattern and design tokens. Run npm run build.
```

---

## Step 5: Packing page — add item FAB and manual add

**What to do**

- Add a **FAB or primary button** (e.g. "+") to **add a new packing item**. Wire to **add manual packing item** API (label, optional date, optional build_id). Flow: tap FAB → modal or inline form (label, optional "Add to build" picker, optional date) → submit. After add, refetch packing list. If the API does not support add manual item, add it (see backend convention handler) and then wire the FAB. Use existing design for FAB and form.

**Files to touch**

- `web/src/app/conventions/[id]/packing/page.tsx`; [web/src/lib/api/conventions.ts](web/src/lib/api/conventions.ts) if addManualPackingItem is missing; backend if endpoint is missing.

**Cursor prompt**

```
On the packing page, add an add-item FAB or button: (1) On tap, open a modal or form to add a manual packing item (label, optional build, optional date). (2) Call the add manual packing item API (e.g. POST convention packing manual); if the API does not exist, add it and then wire the form. (3) On success, refetch packing list. (4) Use the app's FAB and form design. Run npm run build.
```

---

## Step 6: Mobile packing list — same feature set as web

**What to do**

- On **mobile**, implement the convention packing list screen with the same features as web: header (back, title, search); total progress (X of Y items, progress bar, percentage) and sync status; essentials section (flat list, checkbox, label); cosplay projects (by-build expandable sections with progress and sub-items); add-item FAB (manual add with label, optional build/date). Use the same packing API (fetchPacking, updatePackingItem, addManualPackingItem, regenerate). Navigate from convention detail or itinerary to packing.

**Files to touch**

- Mobile convention packing screen (e.g. under `mobile/`).

**Cursor prompt**

```
In the Kyarafit mobile app, implement the convention packing list with feature parity to web: (1) Screen for a convention: header with back, title, search. (2) Total progress (X of Y items, progress bar, %) and sync status. (3) Essentials section (flat list, checkbox, label). (4) By-build expandable sections (build name, progress, sub-items with checkbox). (5) Add-item FAB (manual add: label, optional build/date). Use same packing API as web. See PACKING_LIST.md feature guide. Run the app and verify.
```

---

## Summary

| Step | Action                                                                                    |
| ---- | ----------------------------------------------------------------------------------------- |
| 1    | Header: back, title, search (filter by label).                                            |
| 2    | Total progress: X of Y items, progress bar, percentage; sync status line.                 |
| 3    | Essentials: flat list with checkbox, label, optional sub-description.                     |
| 4    | Cosplay projects: by-build expandable sections with progress and sub-items.               |
| 5    | Add item FAB and manual add (label, optional build/date).                                 |
| 6    | Mobile: same packing list feature set (header, progress, essentials, by-build, add item). |
