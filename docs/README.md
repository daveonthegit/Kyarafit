# Kyarafit Documentation

Start with [`AI_CONTEXT.md`](AI_CONTEXT.md) — the compact, high-signal entry point.

## Source-of-truth map

| Doc                                                                  | Purpose                | Owns                                                        |
| -------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| [`AI_CONTEXT.md`](AI_CONTEXT.md)                                     | First file to load     | summary, decisions, commands                                |
| [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md)                                 | Product behavior       | modules, REQ IDs, freemium, acceptance criteria, edge cases |
| [`DATA_AND_SYNC.md`](DATA_AND_SYNC.md)                               | Data & local-first     | data model, sync, conflict, migration, quotas, deletion     |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                                 | Technical structure    | layering, shared logic, boundaries, conventions, perf       |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)                               | UI/UX & parity         | principles, IA/nav, components, states, a11y, parity matrix |
| [`TESTING.md`](TESTING.md)                                           | Testing strategy       | philosophy, pyramid, naming, what (not) to test             |
| [`ROADMAP.md`](ROADMAP.md)                                           | Execution              | phased order, deps, risks, delete/preserve                  |
| [`specs/refactor-test-plan.md`](specs/refactor-test-plan.md)         | REQ→test mapping       | keep/rewrite/delete tests + new tests                       |
| [`specs/doc-consolidation-plan.md`](specs/doc-consolidation-plan.md) | Doc cleanup            | inventory + dispositions                                    |
| [`ai/IMPLEMENTATION_HANDOFF.md`](ai/IMPLEMENTATION_HANDOFF.md)       | Implementation handoff | prompt for the implementation model                         |

**Rule:** each rule lives in exactly one doc; reference, don't duplicate.

## Operational docs (kept, not part of the spec set)

`setup/`, `runbooks/`, `integrations/`, `billing/REVENUECAT_SETUP.md`, legal (`PRIVACY_POLICY.md`,
`TERMS_OF_SERVICE.md`, `APP_STORE_PRIVACY_REQUIREMENTS.md`), `changelog/`. Repo root keeps
`README.md`, `CI_LOCAL.md`, `SECURITY_AUDIT.md`.
