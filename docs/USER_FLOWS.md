# Kyarafit User Flows

**Current flows** are documented in the following places. The app uses **Convex + Better Auth** (no Go REST API, no device-scoped backend).

## Where to find flow documentation

- **[implementation/FEATURES_CANONICAL.md](implementation/FEATURES_CANONICAL.md)** — Canonical feature list with acceptance criteria (auth, closet, builds, build tasks, conventions, itinerary, packing, planner, settings, tiers, mobile sync, image upload, seed data).
- **[CONTEXT.md](CONTEXT.md)** — Tech stack, project structure, Convex data model, and function reference (queries/mutations by module).
- **[implementation/FEATURE_STATUS.md](implementation/FEATURE_STATUS.md)** — What’s implemented vs partial vs not implemented, with evidence (file paths).
- **[implementation/IMPLEMENTATION_GUIDES_INDEX.md](implementation/IMPLEMENTATION_GUIDES_INDEX.md)** — Step-by-step guides for each gap (builds, itinerary, packing, planner, settings, subscription, etc.).
- **[WEB_MOBILE_PARITY_REVIEW.md](WEB_MOBILE_PARITY_REVIEW.md)** — Web vs mobile parity (e.g. drag-and-drop on web, modal-based on mobile).

## High-level flow

- **Auth:** Better Auth (email/password + OAuth). See [auth.md](auth.md).
- **Data:** Convex only when signed in. Web: `useQuery`/`useMutation`. Mobile: Convex + local SQLite with `useConvexSync` / `convexSync.ts` for offline and sync.
- **Progressive workflow:** Closet → Builds → Conventions → Packing (unchanged conceptually; implementation is Convex-backed).

For legacy user flows (Go + device_id + REST), see [MIGRATION.md](MIGRATION.md).
