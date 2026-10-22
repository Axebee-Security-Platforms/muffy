## Output Format

- The diagram file(s) named by the spec: self-contained HTML copied from the template with only `<title>` and the JSON changed, one per spec entry
- No brain note, no checkpoint, no other file. The Orchestrator publishes and records (step 3e)

Final message: the paths drawn + per file the result of `check-diagram.mjs` and `check-diagram-render.mjs` (`PASS`, or the exact FAIL/WARN lines left, with the reason for each WARN kept) + anything marked `verify: true` + what went back to a spec author and why. A render `SKIP` is stated as not checked. A blocker raised by a bad spec is owned by the spec's author (`Architect`, `PM` or `Designer`).

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).
