# Kyarafit – Project Structure

## Monorepo Layout

```
Kyarafit/
├── convex/           # Backend: Convex (database, queries, mutations, file storage, auth HTTP)
├── web/              # Next.js web app
├── mobile/           # Expo React Native app
├── image-service/    # Optional Python image processing (e.g. rembg)
├── design-system/    # Shared TypeScript types and design tokens
├── backend-archived/ # Archived Go Fiber backend (not used by web or mobile)
├── docs/
└── README.md
```

## Convex (Backend)

```
convex/
├── schema.ts         # Database schema (users, closetItems, builds, buildTasks, conventions, …)
├── closetItems.ts    # Closet CRUD
├── builds.ts         # Builds CRUD + linkItems, getItems
├── buildTasks.ts     # Build task checklist CRUD
├── conventions.ts    # Conventions, day plans, packing list
├── users.ts          # User profile (getMe, upsert)
├── files.ts          # File upload (generateUploadUrl, getUrl)
├── auth.ts           # getCurrentUser identity query
├── auth.config.ts    # Convex JWT provider (Better Auth)
├── convex.config.ts  # Component registration
├── http.ts           # HTTP router (CORS, Better Auth routes)
├── emailHelpers.ts   # Email (e.g. Resend) for verification/reset
└── betterAuth/       # Better Auth Convex component
    ├── auth.ts       # Auth config, providers, trusted origins
    ├── schema.ts     # Auth tables (user, session, account, verification, jwks)
    └── adapter.ts    # Convex adapter for Better Auth
```

## Web

```
web/
├── src/
│   ├── app/          # Next.js App Router (home, closet, builds, conventions, auth, …)
│   ├── components/   # UI and layout (AuthGate, ConvexClientProvider, TaskChecklist, ImageUpload, …)
│   ├── hooks/        # useCurrentUser, etc.
│   └── lib/
│       └── auth/     # Better Auth client, server helpers, bearer storage
└── ...
```

## Mobile

```
mobile/
├── app/              # Expo Router screens (tabs, closet, builds, conventions, build-detail, …)
└── src/
    ├── lib/auth/     # Better Auth client, bearer storage
    ├── hooks/        # useCurrentUser, useConvexSync
    ├── services/     # convexSync.ts (Convex ↔ SQLite)
    └── storage/      # SQLite repos (offline)
```

## Archived Backend (Reference Only)

The Go Fiber API in `backend-archived/` (or `backend/` if still present) is no longer used. Web and mobile use Convex only. See [MIGRATION.md](MIGRATION.md).
