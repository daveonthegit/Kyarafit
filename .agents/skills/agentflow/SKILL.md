---
name: agentflow
description: Run and manage software-engineering tasks through the Agentflow deterministic workflow CLI. Use when the user asks to use Agentflow, initialize Agentflow in a repository, start an Agentflow run, or continue work through its planning, verification, approval, merge, or shipping gates.
---

# Agentflow

Use the Agentflow CLI as the workflow authority. Treat model output as a
proposal and CLI state and recorded evidence as fact.

## Start in a repository

1. Work from the target repository root.
2. Run `command -v agentflow` to confirm the CLI is installed. If it is absent,
   explain that installing this skill alone does not install the executable.
   Direct the user to run
   `npx --yes github:daveonthegit/agentflow install` outside an active workflow
   run.
3. Run `agentflow init`. It is safe to rerun and must preserve existing project
   instructions.
4. If `.agentflow/repository-profile.json` does not exist or source changes
   make it stale, run `agentflow profile --check "<authoritative command>"` for
   each deterministic check plus a repeatable `--test-path <repo-relative path>`
   for every directory or file the tester may modify, then commit the profile in
   the Target Repository. The tester stage refuses to run against a profile that
   records no `test_paths`.
5. Follow the repository's `AGENTS.md` and keep its project-specific knowledge
   in that repository. Do not copy it into the Agentflow source repository.

## Start and inspect a run

Start directly from the user's task summary:

```bash
agentflow start "<task summary>"
```

Start only from a clean Target Repository checkout; commit or explicitly set
aside unrelated work before creating the Run.

Report the returned run ID, state, and worktree. Inspect persisted state in a
new process with:

```bash
agentflow status <run-id>
```

Run Evidence defaults to Agentflow Home outside the target repository. Use
`AGENTFLOW_HOME` or `--data-dir` only when the user, CI environment, or isolated
test requires an override.

## Route models before the first adapter advance

Before the first model-requiring `advance` with a given adapter, run
`agentflow models` and inspect its recorded routing. When no routing is
recorded for that adapter, or the model provider has changed since it was
recorded, ask the user which model to use for each role (builder,
tester, reviewer) while presenting the suggested defaults from the command's
output, then record the answer:

```bash
agentflow models                                             # inspect routing
agentflow models --adapter cursor --set builder=claude-opus-4-8-thinking-high
```

Never silently assume a model choice. Each invocation resolves the model per
role in this order: `advance --model` (one stage only), then the
`AGENTFLOW_<ADAPTER>_<ROLE>_MODEL` environment variable, then the recorded
`models.json` routing in Agentflow Home, then the adapter's suggested
defaults.

Advance exactly one recorded stage at a time, selecting an installed Agent
Adapter (`claude`, `cursor`, or `codex`) for the stages that require one:

```bash
agentflow advance <run-id> --adapter cursor  # build and commit candidate
agentflow advance <run-id>                   # authoritative checks
agentflow advance <run-id> --adapter cursor  # tester probes under test_paths
agentflow advance <run-id> --adapter cursor  # read-only review
```

The tester (from `verified`) may write tests only under the profile's declared
`test_paths`. If it adds a test it commits a new candidate and re-runs the
authoritative checks, reaching `tested` on pass or terminal `failed` on failure;
if it changes nothing it reaches `tested` against the unchanged candidate. Its
prose findings are recorded and shown to the reviewer but never gate the Run on
their own.

When status reports `changes_requested`, advance again with a builder adapter to
repair (at most two repairs after the initial build). Each repair commits a new
candidate and re-enters `built` so checks, tester, and review must rerun:

```bash
agentflow advance <run-id> --adapter cursor  # repair from changes_requested
agentflow advance <run-id>                   # re-run authoritative checks
agentflow advance <run-id> --adapter cursor  # re-run tester
agentflow advance <run-id> --adapter cursor  # re-run read-only review
```

If the current model provider has no Agent Adapter or its executable is not
installed, do not bypass the workflow and do not fake stage evidence. Build,
test, and land an adapter for that provider first — as Bootstrap Development
when no working adapter exists to coordinate the change — and only then start
or resume Runs with it.

After every command, report the returned state and use `agentflow status` when
resuming in a fresh process. Never edit a Run Workspace manually while claiming
an Agentflow Agent Role made the change.

## Record approval

If and only if `agentflow status <run-id>` reports `awaiting_human`, the
Workspace is clean at the reported `candidate_sha`, the human has reviewed that
exact candidate, and the user explicitly directs approval, record it with:

```bash
agentflow approve <run-id> --approved-by <human identity>
```

Do not translate ordinary conversational agreement into approval.

## Record rejection

If the user explicitly rejects a candidate, record it with the
claim-guarded reject command. From `awaiting_human` this appends terminal
`human_rejected` bound to the candidate SHA. Conversation text is never
rejection evidence:

```bash
agentflow reject <run-id> --rejected-by <human identity> [--reason <text>]
```

Rejected Runs cannot advance, approve, abandon, rebase, or be rejected again.

## Preserve gate integrity

- Never claim a plan, build, check, review, approval, merge, or deployment
  happened unless Agentflow recorded corresponding evidence.
- Never bypass a failed or unavailable gate by editing run evidence manually.
- Never let an agent's prose override command exit status or test results.
- Require explicit human approval before merge.
- Do not imply that unimplemented merge, post-merge, or deployment stages have
  executed, and do not claim a tester ran unless Agentflow recorded a
  `tests_ready` or `tests_failed` event.
