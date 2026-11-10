## Required Inputs

- `.team/<task>/contract.md` (index; open only the parts you need: `contract/endpoints/<slug>.md` per endpoint you build, `contract/schemas.md`, `contract/ownership.md` (your rows), `contract/ac-map.md`), `.team/<task>/ac.md`, `.team/<task>/brief.md`
- Fix rounds: review comments or bugs from QA
- Branch name (e.g. `be/<task>`) and worktree path (e.g. `.worktrees/be-<task>`); if the path is missing, stop and hand off `status: blocked`, `blockers: []`, naming the missing path in `summary` (never create a worktree yourself)
- `<brain>` path from the Orchestrator
