# Architecture

_Source of truth for **code structure, shared logic, boundaries, and conventions**. Product behavior
→ [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md); data/sync → [`DATA_AND_SYNC.md`](DATA_AND_SYNC.md)._

---

## 1. Stack

| Layer    | Tech                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Backend  | **Convex** (document DB, queries/mutations/actions, file storage, crons)                                                     |
| Auth     | **Better Auth** as a Convex component (`convex/betterAuth/`); `identity.subject` = user `externalId` = `userId` on every row |
| Web      | **Next.js** (App Router), React 19, Tailwind, Convex React hooks                                                             |
| Mobile   | **Expo / React Native**, Convex + local **SQLite**                                                                           |
| Shared   | `design-system/` — OKLCH tokens + **all platform-agnostic domain/sync/entitlement logic**                                    |
| Billing  | **RevenueCat** → webhook → `convex/revenuecat.ts` → `users.tier`                                                             |
| Monorepo | npm workspaces: `web`, `mobile`, `design-system`                                                                             |

---

## 2. Layering & boundaries

```
            ┌─────────────── platform UI (web / mobile) ───────────────┐
            │  Next.js pages / RN screens  +  platform-native primitives │
            └───────────────┬───────────────────────────┬───────────────┘
                            │ useOfflineQuery/Mutation   │  (online-only: direct Convex)
            ┌───────────────▼───────────────┐   ┌────────▼─────────┐
            │  offline bridge (per platform) │   │ social/groups/   │
            │  LocalStore + sync worker      │   │ billing (online) │
            └───────────────┬───────────────┘   └────────┬─────────┘
                            │  (paid + online only)       │
                    ┌────────▼─────────────────────────────▼────────┐
                    │                 Convex backend                 │
                    └────────────────────────────────────────────────┘
                            ▲
            ┌───────────────┴───────────────┐
            │  design-system/ (shared logic) │  ← imported by web + mobile + Convex
            └────────────────────────────────┘
```

- **B1** Local-first data: UI → `useOfflineQuery`/`useOfflineMutation` → `LocalStore` → (paid) sync worker → Convex. **No direct Convex hooks** for local-first data (ESLint guard on both platforms).
- **B2** Online-only data (social, groups, billing, public pages): UI → Convex hooks directly, wrapped in an online-guard/offline-banner component.
- **B3** All business logic, validation, types, entitlement checks, sync/merge/queue logic, and ID rules live in `design-system/` and are imported everywhere. Platform packages contain only UI + platform adapters (storage, connectivity, image capture).

---

## 3. Shared package (`design-system/`)

| Area                    | Module(s)                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain logic            | `domain/workflowDomain.ts`, `workflowProgress.ts`, `cosplay*`, planner overlays                                                                                                                  |
| Entitlements            | `domain/entitlements.ts`, `subscriptionTierPolicy.ts`, `subscriptionPlans.ts`                                                                                                                    |
| Sync (pure)             | `domain/offlineMutationQueue.ts`, `offlineQueryCache.ts`, `offlineIdMap.ts`, `offlineEntityOverlay.ts`, planner/build-tree overlays                                                              |
| **New (this refactor)** | `domain/syncPolicy.ts` (worker gating), `domain/cloudStoragePolicy.ts` (caps + group exception), `domain/offlineConflict.ts` (field LWW merge), shared `LocalStore` interface, shared validators |
| Tokens                  | `design_tokens.json`, `rn_tokens.ts`, Tailwind config                                                                                                                                            |

- **A1** `design-system/domain/*` must be **pure** (no React, no platform imports) so it runs in web vitest, mobile, and Convex.
- **A2** Validation schemas are shared and used by both client (form validation) and Convex (arg validation) — single definition.

---

## 4. Platform adapters (the only platform-specific glue)

| Adapter       | Mobile                            | Web                         |
| ------------- | --------------------------------- | --------------------------- |
| `LocalStore`  | `expo-sqlite`                     | OPFS+wa-sqlite / Dexie      |
| Connectivity  | `@react-native-community/netinfo` | `navigator.onLine` + events |
| Image capture | camera / picker (`expo-*`)        | `<input type=file>`         |
| Secure token  | `expo-secure-store`               | `localStorage`              |

Both expose the **same interface** consumed by shared sync logic.

---

## 5. Convex backend conventions

- **C1** Thin function wrappers; logic in plain TS helpers (import from `design-system` where shared). Validate args + return types with `v.*` / shared validators.
- **C2** Auth in every public function via `ctx.auth.getUserIdentity()`; scope rows by `identity.subject`.
- **C3** Offline-replayable mutations use the idempotency pattern (`convex/lib/idempotency.ts`) and are registered in the offline bridge's idempotent-mutation list.
- **C4** Use indexes, never `filter()`, for queries; paginate large datasets.
- **C5** Custom function wrappers enforce per-user data protection (Convex's RLS equivalent).
- **C6** Schedule only internal functions; never `Date.now()` inside queries.

---

## 6. Folder conventions

```
convex/                 # backend (schema.ts, <module>.ts, lib/, betterAuth/, crons.ts)
design-system/
  domain/               # pure shared logic (tested via web vitest)
  *tokens*              # design tokens
web/src/
  app/                  # routes
  components/           # platform UI (follow DESIGN_SYSTEM component spec)
  lib/                  # web adapters + offline bridge + tests
mobile/
  app/                  # Expo Router screens
  src/offline/          # mobile offline bridge (LocalStore, sync worker)
  src/ui/               # mobile primitives
docs/                   # consolidated docs (this set)
```

- **N1** One concept = one name everywhere (e.g. **Elements**, not item/closet/node). Web and mobile primitives that do the same job share the same name and prop shape (see [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)).
- **N2** Feature code is grouped by module (elements, builds, conventions, planner, social, groups, settings).

---

## 7. State management

- **S1** Server/local-first data state comes from `useOfflineQuery` (reactive over `LocalStore` + Convex). No duplicate global cache.
- **S2** Ephemeral UI state is local component state / lightweight context. Avoid a global store for data that the offline bridge already owns.

---

## 8. Performance (hard requirements)

- **P1** Local reads/writes feel instant (<~100 ms); never block on network (REQ-100).
- **P2** Cold start interactive < ~2 s on mid-tier mobile.
- **P3** Lists of 1000+ items paginate/virtualize and stay smooth.
- **P4** Free users make **zero** Convex data calls (REQ-D10) — verified by assertion/test.
- **P5** Web bundle + image payload budgets enforced (lazy-load heavy/social routes; responsive images).
