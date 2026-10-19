# Diagram mode (`/muffy diagram "<request>"`)

On demand only, never a step of the team flow. The Orchestrator does not draw the diagram itself: it routes the request to the agent that owns that diagram kind, who draws it from facts already in the repo. Skips Analyze, Onboard, Setup and Run profile; needs no task folder, checkpoint or brain note.

Use this only for a diagram requested on its own, not tied to an in-progress contract or fix. A diagram that belongs to the team flow (architect's step 3 triggers, the designer's screen map, the fix lane's `flow.html`) is drawn there instead, per its normal trigger — do not reroute it here.

## Ownership (fixed, never ask the user to pick an agent)
| Kind | Owner | Notes |
|---|---|---|
| `architecture`, `state`, `deployment`, `erd`, `flow` | `architect` | Same rules as its [diagrams.md](../../../agents/references/architect/diagrams.md): facts only, from code/docs/ADRs the user points at or that already exist; no inventing a component, table or step |
| `screenmap` | `designer` | Only this kind; `designer` writes no other diagram ([rules-and-guardrails.md](../../../agents/references/designer/rules-and-guardrails.md)) |
| `gantt`, `story-map` | `product-manager` | Drawn from a plan/roadmap the user points at, not invented |

## Procedure
1. **Scope, one question round.** Ask: what should the diagram show (one sentence), which kind from the table above (infer from the request when obvious — "how X deploys" → `deployment`, "the states a job moves through" → `state` — and confirm, don't ask when it's unambiguous), the source(s) to draw facts from (file paths, an existing contract/schema, or "read the code at `<path>`" — never code the diagram shouldn't reflect, like diffs or hand-offs), output path (`docs/architecture/...` per [diagram-style.md](diagram-style.md)'s kind table, or a path the user names for a one-off), slug, and whether a [pattern](diagram-style.md#patterns) applies. No source and nothing discoverable in the repo → stop and say so; never let the owning agent guess
2. **Spawn** the owning agent fresh at effort `medium` with "Diagram: `<request>`", the request verbatim, the kind, the sources, the output path, the pattern (if any), the commit trailer. Point it at [diagram-style.md](diagram-style.md) for the shell/JSON and its own `diagrams.md` (architect) or `product-structure.md` (designer screenmap caveat does not apply here since this is the only diagram designer draws) for triggers — but in diagram mode the trigger is the user's request itself, not the table's "draw only when"
3. **Validate.** `node .claude/skills/muffy/scripts/check-diagram.mjs <file>`, then `check-diagram-render.mjs <file>`. A FAIL goes back to the same agent once with the printed lines. Still failing → tell the user what failed and stop, never publish it
4. **Publish** the file as an Artifact (`icon: diagram`; pass the earlier `url` on a later round so the link stays the same). Private; sharing is the user's call. The Artifact tool unavailable or refused → give the file path instead
5. **Hand to the user:** the Artifact link (or path), the repo path, and any `verify: true` items the agent flagged. Ask for notes
6. **Revision rounds.** Notes → `SendMessage` to the same agent with `round` + 1, then steps 3–5. No round limit; stop when the user is satisfied
7. **Commit** on the user's go-ahead only: the diagram file, with the commit trailer. Nothing else changes

## Rules
- The repo file is the durable copy; the Artifact is a viewing link and may go away ([diagram-publish.md](diagram-publish.md) rule, same here)
- Only the owning agent in the table draws the file; the Orchestrator never writes diagram JSON itself and never asks an agent to draw a kind outside its row
- Facts only: the diagram never introduces a component, table, state or step the sources don't show. Anything unconfirmed is `verify: true`
- No `.team/<task>/` folder, checkpoint or brain note is created for diagram mode
