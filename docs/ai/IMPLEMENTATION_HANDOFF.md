# Implementation handoff — continuing Kyarafit

Read [AI_CONTEXT.md](../AI_CONTEXT.md), [architecture](../ARCHITECTURE.md),
[roadmap status](../ROADMAP.md), and the current assigned brief before writing code.
This replaces the historical Phase-0 restart prompt; original instructions remain in Git history.

## Authority and scope

The current brief supplies the goal, acceptance criteria, owned files, dependencies, and delivery
contract. Agentflow is deprecated; do not invoke it or modify `.agentflow/` / `WORK.md`.
Preserve supplied Work-Item identifiers for already-approved work. Do not reinterpret an accepted
future design as already implemented, or refactor another package's files in parallel.

## Source-of-truth map

- [Product requirements](../PRODUCT_SPEC.md) and [data/sync requirements](../DATA_AND_SYNC.md)
- [Architecture](../ARCHITECTURE.md) and [testing](../TESTING.md)
- [Design-system contract](../DESIGN_SYSTEM.md) and [Glass Studio handoff](../redesign/HANDOFF.md)
- [Domain language](../../CONTEXT.md) and [ADR decisions/status](../adr/)

The old OQ-1/OQ-2 design/navigation selections are settled. Entitlement/storage and sync-method
requirement amendments belong to their implementation packages. Existing legacy behavior and
new accepted requirements can differ; reconcile them explicitly rather than weakening tests.

## Working conventions

- Preserve local-first bridges and legitimate online-only/public flows.
- Keep shared domain logic pure and platform-specific code in adapters/UI.
- Never delete legacy schema definitions without their purge/deployment preconditions.
- Verify behavior through executable interfaces, not source-string checks or style snapshots.
- Format only touched files; no blanket formatting churn.
- Validate with `npm run validate`, explicit web/mobile suites, and applicable backend typecheck.
  See [CI_LOCAL.md](../../CI_LOCAL.md) for the differing aggregate commands.
- Authorized dev-provider/device verification is separate from unit CI; production is not a test target.

Publication, deployment, native-device acceptance, and feature implementation are distinct gates.
Passing tests or a pushed branch is not a clean-security or live-rollout guarantee.
