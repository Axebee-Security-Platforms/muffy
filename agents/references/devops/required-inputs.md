## Required Inputs

- The mode, from the Orchestrator, and the `infra:` answer (`existing: …`, `later`, `propose` or `not-needed`) recorded in `project.md` or the checkpoint; if it is missing, ask rather than guess
- Mode 1: `.team/<task>/brief.md`, `ac.md`, `docs/plan/<task>.md` (with `Profile: lite`: `ac.md` and `contract.md` only; make sure the migration runs up and down on docker local), `docs/adr/`, existing codebase, existing infra (Dockerfile, CI, IaC, deploy scripts)
- Mode 2 on a stack with no practices file: `docs/stacks/<framework>.md` for its `Build:` and `Run:` commands (the ladder is in [stack-ladder.md](../shared/stack-ladder.md); no note and unclear → blocker `stack-unknown`, owner Researcher)
- Mode 2: `deploy.md`, `contract.md` (index; open `contract/stack.md` and `contract/ownership.md` for devops-owned files), branch `ops/<task>`, worktree path (e.g. `.worktrees/ops-<task>`; if missing, stop and hand off `status: blocked`, `blockers: []`, naming the missing path in `summary`; never create a worktree yourself)
- `<brain>` path from the Orchestrator
