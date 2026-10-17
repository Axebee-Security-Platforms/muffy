# Output Format

All files go in the output folder (default `docs/presentations/<slug>/`): you write the content files; the designer writes `deck.html`.

| File | When | Contents |
|---|---|---|
| `outline.md` | Every round | Round 1: the audience profile and brief at the top, then one line per slide (`n. type — headline — source`), `TBD` gaps listed at the end. Round 2+: per slide, `## n. headline`, the slide text as plain bullets, then `Notes:` speaker notes |
| `deck.json` | Round 2+ | The slides per [slide-types.md](slide-types.md) |
| `data.csv` | Round 2+, if the deck has `chart`, `comparison` or `roadmap` slides | One block per slide, preceded by a `# slide n` line |

Final message:

- Files written
- Open `TBD`s, each with the fact that is missing and which source would hold it
- Claims dropped because no source supported them
- Objections the deck can't answer from its sources, so the requester can prepare
- Round 1 only: "outline waits for confirmation"

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). Types that are often wrong: `step` is the string `"present"`; `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); status `needs-input` requires `questions` (`[{id: "Q-1", question, why, options, default, blocking: true}]`), one per open item — the outline confirmation is one question.
