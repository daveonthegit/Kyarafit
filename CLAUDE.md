# Kyarafit

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `daveonthegit/Kyarafit` via the `gh` CLI. External PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Work tracking (Agentflow)

Open work lives on the Work Graph — consult the generated `WORK.md` board before starting, carry a
`Work-Item: <id>` trailer in commits, and drop JSON proposals into `.agentflow/proposals/` for
uncovered work. Conventions + gates: `AGENTS.md` (Agentflow section) and the project-local
`agentflow` skill. Never edit `.agentflow/work/` directly.
