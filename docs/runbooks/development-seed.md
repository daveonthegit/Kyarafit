# Development-only sample data

`/dev/seed` is available only when the Next.js server runs in development; production requests
return not-found before mounting the client form. The backend mutation also rejects calls unless
its own runtime has both `NODE_ENV=development` and `ENABLE_DEV_SEED=true`. A development web
client cannot enable a production backend. Missing runtime values disable seeding by default.

Only an authorized operator may configure these flags on a dedicated development deployment.
Convex runtimes do not necessarily provide `NODE_ENV`; if it is absent, seeding remains disabled.
Do not set development flags on a production deployment. No examples or production configuration
are changed by this runbook.

A signed-in synthetic development user can load a sample build, convention, element, and legacy
sample task. Existing builds cause a retry to skip without duplication. This is not a production
migration tool, onboarding feature, or complete fixture for paid/backfill E2E scenarios.

Behavioral regression checks:

```bash
npm run test:convex -- seed.test.ts
npm test -w web -- src/app/dev/seed/page.test.tsx
```

See [testing strategy](../TESTING.md) for live development fixtures and
[deployment preflight](../setup/DEPLOY_README.md) for operator boundaries.
