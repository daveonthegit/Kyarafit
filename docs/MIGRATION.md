# Migration: Supabase + Go Fiber → Convex + Better Auth

## Overview

This migration replaces the entire Supabase stack (PostgreSQL, Auth, Storage) and Go Fiber backend with **Convex** (backend, database, file storage) and **Better Auth** (OAuth authentication via Google/GitHub).

## What Changed

### Architecture (Before → After)

| Layer          | Before                         | After                                     |
| -------------- | ------------------------------ | ----------------------------------------- |
| Database       | Supabase PostgreSQL            | Convex (document DB)                      |
| Auth           | Supabase Auth (email/password) | Better Auth (Google/GitHub OAuth)         |
| Backend API    | Go Fiber REST (~50 routes)     | Convex functions (queries/mutations)      |
| File Storage   | Supabase Storage (HTTP)        | Convex file storage                       |
| Web Data Layer | React Query + fetch()          | Convex React hooks (useQuery/useMutation) |
| Mobile Auth    | Supabase Auth + AsyncStorage   | Better Auth + Convex RN client            |

### Files Removed

- `web/src/lib/supabase/` (client.ts, server.ts, storage.ts)
- `web/src/lib/auth/client.ts` (old Supabase auth shim)
- `web/src/lib/auth/config.ts` (old auth types)
- `web/src/lib/api/builds.ts`, `closet.ts`, `conventions.ts`, `me.ts` (Go backend API calls)
- `web/src/lib/services/sync.ts` (dead sync service)
- `web/src/lib/storage/` (IndexedDB repos: db.ts, buildsRepo.ts, outboxRepo.ts)
- `web/src/lib/deviceId.ts` (device ID for Go backend)
- `web/src/components/QueryProvider.tsx` (React Query wrapper)
- `web/prisma/schema.prisma` (unused Better Auth schema artifact)

### Files Created

- `convex/schema.ts` — Database schema (users, closetItems, builds, buildItemLinks, buildTasks, conventions, conventionDayPlans, packingListItems)
- `convex/closetItems.ts`, `builds.ts`, `buildTasks.ts`, `conventions.ts`, `users.ts`, `files.ts` — CRUD functions with authorization
- `convex/auth.ts` — Auth identity query
- `convex/auth.config.ts` — Better Auth provider config
- `convex/convex.config.ts` — Component registration
- `convex/http.ts` — HTTP router for auth routes
- `convex/betterAuth/` — Better Auth Convex component (auth.ts, schema.ts, adapter.ts, convex.config.ts)
- `web/src/lib/auth/auth-client.ts` — Better Auth React client
- `web/src/lib/auth/auth-server.ts` — Better Auth Next.js server helpers
- `web/src/components/ConvexClientProvider.tsx` — Convex + Better Auth provider
- `web/src/hooks/useCurrentUser.ts` — Auth identity hook

### Packages

**Added**: `convex`, `@convex-dev/better-auth`, `better-auth@1.4.9`

**Removed**: `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-query` (web only)

## Environment Variables

### Required (in `web/.env.local`)

```
CONVEX_DEPLOYMENT=dev:your-deployment
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_SITE_URL=https://your-deployment.convex.site
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
```

### Required (in Convex dashboard environment variables)

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
BETTER_AUTH_SECRET=your-random-secret
```

### Optional

```
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## Data Model

All Convex documents include `userId: string` for authorization. Every query and mutation verifies ownership.

| Table              | Purpose                           | Key Indexes                 |
| ------------------ | --------------------------------- | --------------------------- |
| users              | User profiles and tier            | by_externalId               |
| closetItems        | Wardrobe pieces                   | by_userId                   |
| builds             | Cosplay build projects            | by_userId                   |
| buildItemLinks     | Build ↔ closet item relationships | by_buildId, by_closetItemId |
| buildTasks         | Task checklist items per build    | by_buildId                  |
| conventions        | Convention events                 | by_userId                   |
| conventionDayPlans | Day-by-day build assignments      | by_conventionId             |
| packingListItems   | Generated packing checklists      | by_conventionId             |

## Auth Flow

1. User clicks "Continue with Google" (or GitHub)
2. Better Auth redirects to OAuth provider
3. On callback, Better Auth creates session in Convex
4. `ConvexBetterAuthProvider` picks up the session token
5. All Convex queries/mutations receive the authenticated identity
6. `useCurrentUser()` hook provides `userId` (identity subject) to components

## Mobile

- Auth screen updated to OAuth buttons (Google/GitHub) + "Continue without account"
- Convex + Better Auth providers wrap the app layout
- Local SQLite storage remains for offline/anonymous users
- Sync service neutralized (returns null token) — will be replaced with Convex sync

## Go Backend

The Go Fiber backend remains in the `backend/` directory but is no longer called by the web or mobile frontends. It can be archived or removed in a future cleanup.
