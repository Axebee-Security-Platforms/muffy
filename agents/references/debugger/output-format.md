## Output Format

- `.team/<task>/fix.md` updated: `## Cause` (one line + `confidence: <low|medium|high>`, `severity: <low|medium|high|critical>`, `owner: <FE|BE|both>`, diagnosed files; link to `flow.html` when drawn), `## Repro` (test name, command, URL + viewport or log line) and `## Evidence` (probes and what each showed; dropped hypotheses). `fix.md` stays ≤ 60 lines
- Optional `.team/<task>/flow.html`
- `<brain>/agents/debugger/<task>.md` (≤ 5 lines)

Final message: JSON hand-off only on success. The `diagnosis` object:

- `known`: `confidence` medium or high, `cause`, `files`, `repro`, `severity`, `owner`; with `owner: both` also `owner_files` (`{"FE": [...], "BE": [...]}`, each side non-empty, together covering `files`): the dev of a side may change only its own files
- `unknown`: `reason` says what evidence is missing (a log, a repro, an environment detail)
- `needs-full-flow`: the cause is in the contract, a dependency, the stack or a design decision; `reason` says which, and `promote_to` the smallest lane that can fix it: `change-internal` (an internal contract or module, nothing a user sees changes beyond the fix), `change-visible` (a rule, screen or flow users see must change), `full` (a dependency, the stack, auth or a new capability)

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).
