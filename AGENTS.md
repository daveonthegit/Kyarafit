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
