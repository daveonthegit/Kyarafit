# New-session coordination — continuing Kyarafit

Start with [AI_CONTEXT.md](../AI_CONTEXT.md), the [implementation handoff](IMPLEMENTATION_HANDOFF.md),
and the [roadmap status](../ROADMAP.md). The original fail-first wave prompt is historical;
its test counts and stub backlog are not current execution authority. Git history preserves it.

For parallel work, give each worker a current brief with explicit base, owned files, dependencies,
acceptance criteria, and validation/delivery gates. No two workers edit a shared schema, lockfile,
locale set, or central requirement section at the same time. Integrate dependent contracts before
validation; do not guess another worker's API or merge completion from green local tests.

Agentflow is deprecated. Do not invoke it or edit `.agentflow/` / `WORK.md`; keep existing
identifiers only for provenance. Escalate out-of-scope requirements and owner decisions to the
coordinator instead of silently expanding a package.

Validate each slice and the integrated result with the [testing strategy](../TESTING.md).
Deployment, credential provisioning, migration, and app publication are separate operator actions.
