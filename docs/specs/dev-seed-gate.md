# Small cleanup proposal — development seed gate

## Scope and rationale

A development-only route must not mount its form in production, and disabling a client button
is not a backend execution boundary. This narrowly scoped cleanup preserves development sample
data behavior while rejecting non-development backend requests by default.

## Accepted implementation under the documentation/cleanup brief

- Wrap `/dev/seed` with a server-side development check returning not-found otherwise.
- Require explicit development runtime and seed opt-in on `convex/seed.ts` before any reads/writes.
- Preserve session-derived ownership and the existing once-per-user behavior.
- Document the default-disabled development setup without editing shared auth/environment examples.

## Validation and exclusions

Execute the route and Convex mutation interfaces: production rejection, missing opt-in, missing
session, successful owner seed, and retry deduplication. Do not deploy, configure a live runtime,
read user data, change schemas, or redesign sample data. Current auth documentation and the
entitlement/sync requirement amendments are separate work.

Operational instructions: [development seed runbook](../runbooks/development-seed.md).
