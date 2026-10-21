## Plan diagrams (only when needed)

**Default: no diagram.** The plan in `docs/plan/<task>.md` and the ACs in `ac.md` are the source of truth; a picture costs tokens and goes stale. Spec one only when a trigger below fires, when the user asks for a roadmap or a story map, or when your prompt says `Diagram requested: <kind>` or `Diagram facts: <request>` (then the triggers do not apply). You never write the file yourself — `diagrammer` draws every diagram muffy produces; your job is deciding whether a trigger fired and the facts it must show.

| Diagram | File | `kind` | Spec it for `diagrammer` only when |
|---|---|---|---|
| Plan over time | `docs/plan/<task>-gantt.html` | `gantt` | The plan has 3 or more phases and at least one real dependency between tasks, so order and overlap matter. A single-phase or strictly sequential plan: no diagram |
| Story map | `docs/plan/<task>-story-map.html` | `story-map` | 8 or more stories across 3 or more user activities, split into releases, so the cut line is a decision. A handful of stories: no diagram |

### Rules
- **What you hand off:** a `diagrams_spec` entry (kind, path, the JSON content per [diagram-style.md](../shared/diagram-style.md), examples `templates/diagram-examples/gantt.json`, `story-map.json`) in your hand-off, for the Orchestrator to relay to `diagrammer`. `diagrammer` copies the template, fills in the JSON and runs `check-diagram.mjs`; a content failure (a fact that doesn't check out) comes back to you, a layout failure `diagrammer` fixes itself
- **Facts only:** the content shows what `docs/plan/<task>.md` and `ac.md` already decide. It never adds a phase, a task, a story or an AC they lack, and every `ac` id exists in `ac.md`. Where they disagree the plan wins and you fix the spec
- **Terms are the source's terms:** every phase, task, story and AC label is copied from `docs/plan/<task>.md` or `ac.md`, not paraphrased. A label you cannot find there is `verify: true`, never a guessed synonym
- **Gantt sizes are estimates, not dates:** `start` and `length` are counted in the chosen `unit` from the start of the work. Say so in the subtitle. Never invent a calendar date
- **Story map:** the first release must be an end-to-end slice (one story per activity, each linked to an AC). The validator warns when it is not
- Update, do not add: if the file exists, your spec changes only the part this task touches. Record in the brain note either the paths spec'd or `diagrams: none needed (<reason>)`
