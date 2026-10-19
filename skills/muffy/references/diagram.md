# Diagram mode (`/muffy diagram "<request>"`)

On demand only, never a step of the team flow. The Orchestrator does not gather the facts or draw the file itself: it routes the request to the agent that owns that diagram kind's content, and `designer` draws every diagram muffy produces. Skips Analyze, Onboard, Setup and Run profile; needs no task folder, checkpoint or brain note.

Use this only for a diagram requested on its own, not tied to an in-progress contract or fix. A diagram that belongs to the team flow (architect's step 3 triggers, the designer's screen map, the fix lane's `flow.html`) is drawn there instead, per its normal trigger — do not reroute it here.

## Ownership (fixed, never ask the user to pick an agent)
| Kind | Facts from | Drawn by | Notes |
|---|---|---|---|
| `architecture`, `state`, `deployment`, `erd`, `flow` | `architect` | `designer` | Same fact rules as [diagrams.md](../../../agents/references/architect/diagrams.md): from code/docs/ADRs the user points at or that already exist; no inventing a component, table or step |
| `screenmap` | `designer` | `designer` | The only kind `designer` specs itself, since it is its own domain |
| `gantt`, `story-map` | `product-manager` | `designer` | Drawn from a plan/roadmap the user points at, not invented |

## Procedure
1. **Scope, one question round.** Ask: what should the diagram show (one sentence), which kind from the table above (infer from the request when obvious — "how X deploys" → `deployment`, "the states a job moves through" → `state` — and confirm, don't ask when it's unambiguous), the source(s) to draw facts from (file paths, an existing contract/schema, or "read the code at `<path>`" — never code the diagram shouldn't reflect, like diffs or hand-offs), output path (**always the `.html` file `designer` writes**: `docs/architecture/overview.html`, `docs/architecture/data-model.html`, `docs/architecture/flows|states|changes/<slug>.html`, `docs/plan/<task>-gantt.html` or `-story-map.html`, `docs/design/screen-map.html`; the rule is [hooks-enforcement.md](hooks-enforcement.md) §12 / `guard-write-scope.mjs`. Never a `.md` file: facts owners write no file, they return the spec. A one-off path the user names must match one of these, else ask), slug, and whether a [pattern](diagram-style.md#patterns) applies. No source and nothing discoverable in the repo → stop and say so; never let an agent guess
2. **Spawn the facts owner** (`architect` or `product-manager`; skip this step for `screenmap`) fresh at effort `medium` with "Diagram facts: `<request>`", the request verbatim, the kind, the sources, the output path, the pattern (if any). Point it at its own `diagrams.md` for what counts as a fact, but the trigger is the user's request itself, not that file's "spec it only when" table. It returns a hand-off with `diagrams_spec` (never a drawn file) — see [handoff.schema.json](../schemas/handoff.schema.json)
3. **Spawn `designer`** fresh at effort `medium` with "Diagram: `<request>`", the `diagrams_spec` entry (or, for `screenmap`, the request and sources directly), the commit trailer. It copies [templates/diagram.html](../templates/diagram.html), fills in `<title>` and the JSON, and draws nothing the spec didn't give it
4. **Validate.** `node .claude/skills/muffy/scripts/check-diagram.mjs <file>`, then `check-diagram-render.mjs <file>`. Sort each FAIL: a layout FAIL (from the render check, or a label/step width) goes back to `designer` once; a readability FAIL (note or label over the limit, from check-diagram) goes to `designer` as a wording fix (lane 3 below); a content FAIL (a fact that's wrong, or a name that doesn't match the code) goes back to the facts owner, then `designer` redraws. Still failing → tell the user what failed and stop, never publish it. Read each WARN "packs several points" as a real problem: split the note into lines before hand-off
5. **Publish** the file as an Artifact (`icon: diagram`; pass the earlier `url` on a later round so the link stays the same). Private; sharing is the user's call. The Artifact tool unavailable or refused → give the file path instead
6. **Hand to the user:** the Artifact link (or path), the repo path, and any `verify: true` items flagged. Ask for notes
7. **Revision rounds.** Three lanes, one per kind of note; the Orchestrator never edits the file or the JSON itself:
   - **Facts** (a fact, name or term is wrong) → `SendMessage` the facts owner with `round` + 1, relay the updated spec to `designer`, then steps 4–6.
   - **Layout** (position, crowding, a label on a card) → straight to `designer`, then steps 4–6.
   - **Wording** (the text is hard to read: a note is a block, a label is too long, a sentence is unclear, facts and layout unchanged) → straight to `designer` with the note verbatim. `designer` rewrites only `label`/`note`/`subtitle` text (bullets as `\n- point`, shorter labels, detail moved into a note), changes no fact and no position, then steps 4–6.
   No round limit; stop when the user is satisfied
8. **Commit** on the user's go-ahead only: the diagram file, with the commit trailer. Nothing else changes

## Rules
- The repo file is the durable copy; the Artifact is a viewing link and may go away ([diagram-publish.md](diagram-publish.md) rule, same here)
- `designer` draws every diagram, and no one else does; the facts owner never writes the `.html` file, and the Orchestrator never writes diagram JSON itself
- Terms match the code: a name in a diagram (table, field, state, status, endpoint) is copied from the schema or code it came from, not paraphrased. `EOS` in the code is not `EOL` in the diagram. The facts owner checks each name against the field or identifier it cites before the spec goes out
- Facts only: the diagram never introduces a component, table, state or step the sources don't show. Anything unconfirmed is `verify: true`
- No `.team/<task>/` folder, checkpoint or brain note is created for diagram mode
