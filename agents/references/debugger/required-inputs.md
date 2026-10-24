## Required Inputs

- `Profile: fix` and `.team/<task>/fix.md` (Goal, Symptom, Out of scope; `## Cause` and `## Repro` are blank on the first round). There is no `ac.md`, `contract.md`, `brief.md` or `design.md` in this lane
- The worktree path (`.worktrees/feature-<task>`); if missing, stop and hand off `status: blocked`
- Re-diagnose rounds: the path of the auditor's hand-off (`handoff/4b-auditor-r<n>.json`, read its `audit.missing`) or the user's extra evidence (`.team/<task>/evidence-r<n>.md`, written by the Orchestrator from the user's answer), and your own previous hand-off. Answer every `missing` item or say in `fix.md` why it cannot be met
- `<brain>` path from the Orchestrator
