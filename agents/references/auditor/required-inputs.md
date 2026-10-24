## Required Inputs

- `Profile: fix`, `.team/<task>/fix.md` (Symptom, `## Cause`, `## Repro`, `## Evidence`) and the debugger's hand-off `.team/<task>/handoff/4a-debugger-r<n>.json` (read its `diagnosis`: `severity`, `confidence`, `files`, `repro`)
- The worktree path (`.worktrees/feature-<task>`); if missing, stop and hand off `status: blocked`
- (if present) `.team/<task>/flow.html`: read its JSON, not the page; check it matches the code and the failing step is the one `## Cause` names
- Re-audit rounds: your previous `4b-auditor-r<n>.json`, to check every `missing` item was answered
- `<brain>` path from the Orchestrator
