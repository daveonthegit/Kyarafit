# Kyarafit – Architecture

## Overview

Mobile-first cosplay wardrobe and planning app. Backend and auth are provided by **Convex** and **Better Auth**; web and mobile use Convex as the source of truth when signed in.

- **Backend & DB**: Convex (document database, real-time queries, mutations, file storage)
- **Auth**: Better Auth (Google/GitHub OAuth, email+password) running as a Convex HTTP component
- **Web**: Next.js 16, Convex React hooks (`useQuery` / `useMutation`)
- **Mobile**: React Native + Expo; local SQLite for offline; Convex for cloud when signed in (with Convex→SQLite sync)

## High-Level Flow

```
Web (Next.js) / Mobile (Expo)
        │
        │  Convex React client (useQuery / useMutation)
        │  Auth: Better Auth → Convex HTTP (*.convex.site)
        ▼
Convex backend
        │  Queries / Mutations (auth via ConvexBetterAuthProvider)
        │  File storage (api.files.generateUploadUrl / getUrl)
        ▼
Convex database (closetItems, builds, buildTasks, conventions, …)
```

## Image Flow

1. Client calls `api.files.generateUploadUrl` (Convex mutation).
2. Client uploads the file to the returned URL (Convex file storage).
3. Client calls `api.files.getUrl` with the returned `storageId` to get a public URL.
4. Client updates the entity (closet item, build, convention) with that URL via the relevant Convex mutation.

Optional: an external **image service** (Python + rembg) can be used for background removal; the app can call it before or after upload and then store the processed image URL in Convex.

## Offline Strategy

- **Web**: Convex is the source of truth when signed in; no local IndexedDB sync layer. Offline behavior is limited to cached Convex subscriptions.
- **Mobile**: Local SQLite holds closet, builds, conventions, packing. When signed in, `useConvexSync` (and `convexSync.ts`) syncs Convex data into SQLite; local mutations can be pushed to Convex via the same Convex client.

## Legacy / Archived

The previous stack (Go Fiber API, Supabase PostgreSQL, Supabase Auth, Supabase Storage) has been replaced. The Go backend remains in `backend-archived/` for reference only and is not used by web or mobile. See [MIGRATION.md](MIGRATION.md) for the migration summary.
