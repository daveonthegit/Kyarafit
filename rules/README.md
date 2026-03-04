# Rules

This folder contains **rule docs** (`.mdc` and README) that define patterns, conventions, and guidelines for the Kyarafit codebase. They are aligned with the **current stack** (Convex + Better Auth, Next.js, Expo) and with [docs/implementation/](../docs/implementation/).

## When to use

- **Before implementing a feature:** Check backend-patterns, frontend-patterns, and testing-patterns for structure and examples.
- **Before pushing:** Follow commit-and-pr-guidelines and run local validation (see ci-cd-patterns; also [.cursor/rules/local-ci-validation.mdc](../.cursor/rules/local-ci-validation.mdc)).
- **When touching auth, CORS, or secrets:** Read security-patterns.
- **When adding observability:** Read observability-patterns (lightweight; logging/metrics basics).

## Rule docs

| Doc                                                          | Purpose                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| [backend-patterns.mdc](backend-patterns.mdc)                 | Convex structure, queries/mutations/actions, auth, validation, error handling, config; example "new resource".  |
| [frontend-patterns.mdc](frontend-patterns.mdc)               | Next.js App Router, Convex hooks, components, forms, styling; mobile Expo + Convex; example "new feature page". |
| [testing-patterns.mdc](testing-patterns.mdc)                 | Test pyramid, unit/integration/e2e, dirs and naming, mocking (Convex); minimal templates.                       |
| [ci-cd-patterns.mdc](ci-cd-patterns.mdc)                     | Pipeline stages, npm validate/ci, caching, secrets, env, previews (Vercel), release.                            |
| [security-patterns.mdc](security-patterns.mdc)               | Auth (bearer, OAuth), CORS/trusted origins, validation, secrets, dependency audit.                              |
| [observability-patterns.mdc](observability-patterns.mdc)     | Logging (Convex), optional metrics/tracing.                                                                     |
| [commit-and-pr-guidelines.mdc](commit-and-pr-guidelines.mdc) | Commit style, PR size, checklist, definition of done; links to PR template.                                     |

## Implementation docs

Planning and status live in **[docs/implementation/](../docs/implementation/)**:

- [README](../docs/implementation/README.md) — Stack summary and where to start
- [FEATURES_CANONICAL.md](../docs/implementation/FEATURES_CANONICAL.md) — Feature list and acceptance criteria
- [FEATURE_STATUS.md](../docs/implementation/FEATURE_STATUS.md) — Implemented vs gaps
- [GAP_ANALYSIS.md](../docs/implementation/GAP_ANALYSIS.md) — Remaining work by area
- [ROADMAP.md](../docs/implementation/ROADMAP.md) — Phased roadmap
- [COMMIT_PLAN.md](../docs/implementation/COMMIT_PLAN.md) — PR-sized commit plan
