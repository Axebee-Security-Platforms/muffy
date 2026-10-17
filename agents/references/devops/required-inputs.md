## Required Inputs

- The mode, from the Orchestrator, and the `infra:` answer (`existing: …`, `later`, `propose` or `not-needed`) recorded in `project.md` or the checkpoint; if it is missing, ask rather than guess
- Mode 1: `.team/<task>/brief.md`, `ac.md`, `docs/plan/<task>.md`, `docs/adr/`, existing codebase, existing infra (Dockerfile, CI, IaC, deploy scripts)
- Mode 2 on a stack with no practices file: `docs/stacks/<framework>.md` for its `Build:` and `Run:` commands (the ladder is in `.claude/skills/muffy/references/stack-learning.md`; no note and unclear → blocker `stack-unknown`, owner Researcher)
- Mode 2: `deploy.md`, `contract.md` (index; open `contract/stack.md` and `contract/ownership.md` for devops-owned files), branch `ops/<task>`, worktree path (e.g. `.worktrees/ops-<task>`; if missing, stop and hand off `status: blocked`, `blockers: []`, naming the missing path in `summary`; never create a worktree yourself)
- Mode 3: a feature branch that passed QA, target `staging` or `production`; production requires a confirmation from the Orchestrator that **Human approved** — if it's missing, stop and report back
- `<brain>` path from the Orchestrator
