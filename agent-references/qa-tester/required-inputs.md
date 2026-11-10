## Required Inputs

- The reviewed feature branch and worktree path (e.g. `.worktrees/qa-<task>`); if the path is missing, stop and hand off `status: blocked`, `blockers: []`, naming the missing path in `summary` (never create a worktree yourself)
- `.team/<task>/ac.md`, `.team/<task>/design.md` (no `design.md` with `Scope: internal`)
- The approved diff `.team/<task>/diff-<n>.patch` (names of the test files FE/BE added)
- `.team/<task>/deploy.md` (if present; the runtime pin to test against, the fix lane may have none)
- A `Test level:` line in the prompt (L0-L4, from `<muffy>/references/test-levels.md`). Run exactly that level; no line = L3 for the full flow and a visible change, L1 in the fix lane, L2 with `Scope: internal`, never L4
- Regression rounds: the previous bug list
- `<brain>` path from the Orchestrator
