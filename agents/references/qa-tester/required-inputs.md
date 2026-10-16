## Required Inputs

- The reviewed feature branch and worktree path (e.g. `.worktrees/qa-<task>`); if the path is missing, create the worktree as the Work location section of `qa-tester.md` says
- `.team/<task>/ac.md`, `.team/<task>/design.md`
- A `Test level:` line in the prompt (L0–L4, from `.claude/skills/muffy/references/test-levels.md`). Run exactly that level; no line = L3 for the full flow, L1 in the fix lane, never L4
- Regression rounds: the previous bug list
- `<brain>` path from the Orchestrator
