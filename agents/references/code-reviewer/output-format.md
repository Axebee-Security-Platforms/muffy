## Output Format

Final message (the Orchestrator saves it as `.team/<task>/review-<n>.md`). The review is the deliverable, so the prompt's ≤ 10-line limit does not apply to it; keep each blocker to one line:

- **Verdict: Approve / Reject**
- **Blockers** (must fix) — `file:line`, problem, AC id, owner (`FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher`; a contract or stack cause is `Architect`)
- **Needs validation** (optional) — `V-1`, `V-2`…: `file:line`, the one question the owner must answer, owner. Not blockers: they do not change the verdict. Reuse the same id while it is still open in a later round
- **Suggestions** (optional) — including anti-slop findings that don't reach Blocker level and diagram mismatches (`diagram misses <path>`, wrong delta)
- **`### Second brain`** — 3–5 lines (date, verdict + main blockers, open issues) for the Orchestrator to record, since this agent cannot write files

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).

Add `needs_validation` (array of `{id: "V-n", question, owner}`) to the hand-off only when you have such items; omit it otherwise.
