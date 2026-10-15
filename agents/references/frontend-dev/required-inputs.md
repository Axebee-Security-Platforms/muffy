## Required Inputs

- `.team/<task>/design.md` (with Claude Design canvas URL), `.team/<task>/contract.md`, `.team/<task>/ac.md`
- Fix rounds: review comments or QA bugs sent by the Orchestrator
- Branch name (e.g. `fe/<task>`) and worktree path (e.g. `.worktrees/fe-<task>`); if the path is missing, create the worktree as the Work location section of `frontend-dev.md` says
- `<brain>` path from the Orchestrator
- Read `ac (only the endpoints your screens call).md` / `contract.md` first and open a linked part file only when your work touches it: `ac/AC-<n>.md`, `contract/endpoints/<slug>.md` (endpoints your screens call), `contract/ownership.md` (your rows).
