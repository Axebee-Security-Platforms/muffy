## Plan diagrams (only when needed)

**Default: no diagram.** The plan in `docs/plan/<task>.md` and the ACs in `ac.md` are the source of truth; a picture costs tokens and goes stale. Draw one only when a trigger below fires, or when the user asks for a roadmap or a story map.

| Diagram | File | `kind` | Draw only when |
|---|---|---|---|
| Plan over time | `docs/plan/<task>-gantt.html` | `gantt` | The plan has 3 or more phases and at least one real dependency between tasks, so order and overlap matter. A single-phase or strictly sequential plan: no diagram |
| Story map | `docs/plan/<task>-story-map.html` | `story-map` | 8 or more stories across 3 or more user activities, split into releases, so the cut line is a decision. A handful of stories: no diagram |

### Rules
- **Format and style:** copy [templates/diagram.html](../../../skills/muffy/templates/diagram.html), edit only `<title>` and the JSON, and follow [diagram-style.md](../../../skills/muffy/references/diagram-style.md) (examples: `templates/diagram-examples/gantt.json`, `story-map.json`). Then run `node .claude/skills/muffy/scripts/check-diagram.mjs <file>`; a FAIL is fixed before hand-off
- **Facts only:** a diagram shows what `docs/plan/<task>.md` and `ac.md` already decide. It never adds a phase, a task, a story or an AC they lack, and every `ac` id exists in `ac.md`. Where they disagree the plan wins and you fix the diagram
- **Gantt sizes are estimates, not dates:** `start` and `length` are counted in the chosen `unit` from the start of the work. Say so in the subtitle. Never invent a calendar date
- **Story map:** the first release must be an end-to-end slice (one story per activity, each linked to an AC). The validator warns when it is not
- Update, do not add: if the file exists, change only the part this task touches. Record in the brain note either the paths drawn or `diagrams: none needed (<reason>)`
