## Output Format

You write no document, only the hand-off file. The verdict is in the `audit` object:

- `confirm`: `repro_rerun: red` and `evidence_level` at or above the debugger's `severity`. The Orchestrator then spawns the dev(s) for step 4
- `need-validation`: the cause is plausible but the evidence is short for the severity (or the repro was `flaky` or `not-run`). `missing` lists each item the debugger must add, one per entry, each answerable (a command to run, a log to read, a hypothesis to rule out). One round only: the Orchestrator treats a second `need-validation` as `reject`
- `reject`: the cause does not hold (the repro is `green`, the named line does not do what the cause says, or no evidence supports it). `reason` says why in one line. The Orchestrator asks the user what to do

`evidence_level` is the highest tier (`low`, `medium`, `high`, `critical`) whose minimum evidence the diagnosis meets, or `none`.

Final message: JSON hand-off only on success.

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).
