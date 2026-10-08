## Required Inputs

- The mode, from the Orchestrator
- Mode 1: `.team/<task>/brief.md`, `ac.md`, `docs/plan/<task>.md`, `docs/adr/`, existing codebase, existing infra (Dockerfile, CI, IaC, deploy scripts)
- Mode 2: `deploy.md`, `contract.md` (Stack), branch `ops/<task>`, worktree path (e.g. `.worktrees/ops-<task>`; create it if missing, per the Work location section of `devops.md`)
- Mode 3: a feature branch that passed QA, target `staging` or `production`; production requires a confirmation from the Orchestrator that **Human approved** — if it's missing, stop and report back
- `<brain>` path from the Orchestrator
