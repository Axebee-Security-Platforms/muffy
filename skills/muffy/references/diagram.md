# Diagram mode (`/muffy diagram "<request>"`)

On demand only, never a step of the team flow. The Orchestrator does not gather the facts or draw the file itself: it routes the request to the agent that owns that diagram kind's content, and `diagrammer` draws every diagram muffy produces. Skips Analyze, Onboard, Setup and Run profile; needs no task folder, checkpoint or brain note.

Use this only for a diagram requested on its own, not tied to an in-progress contract or fix. A diagram that belongs to the team flow (architect's step 3 triggers, the designer's screen-map spec, the fix lane's `flow.html`) is drawn there instead, per its normal trigger — do not reroute it here.

## Kinds (fixed, never ask the user to pick an agent)
Every kind has one facts owner. That owner also decides what happens when the subject is not designed yet, and which path one feature's diagram takes.

| Kind | Facts from | Not designed yet → route | Whole system | One feature or task |
|---|---|---|---|---|
| `architecture` | `architect` | spec | `docs/architecture/overview.html` | `docs/architecture/changes/<slug>.html` with pattern `delta` (what the feature adds, removes or changes) |
| `deployment` | `architect` | spec (devops mode 1 joins when hosting is open) | `docs/architecture/deployment.html` | `docs/architecture/changes/<slug>.html` with pattern `delta` |
| `erd` | `architect` | spec | `docs/architecture/data-model.html` | `docs/architecture/data-models/<slug>.html` |
| `state` | `architect` | spec | — | `docs/architecture/states/<slug>.html` |
| `flow` | `architect` | spec | — | `docs/architecture/flows/<slug>.html` |
| `screenmap` | `designer` (specs it, its own domain) | design | `docs/design/screen-map.html` | — (one feature's screens are its design canvas; the map is always the whole product) |
| `gantt`, `story-map` | `product-manager` | plan | — | `docs/plan/<task>-gantt.html`, `docs/plan/<task>-story-map.html` |

`diagrammer` draws every kind. Facts rules: [architect diagrams.md](../../../agents/references/architect/diagrams.md), [product-manager diagrams.md](../../../agents/references/product-manager/diagrams.md), [designer product-structure.md](../../../agents/references/designer/product-structure.md): from sources that already exist, never invented.

## Before the scope question
Two checks, in this order. Each one can send the request elsewhere before any question is asked.

1. **Is there an open task for it?** Look for an open task whose name or goal matches the subject (`checkpoint.md` not `closed`, found as [resume.md](resume.md) finds them). Found → the diagram belongs to that task, not to this mode: see "Inside an open task" below
2. **Does the thing exist yet?** The facts must already be in a source the kind's owner reads: code, a contract or schema, migrations or models for the architect's kinds; screens in the code or an approved canvas for `screenmap`; a plan, roadmap or `ac.md` for `gantt` and `story-map`. None → drawing it would mean designing it. Say so in one line and route it to the "Not designed yet" route of its kind (spec, design or plan), with the diagram as the stop point: when that route's output is accepted, its owner specs the diagram from it, `diagrammer` draws it and it is published as below. Never let a facts owner invent components, tables, steps, screens or dates to fill a diagram

## Inside an open task
The task's own artifacts are the source. Do not start this mode's procedure; give the diagram to the task's owner of that kind:

| Kind | Owner in the task | Source | When |
|---|---|---|---|
| architect's kinds | the task's `architect` | its `contract.md` | Before step 3: add `Diagram requested: <kind> <subject>` to the architect's step-3 prompt, so it specs it even when no trigger in its `diagrams.md` fires. After step 3: `SendMessage` it (spawn fresh if gone) with `Diagram facts: <request>` and `round` + 1 |
| `gantt`, `story-map` | the task's `product-manager` | `docs/plan/<task>.md`, `ac.md` | Before step 2: add the request to its step-2 prompt. After: `SendMessage` it the same way |
| `screenmap` | the task's `designer` specs it; `diagrammer` draws it | the task's canvas and the existing screens | At step 3 or later, as a request in the designer's prompt or a `SendMessage`; its `diagrams_spec` goes to `diagrammer` |
| `flow` in the fix lane | the diagnosing dev | its own trace | Only per [fix-profile.md](fix-profile.md) (`flow.html` at 4a); anything else waits for the fix to close or becomes a separate request |

A kind whose owner the task's lane skips (a `gantt` in a lite task, a `screenmap` in a fix or lite task) is not added to the task: run it as this mode's procedure once the subject exists, or tell the requester why not. Every added diagram is published and recorded by step 3e ([diagram-publish.md](diagram-publish.md)); the task's checkpoint gets one line under `## Status` (`diagrams: <n> published`); no loop counter moves and the run's next step is unchanged.

## Procedure
1. **Scope, one question round.** Ask: what should the diagram show (one sentence), which kind from the table above (infer from the request when obvious — "how X deploys" → `deployment`, "the states a job moves through" → `state` — and confirm, don't ask when it's unambiguous), the source(s) to draw facts from (file paths, an existing contract/schema, or "read the code at `<path>`" — never code the diagram shouldn't reflect, like diffs or hand-offs), output path (**always the `.html` file `diagrammer` writes**: `docs/architecture/overview.html`, the path for its kind in the Kinds table above; the rule is [hooks-enforcement.md](hooks-enforcement.md) §12 / `guard-write-scope.mjs`. Never a `.md` file: facts owners write no file, they return the spec. A one-off path the user names must match one of these, else ask), slug, and whether a [pattern](../../../agents/references/shared/diagram-style.md#patterns) applies. No source and nothing discoverable in the repo → stop and say so; never let an agent guess
2. **Spawn the facts owner** (`architect`, `product-manager`, or `designer` for `screenmap`) fresh at effort `medium` with "Diagram facts: `<request>`", the request verbatim, the kind, the sources, the output path, the pattern (if any). Point it at its own `diagrams.md` (the designer's is `product-structure.md`) for what counts as a fact, but the trigger is the user's request itself, not that file's "spec it only when" table. It returns a hand-off with `diagrams_spec` (never a drawn file) — see [handoff.schema.json](../schemas/handoff.schema.json)
3. **Spawn `diagrammer`** fresh at effort `medium` with "Diagram: `<request>`", the `diagrams_spec` entry, the commit trailer. It copies [templates/diagram.html](../templates/diagram.html), fills in `<title>` and the JSON, and draws nothing the spec didn't give it
4. **Validate.** `node .claude/skills/muffy/scripts/check-diagram.mjs <file>`, then `check-diagram-render.mjs <file>`. Sort each FAIL: a layout FAIL (from the render check, or a label/step width) goes back to `diagrammer` once; a readability FAIL (note or label over the limit, from check-diagram) goes to `diagrammer` as a wording fix (lane 3 below); a content FAIL (a fact that's wrong, or a name that doesn't match the code) goes back to the facts owner, then `diagrammer` redraws. Still failing → tell the user what failed and stop, never publish it. Read each WARN "packs several points" as a real problem: split the note into lines before hand-off
5. **Publish** the file as an Artifact (`icon: diagram`; pass the earlier `url` on a later round so the link stays the same). Private; sharing is the user's call. The Artifact tool unavailable or refused → give the file path instead
6. **Hand to the user:** the Artifact link (or path), the repo path, and any `verify: true` items flagged. Ask for notes
7. **Revision rounds.** Three lanes, one per kind of note; the Orchestrator never edits the file or the JSON itself:
   - **Facts** (a fact, name or term is wrong) → `SendMessage` the facts owner with `round` + 1, relay the updated spec to `diagrammer`, then steps 4–6.
   - **Layout** (position, crowding, a label on a card) → straight to `diagrammer`, then steps 4–6.
   - **Wording** (the text is hard to read: a note is a block, a label is too long, a sentence is unclear, facts and layout unchanged) → straight to `diagrammer` with the note verbatim. `diagrammer` rewrites only `label`/`note`/`subtitle` text (bullets as `\n- point`, shorter labels, detail moved into a note), changes no fact and no position, then steps 4–6.
   No round limit; stop when the user is satisfied
8. **Commit** on the user's go-ahead only: the diagram file, with the commit trailer. Nothing else changes

## Rules
- The repo file is the durable copy; the Artifact is a viewing link and may go away ([diagram-publish.md](diagram-publish.md) rule, same here)
- `diagrammer` draws every diagram, and no one else does; the facts owner never writes the `.html` file, and the Orchestrator never writes diagram JSON itself
- Terms match the code: a name in a diagram that differs from the schema, code or plan it came from is a content FAIL and goes back to the facts owner (the rule each owner follows is in its own `diagrams.md`)
- Facts only: the diagram never introduces a component, table, state or step the sources don't show. Anything unconfirmed is `verify: true`
- No `.team/<task>/` folder, checkpoint or brain note is created for diagram mode
