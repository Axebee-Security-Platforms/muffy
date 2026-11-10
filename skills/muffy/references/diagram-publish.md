# Publishing diagrams (step 3e)

The Orchestrator publishes every diagram `diagrammer` drew or changed, so the user can open it, and records where it lives. Read this only when a hand-off's `paths_written` lists a diagram file; otherwise skip the step and write nothing about it. Who specs the facts, who draws, triggers and the file format are in [diagram-style.md](../../../agent-references/shared/diagram-style.md) and the architect's `diagrams.md`.

## When it runs
| Facts from | Drawn by | Files | Runs |
|---|---|---|---|
| Architect, step 3 | `diagrammer` | `docs/architecture/overview.html`, `data-model.html`, `deployment.html`, `states/<slug>.html`, `changes/<slug>.html`, `flows/<slug>.html`, `data-models/<slug>.html` | Right after 3b, before the 3c gate, so the question to the user can link them |
| Architect, onboard 0c | `diagrammer` | `docs/architecture/overview.html` | Before `pause:onboard-review` (0d), so the user reviews it with the baseline |
| Product-manager, step 1 (only when a plan diagram was needed) | `diagrammer` | `docs/plan/<task>-gantt.html`, `docs/plan/<task>-story-map.html` | Right after the diagrammer's hand-off, before the user reviews the plan |
| Designer's spec, step 3 (only when a screen map was needed) | `diagrammer` | `docs/design/screen-map.html` | Right after 3b, before the 3c gate, so the design-review question can link it |
| Debugger, fix lane 4a | the `debugger` (fix lane has no designer spawn) | `.team/<task>/flow.html` | Right after the 4a hand-off, before step 4 starts |

## Procedure
1. **Collect:** the diagram files in `paths_written` of the round's hand-offs (`.html` under `docs/architecture/` or `docs/design/`, or named `flow.html`). None → stop
2. **Validate, then render:** `node "<muffy>/scripts/check-diagram.mjs" <files>`, then `check-diagram-render.mjs <files>` (it needs a page that passed the first). Both are the delivery gate; a drawer's own pass is not taken on trust. A FAIL from either goes back to the drawer once with the printed lines (`diagrammer`, except in the fix lane where the diagnosing dev drew it directly; counts at that agent's normal loop point, [loops.md](loops.md)). A failure that traces to a fact rather than layout (a node, table or step the spec didn't ask for) goes to whoever spec'd it instead. Still failing → do not publish it; record `diagram: invalid (<first error>)` and continue. Never publish a file that failed. A render `SKIP` (no Chrome/Edge) is not a pass: publish, but record `render: not checked (no browser)` in the task note's diagram bullet and say so at the gate that follows
3. **Find the URL:** look in `<brain>/project.md` → `## Diagrams` for the file's repo path. Found → this is a republish: pass that `url`. Not found → first publish
4. **Publish:** read the file, then call the Artifact tool with `file_path` set to it and `icon: diagram` (and `url` on a republish). One Artifact per file; no capabilities and no extra files, since the page is self-contained. Leave it private; sharing is the user's call. The Artifact tool unavailable or refused → record `diagram: not published (<why>)` and continue; never block the flow
5. **Record, right away, so a resume finds it:**
   - `<brain>/tasks/<task>.md` → `## Diagrams`: one bullet per diagram, `- <kind> · <repo path> · <Artifact URL> · <date> · commit <short sha>`. A republish edits that task's bullet in place (new date and sha) instead of adding another; a diagram that failed or was skipped gets its `diagram: ...` line here instead of a URL
   - `<brain>/project.md` → `## Diagrams`: one line per repo path, `<repo path> · <Artifact URL>`, so a later task republishes the same URL. Add the line on first publish; never duplicate it
   - `checkpoint.md` → `## Status`: one short item, `diagrams: <n> published` (details stay in the task note)
6. **Surface:** put the URLs in the question at the gate that follows (`pause:design-review`, `pause:onboard-review`, or the fix-lane scope note), in `review-<n>.md` when the reviewer cited one, and in the closing report ([closing.md](closing.md)). The reviewer is read-only and cannot open a URL: it reads the files by path

## Rules
- The repo file is the durable copy; the Artifact is a viewing link and may go away. Never reference an Artifact URL from `docs/` or code
- Publish only diagrams written or changed this round, never the whole `docs/architecture/` folder
- A diagram that did not change since its last publish is not republished
- Token discipline: no re-reading a published diagram, and no screenshot or visual check by the Orchestrator unless the user says the result looks wrong
