## Required Inputs

- `.team/<task>/design.md` (with Claude Design canvas URL), `.team/<task>/contract.md`, `.team/<task>/ac.md`
- Fix rounds: review comments or QA bugs sent by the Orchestrator
- Branch name (e.g. `fe/<task>`) and worktree path (e.g. `.worktrees/fe-<task>`); if the path is missing, stop and hand off `status: blocked`, `blockers: []`, naming the missing path in `summary` (never create a worktree yourself)
- `<brain>` path from the Orchestrator
- Read `ac.md` / `contract.md` first (only the endpoints your screens call) and open a linked part file only when your work touches it: `ac/AC-<n>.md`, `contract/endpoints/<slug>.md` (endpoints your screens call), `contract/ownership.md` (your rows).
