## Required Inputs

- `.team/<task>/design.md` (with Claude Design canvas URL; none with `Profile: lite`, where nothing on screen may change), `.team/<task>/contract.md`, `.team/<task>/ac.md`
- Fix rounds: review comments or QA bugs sent by the Orchestrator
- Branch name (e.g. `fe/<task>`) and worktree path (e.g. `.worktrees/fe-<task>`); if the path is missing, stop and hand off `status: blocked`, `blockers: []`, naming the missing path in `summary` (never create a worktree yourself)
- `<brain>` path from the Orchestrator
- `Scope:` in the prompt header (redesign lane only): stay inside it. With `Scope: ui-only`, a screen that needs a field, endpoint or rule the backend lacks gets no backend edit and no invented API: hand off a blocker with `owner: Architect` whose `problem` starts `needs-logic:` and names what is missing
- Read `ac.md` / `contract.md` first (only the endpoints your screens call) and open a linked part file only when your work touches it: `ac/AC-<n>.md`, `contract/endpoints/<slug>.md` (endpoints your screens call), `contract/ownership.md` (your rows).
