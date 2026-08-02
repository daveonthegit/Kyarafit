# Kyarafit — Agent instructions

The canonical agent instructions for this repo live in [`CLAUDE.md`](./CLAUDE.md). Read that file, including its `## Agent skills` section and the referenced `docs/agents/*.md`.

<!-- agentflow:start -->

## Agentflow

When the user explicitly asks to use Agentflow, follow the project-local
`agentflow` skill. Do not bypass its verification or human-approval gates.

### Working conventions (always apply)

These conventions apply to all work in this repository, whether or not you are
running Agentflow:

- **Consult `WORK.md` before starting.** It mirrors the open Work Items; pick
  the one you intend to deliver before you write code.
- **Carry the Work-Item id in your commits.** Add a `Work-Item: <id>` trailer
  so the work you land is matched to its open item.
- **Propose first for uncovered work.** If what you need to do is not an open
  Work Item, drop a JSON proposal into `.agentflow/proposals/`; a human ingests
  proposals into the Work Graph during Framing.
- **Never edit `.agentflow/work/` directly.** The Work Graph is mutated only
  through Agentflow; direct edits are rejected.

<!-- agentflow:end -->

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
