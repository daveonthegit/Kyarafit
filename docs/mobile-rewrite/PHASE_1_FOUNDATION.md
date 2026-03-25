# Phase 1 — Mobile foundation (implemented)

This phase establishes shared UI primitives, navigation affordances, and data-source helpers so Phase 2 can rebuild flows on a consistent base.

## What shipped

### `mobile/src/components/shared/`

| Export                       | Role                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `KyarIcon`                   | Semantic icon names → `@expo/vector-icons/MaterialIcons` (bridge toward web Material Symbols). |
| `ScreenHeader`               | Editorial meta + Bodoni-style title, optional back, trailing slot, safe-area top inset.        |
| `SectionCard`                | Web-aligned card: rounded border, soft shadow, optional title strip + action.                  |
| `FilterTabs`                 | Horizontal uppercase tabs with underline active state.                                         |
| `EmptyState`                 | Icon + message + optional secondary + action slot.                                             |
| `ListRow`                    | Title/subtitle row with optional chevron.                                                      |
| `SettingsRow`                | Uppercase settings row (destructive variant).                                                  |
| `MetaLabel` / `SectionLabel` | Typography helpers using `@kyarafit/design-system/rn` tokens.                                  |
| `ProgressBar`                | Thin track + fill (used in Planner tab).                                                       |
| `Avatar`                     | Image or initials circle.                                                                      |
| `Badge`                      | Status / label pill.                                                                           |

### `mobile/src/hooks/useDataSource.ts`

- `userId`, `isCloud`, `isLocalOnly`, `userQueryArgs` (`{ userId }` or `"skip"`) for Convex `useQuery` patterns.

### Navigation

- **`app/(tabs)/_layout.tsx`**: Tab icons use `KyarIcon` (Material Icons) instead of Ionicons; labels match web bottom nav density (9px tracking).
- **`MobileNavMenu`**: Events, Groups, Discover, Feed, Profile, Settings — routes wired for parity work in later phases.
- **Stub routes**: `app/groups.tsx`, `app/discover.tsx`, `app/feed.tsx` — `ScreenHeader` + `EmptyState` + copy explaining web parity.

### Screens refactored to use foundation

- `(tabs)/index.tsx` — `ScreenHeader`, `SectionCard` quick links, `KyarIcon`, `MetaLabel`.
- `(tabs)/builds.tsx` — `ScreenHeader`, `FilterTabs`, `EmptyState`, `useDataSource`.
- `(tabs)/closet.tsx` — `ScreenHeader`, `FilterTabs`, `EmptyState`, `useDataSource`.
- `(tabs)/planner.tsx` — `ProgressBar` for progress.

## Follow-ups (Phase 2+)

- Replace stub screens with real Groups / Discover / Feed flows.
- Migrate remaining screens (`build-detail`, `settings`, etc.) onto shared components.
- Optional: load Material Symbols font for pixel-perfect web parity.
- Complete Ionicons removal in non-tab screens (e.g. `build-detail`).
