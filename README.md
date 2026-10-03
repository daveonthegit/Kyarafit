# Kyarafit

A mobile-first cosplay wardrobe and convention-planning app, with web and Expo clients.

Build-scoped **elements** → character **builds** → progress timelines → convention day plans
and packing lists. Personal-data editing is local-first; social, groups, billing, and public
sharing are online features.

> Start with [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md), the [domain glossary](CONTEXT.md), and
> the [documentation index](docs/README.md). Agent instructions are in [AGENTS.md](AGENTS.md).

## Implementation status

The repository contains local-first storage, managed cloud sync, export/import, convention
planning, progress updates, social/group features, and the Glass Studio web redesign. Mobile
Glass Studio events and social screens are implemented but await owner-device acceptance;
settings and build-detail feedback remain. See the [handoff](docs/redesign/HANDOFF.md).

**Accepted, not yet implemented:** the two-tier entitlement change, R2 hosted-media pipeline,
and Google Drive BYO sync with Off/Drive/Cloud settings. Existing entitlement/storage rules
are still legacy rules; do not infer current behavior from the target glossary or ADRs.
See the [roadmap](docs/ROADMAP.md) and [ADR status notes](docs/adr/).

Repository code, passing tests, a published branch, and a live deployment are different states.
Authorization remediation remains in progress; this README is not a security or rollout guarantee.

## Stack and layout

| Path             | Responsibility                                                               |
| ---------------- | ---------------------------------------------------------------------------- |
| `convex/`        | Convex database/functions/storage, Better Auth component, RevenueCat webhook |
| `web/`           | Next.js App Router, React, Tailwind, browser local-store adapters            |
| `mobile/`        | Expo / React Native, SQLite, native adapters                                 |
| `design-system/` | Shared pure TypeScript domain logic, types, and design tokens                |
| `docs/`          | Product requirements, architecture, tests, decisions, and runbooks           |

Legacy persistence names do not necessarily match current product terms. See
[architecture](docs/ARCHITECTURE.md) before changing schemas.

## Development setup

Use Node.js 20.9+ (or a newer supported LTS) and npm. Work against a dedicated **development**
Convex project, never production data.

```bash
git clone https://github.com/daveonthegit/Kyarafit.git
cd Kyarafit
npm ci
```

1. Review [.env.example](.env.example) and [mobile/.env.example](mobile/.env.example).
   Keep local environment values out of Git.
2. With owner authorization, `npx convex dev` links a development project and synchronizes
   backend functions. This is a deployment operation, not an offline test command.
3. Configure `web/.env.local` with the development deployment's `NEXT_PUBLIC_CONVEX_URL`,
   `NEXT_PUBLIC_CONVEX_SITE_URL`, and `CONVEX_SITE_URL`. See
   [auth setup](docs/auth.md) for the existing provider configuration.
4. In separate terminals:

   ```bash
   npm run dev:web
   npm run start -w mobile
   ```

Web runs at http://localhost:3000. Expo device testing needs a suitable development client or
compatible Expo Go setup. For transactional mail use the [Resend API guide](docs/integrations/RESEND_SETUP.md),
not the retired Go/SMTP instructions.

## Validation

```bash
npm run validate                            # format, i18n, lint, types, backend tests, web build
npm test -w web                             # web + shared domain tests (explicit additional gate)
npm test -w mobile                          # mobile tests (explicit additional gate)
npx tsc -p convex/tsconfig.json --noEmit      # backend typecheck
```

The npm and Make aggregate gates are not identical. See [CI_LOCAL.md](CI_LOCAL.md) and
[testing strategy](docs/TESTING.md). Pre-existing formatting failures should be reported,
not hidden by a repository-wide formatting change. Format only the files you change.
Live E2E, native-device acceptance, and provider integration tests require authorized development targets.

## Deployment

Only an authorized operator chooses and deploys a verified release lineage. Confirm the actual
backend revision and schema before rollout; do not replace a live feature-line schema with an
older main-line schema. Checked-in host configs alone do not establish the live host.
See [deployment preflight](docs/setup/DEPLOY_README.md).

## Documentation

- [Product requirements](docs/PRODUCT_SPEC.md) and [data/sync requirements](docs/DATA_AND_SYNC.md)
- [Architecture](docs/ARCHITECTURE.md) and [testing](docs/TESTING.md)
- [Glass Studio design](docs/redesign/README.md) and [design-system contract](docs/DESIGN_SYSTEM.md)
- [Security reporting policy](docs/SECURITY.md)
- [Contributing](docs/CONTRIBUTING.md)

## License

[MIT](LICENSE).
