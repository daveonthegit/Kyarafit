# Kyarafit Project Context Document

## Project Overview

**Kyarafit** is a mobile-first cosplay wardrobe and outfit planning application that helps cosplayers and fashion hobbyists organize, track, and design their costume pieces and builds. The project is proprietary and commercial with all rights reserved.

### Core Features

- **Closet Management**: Upload and organize costume pieces, wigs, and props
- **Build Tracking**: Track cosplay builds from idea to completion with progress milestones
- **Convention Planning**: Generate packing lists and day-by-day cosplay schedules
- **Offline Support**: Mobile works fully offline; syncs to cloud via Convex when signed in

### Target Users

- Cosplayers and fashion enthusiasts
- Creators planning builds and managing budgets
- Groups coordinating cosplay projects

---

## Technical Architecture

### Tech Stack

| Layer         | Technology                                                   |
| ------------- | ------------------------------------------------------------ |
| Database      | [Convex](https://convex.dev) (document DB, real-time)        |
| Auth          | [Better Auth](https://better-auth.com) (Google/GitHub OAuth) |
| Web           | Next.js 16 (App Router), TailwindCSS                         |
| Mobile        | React Native + Expo, local SQLite (offline-first)            |
| Image Service | Python + rembg (optional background removal)                 |
| Design System | Shared TypeScript types and design tokens                    |

### Project Structure

```
kyarafit/
├── convex/                   # Backend: database schema, queries, mutations
│   ├── schema.ts             # All table definitions
│   ├── closetItems.ts        # Closet CRUD (list, get, create, update, remove)
│   ├── builds.ts             # Builds CRUD + linkItems, getItems
│   ├── buildTasks.ts         # Build task checklist CRUD
│   ├── conventions.ts        # Conventions + day plans + packing list
│   ├── users.ts              # User profile (getMe, upsert)
│   ├── files.ts              # File upload/download helpers
│   ├── auth.ts               # getCurrentUser identity query
│   ├── auth.config.ts        # Better Auth registration
│   ├── convex.config.ts      # Component registration
│   ├── http.ts               # HTTP router for auth routes
│   └── betterAuth/           # Better Auth as a Convex component
│       ├── auth.ts           # OAuth provider config, Convex DB adapter
│       ├── schema.ts         # Auth tables (user, session, account, verification)
│       └── adapter.ts        # CRUD operations for auth
├── web/                      # Next.js web application
│   ├── src/app/              # App Router pages
│   ├── src/components/       # React components
│   │   ├── AuthGate.tsx      # Client-side route protection
│   │   └── ConvexClientProvider.tsx  # ConvexBetterAuthProvider wrapper
│   ├── src/hooks/            # Custom hooks (useCurrentUser)
│   └── src/lib/auth/         # Better Auth helpers (auth-client, auth-server)
├── mobile/                   # React Native + Expo app
│   ├── app/                  # Expo Router screens
│   └── src/                  # Storage, auth, components
├── image-service/            # Python background removal (optional)
├── design-system/            # Shared TypeScript types and tokens
├── backend-archived/         # Archived Go Fiber backend (no longer active)
└── docs/                     # Documentation
```

---

## Data Model (Convex)

All documents include `userId: string` for authorization. Every query/mutation checks ownership.

### closetItems

| Field             | Type                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| userId            | string                                                                     |
| name              | string                                                                     |
| category          | "wig" \| "prop" \| "armor" \| "garment" \| "shoe" \| "material" \| "other" |
| tags              | string[]                                                                   |
| notes             | string? (optional)                                                         |
| imageUrl          | string? (optional)                                                         |
| imageStorageId    | Id<"_storage">? (optional)                                                 |
| costCents         | number? (optional)                                                         |
| status            | string? (optional) — "planned" \| "in_progress" \| "complete"               |
| completionTaskId | Id<"buildTasks">? (optional) — task that drives item completion status    |

Indexes: `by_userId`, `by_userId_category`, `by_completionTaskId`

### builds

| Field        | Type                                       |
| ------------ | ------------------------------------------ |
| userId       | string                                     |
| name         | string                                     |
| status       | "idea" \| "wip" \| "ready" \| "archived"   |
| character    | string? (optional)                         |
| notes        | string? (optional)                         |
| imageUrl     | string? (optional)                         |
| imageStorageId | Id<"_storage">? (optional)                 |
| budgetCents  | number? (optional)                         |
| targetDate   | string? (optional, YYYY-MM-DD)             |
| tasksChecked | number (derived from buildTasks)           |
| tasksTotal   | number (derived from buildTasks)           |

List query also returns `totalCostCents` (sum of linked closet items’ cost). Indexes: `by_userId`, `by_userId_status`

### buildTasks

| Field        | Type               |
| ------------ | ------------------ |
| userId       | string             |
| buildId      | Id<"builds">? (optional — omit for closet-item-only tasks) |
| label        | string             |
| checked      | boolean            |
| sortOrder    | number             |
| closetItemId | Id<"closetItems">? (optional) |

Indexes: `by_buildId`, `by_userId`, `by_closetItemId`

### buildItemLinks

| Field        | Type              |
| ------------ | ----------------- |
| buildId      | Id<"builds">      |
| closetItemId | Id<"closetItems"> |

Indexes: `by_buildId`, `by_closetItemId`

### conventions

| Field     | Type                |
| --------- | ------------------- |
| userId    | string              |
| name      | string              |
| startDate | string (YYYY-MM-DD) |
| endDate   | string (YYYY-MM-DD) |
| location  | string? (optional)  |

Indexes: `by_userId`

### conventionDayPlans

| Field        | Type                |
| ------------ | ------------------- |
| userId       | string              |
| conventionId | Id<"conventions">   |
| date         | string (YYYY-MM-DD) |
| buildId      | Id<"builds">?       |
| notes        | string?             |

Indexes: `by_conventionId`

### packingListItems

| Field        | Type               |
| ------------ | ------------------ |
| userId       | string             |
| conventionId | Id<"conventions">  |
| label        | string             |
| checked      | boolean            |
| date         | string?            |
| buildId      | Id<"builds">?      |
| closetItemId | Id<"closetItems">? |
| isManual     | boolean            |

Indexes: `by_conventionId`

---

## Authentication

Better Auth runs as a Convex HTTP component. Supported methods: **email + password** (with verification and password reset) and **OAuth** (Google required, GitHub optional).

**Flow**: User clicks OAuth button → Better Auth redirects to provider → callback hits Convex HTTP action → session stored in Convex → `ConvexBetterAuthProvider` picks up token → all Convex queries run authenticated.

See `docs/auth.md` for detailed flow, environment variables, and setup instructions.

---

## Convex Functions Reference

### closetItems

- `api.closetItems.list({ userId, category?, search?, sortBy?, order? })` — list items (sortBy: name, category, cost, status)
- `api.closetItems.get({ id })` — get single item
- `api.closetItems.create({ userId, name, category, ..., status?, completionTaskId? })` — create item
- `api.closetItems.update({ id, userId, ..., status?, completionTaskId? })` — update item (completionTaskId null to clear)
- `api.closetItems.remove({ id, userId })` — delete item
- `api.closetItems.removeMany({ ids, userId })` — delete multiple items

### builds

- `api.builds.list({ userId, status?, search?, sortBy?, order? })` — list builds with task counts and totalCostCents
- `api.builds.get({ id })` — get single build with task counts
- `api.builds.getItems({ buildId })` — list linked closet item IDs
- `api.builds.getMostRecentForUser({ userId })` — most recently created build (for home hero)
- `api.builds.getBuildsUsingClosetItem({ closetItemId })` — builds that link this closet item (deduplicated)
- `api.builds.create({ userId, name, status, ... })` — create build
- `api.builds.update({ id, userId, ... })` — update build
- `api.builds.remove({ id, userId })` — delete build + tasks + links
- `api.builds.linkItems({ userId, buildId, closetItemIds })` — replace linked items (and auto-create completion tasks for new items without one)
- `api.builds.addItemsToBuild({ userId, buildId, closetItemIds })` — add closet items to a build (merge with existing; auto-create completion tasks for new items)
- `api.builds.updateStatusMany({ ids, userId, status })` — set status for multiple builds

### buildTasks

- `api.buildTasks.listByBuild({ buildId })` — list tasks for a build
- `api.buildTasks.listByClosetItem({ closetItemId })` — list tasks for a closet item (build + standalone), with buildName
- `api.buildTasks.create({ userId, buildId?, closetItemId?, label, sortOrder? })` — create task (either buildId or closetItemId required)
- `api.buildTasks.update({ id, userId, ... })` — update task (checked, closetItemId, label; toggling completion task syncs closet item status)
- `api.buildTasks.remove({ id, userId })` — delete task (clears closet item completionTaskId if set)

### conventions

- `api.conventions.list({ userId })` — list all conventions
- `api.conventions.get({ id })` — get single convention
- `api.conventions.getPlan({ conventionId })` — get day plans
- `api.conventions.getPacking({ conventionId })` — get packing list items
- `api.conventions.create({ userId, name, startDate, endDate, ... })` — create
- `api.conventions.update({ id, userId, ... })` — update
- `api.conventions.remove({ id, userId })` — delete convention + cascade
- `api.conventions.replacePlan({ userId, conventionId, plan })` — replace day plan
- `api.conventions.updatePackingItem({ id, userId, checked, label })` — toggle packing item
- `api.conventions.addManualPackingItem({ userId, conventionId, label })` — add manual item
- `api.conventions.regeneratePacking({ userId, conventionId })` — regenerate packing list

### auth

- `api.auth.getCurrentUser()` — returns current user identity (subject, name, email)

---

## Web Application

### Auth

- `web/src/lib/auth/auth-client.ts` — `authClient` (useSession, signIn.social, signOut)
- `web/src/lib/auth/auth-server.ts` — `getToken()` for SSR, `handler` for route
- `web/src/app/api/auth/[...all]/route.ts` — auth routes (GET/POST)
- `web/src/components/AuthGate.tsx` — redirects unauthenticated users to `/auth/signin`
- `web/src/components/ConvexClientProvider.tsx` — `ConvexBetterAuthProvider` wrapping app

### Data Access Pattern

All pages use Convex hooks directly (no intermediate API layer):

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const { userId } = useCurrentUser();
const items = useQuery(api.closetItems.list, userId ? { userId } : "skip");
const create = useMutation(api.closetItems.create);
```

---

## Mobile Application

The mobile app uses **local SQLite** for offline-first storage (anonymous + free users). When signed in, the Convex client is available for cloud sync.

- Auth: `mobile/src/lib/auth/client.ts` — `authClient` (Better Auth + Convex plugin)
- Local storage: `mobile/src/storage/` — SQLite repos for closet, builds, conventions, packing
- The mobile screens currently use local SQLite repos; Convex cloud sync is wired via `ConvexBetterAuthProvider` in `_layout.tsx`

---

## Development Setup

See [README.md](../README.md) for full setup instructions.

**Quick summary:**

1. `npm install`
2. `npx convex dev` (initializes Convex project, generates `.env.local`)
3. Set OAuth credentials in Convex dashboard
4. `npm run dev:web` + `npx convex dev` (two terminals)

---

## Code Standards

- **TypeScript**: Strict mode, no `any`, Zod for Convex input validation
- **Formatting**: Prettier (all JS/TS/JSON/MD), gofmt (archived backend)
- **Linting**: ESLint (web + mobile)
- **CI**: Run `npm run validate` (or `npm run ci` / `npm run ci:win`) before pushing — zero failures expected
