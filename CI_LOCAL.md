# Running validation locally

The root [`package.json`](package.json), [`Makefile`](Makefile), and
[GitHub workflows](.github/workflows/) are the executable authorities. Their aggregate commands
are **not identical**. A green local run does not certify provider/device behavior or deployment.

## Install

Use Node.js 20.9+ (or a newer supported LTS) and the workspace lockfile:

```bash
npm ci
```

## Required commands

```bash
npm run validate
npm test -w web
npm test -w mobile
npx tsc -p convex/tsconfig.json --noEmit
```

`npm run validate` runs, in order: format → i18n → all workspace linters → web/mobile types →
Convex tests → web build. It does **not** run web or mobile unit tests, or the standalone backend
typecheck; run those explicitly.

`make validate` runs format → web/mobile lint → web/mobile types → web build → web/mobile/Convex
tests. It does **not** include the i18n check or design-system lint. The standalone CI scripts have
their own sequence; do not treat them as interchangeable with the root npm gate.

## Individual checks

| Command                | Scope                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run format:check` | Unignored JS/TS/JSON/Markdown formatting                            |
| `npm run i18n:check`   | Locale key parity                                                   |
| `npm run lint`         | Web, mobile, and design-system lint                                 |
| `npm run typecheck`    | Web and mobile TypeScript                                           |
| `npm run test:convex`  | In-memory backend tests; no deployment required                     |
| `npm run build:web`    | Next.js production build; needs documented Convex URL configuration |
| `npm test -w web`      | Web and shared-domain Vitest tests, including a11y checks           |
| `npm test -w mobile`   | Mobile Vitest tests, with native-package stubs                      |

For build-only validation without live requests, use synthetic URL values rather than live configuration;
never fetch production credentials or point a behavioral test at production. See
[.env.example](.env.example) for variable names and [testing strategy](docs/TESTING.md) for E2E.

## Formatting failures

Run Prettier only on touched files. If the aggregate check reports pre-existing debt elsewhere,
record the exact failing paths and let the owning package/integrator handle it. Do not run a
blanket `npm run format` to bury unrelated changes. The aggregate gate must still be reported
honestly as failed until its debt is resolved.

## Separate development gates

Web E2E is [manual](.github/workflows/web-e2e.yml), not a normal push/PR job. It requires an
authorized development deployment and synthetic account fixtures; missing credentials cause
explicit skips, not evidence of acceptance. Native E2E/device checks and OAuth/billing/media
provider tests likewise cannot be replaced by unit CI.

Dependency audit (`npm audit`) and secret scanning complement tests. Never paste credentials,
personal data, or detailed private findings into a public PR or log.
