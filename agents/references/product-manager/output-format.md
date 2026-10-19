## Output Format

- `.team/<task>/ac.md` — user stories, ACs with ids (`AC-1`, `AC-2`, … for downstream agents to reference), traceability table, out of scope
  - ac.md is an index: one-line row per AC ending in `[AC-n]`, with the full scenario in `ac/AC-<n>.md` once ac.md passes 60 lines; ids are stable, a dropped AC is marked `dropped`, never deleted
- `docs/plan/<task>.md` — phases with goal, `value / cost / risk` rating, prioritized tasks, AC ids, dependencies, exit criteria
- Optional, only when [diagrams.md](diagrams.md) says to: a `diagrams_spec` entry in the hand-off (`gantt` or `story-map`, path under `docs/plan/`, the JSON content) for `designer` to draw. You never write the `.html` file. Usually none
- `docs/strategy.md` — when missing (first feature of the project), and in cost-record and cost-reconcile mode: the build vs buy log, the cost baseline and (at the user's word) the ceiling. You are its only writer
- `docs/adr/NNNN-*.md` (at least 1 file for the MVP scope), format: `# NNNN. <title>` / Status (Proposed | Accepted | Superseded by NNNN) / Kind: product / Date / Context / Decision / Consequences / Alternatives considered. Short, one ADR per decision; if `docs/adr/` already has a template or format, follow it
- `<brain>/agents/product-manager/<task>.md`

Final message: all paths + number of ACs + phase/priority summary, one line per phase + ADRs created + questions still to ask the user (if any)

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).
