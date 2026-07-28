# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Backend authorization — the invariant

A public Convex function derives the acting user from the session
(`convex/lib/authz.ts`: `requireIdentity` for mutations, `optionalIdentity` for queries),
**never** from an argument. The `userId` / `ownerId` / `externalId` arguments still in the
validators are `v.optional` and deliberately ignored — they exist only so already-deployed
clients keep working, and are removed in a later cosmetic pass.

Read [`docs/backend-authorization.md`](docs/backend-authorization.md) before touching
anything in `convex/`. It covers which arguments are _not_ actor arguments, which endpoints
are public by design and must not be locked down, the media rule in `lib/mediaAccess.ts`,
and the shared build-visibility predicate `canReadBuildWorkflowData`.

## Commands

- `npm run validate` — the full gate (format, i18n keys, lint, typecheck, backend tests, web build).
- `npm run test:convex` — backend authorization tests (`convex/authz.test.ts`, via `convex-test`).
- `npm run test -w web` — web unit tests.
- `npx tsc -p convex/tsconfig.json --noEmit` — typecheck the Convex functions alone; much
  faster than the full `typecheck` when iterating on `convex/`.
- `npm run build:web` needs `CONVEX_SITE_URL` and the `NEXT_PUBLIC_CONVEX_*` vars set, or it
  fails collecting page data. See `.env.example`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
