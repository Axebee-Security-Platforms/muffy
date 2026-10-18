## Diagrams (only when needed)

**Default: no diagram.** A diagram costs tokens and goes stale. Draw one only when a trigger below fires and one sentence in the contract would not do. Never draw in the fix lane (the diagnosing dev may draw a `flow.html` there, see that lane's profile), or for a change that only adds a column, route, screen or copy.

**One onboard exception:** in onboard mode, if the repo has no architecture diagram (defined below), write `docs/architecture/overview.html` once from `baseline.md`. High-level only: no ERD, no flows. Rules for it are in "Onboard overview" below. A repo that already has one gets none: link the existing one in the ADR instead.

**What counts as an existing architecture diagram.** Only a drawn picture of components and how they connect, found by looking in `docs/`, `docs/architecture/` and the README:
- counts: `docs/architecture/overview.html`; a Mermaid/PlantUML/D2 block (```mermaid …) or `.mmd`/`.puml`/`.d2`/`.drawio` file showing components; an image (`.svg`/`.png`/`.jpg`) of an architecture or system diagram, linked from the README or `docs/`
- does not count: a directory-tree listing or other ASCII file layout; a prose architecture document (`ARCHITECTURE.md`, `overview.md`) with no drawn diagram; a PDF or slide deck; ADRs; a diagram that is an ERD or a flow (those are not the overview)
- Unsure whether something is a diagram: it does not count; write the overview and mention the doubt in the ADR as `[verify]`
- Record in the brain note which file counted, or `existing diagram: none`

| Diagram | File | `kind` | Draw only when |
|---|---|---|---|
| High-level architecture | `docs/architecture/overview.html` | `architecture` | The task adds or removes a component, datastore, queue, external integration or changes the deploy model (and the change is not already clear from `deploy.md` / an ADR). For a mobile, desktop or CLI target show the app, its local storage, the backend if any, and the OS or external services it calls |
| Database (ERD) | `docs/architecture/data-model.html` | `erd` | The contract adds two or more tables, or adds or changes a relationship (FK, join table, cardinality). One new column or index: no diagram |
| Flow | `docs/architecture/flows/<slug>.html` | `flow` | An AC's behaviour spans three or more participants (client, API, DB, queue, third party) or its ordering is not obvious: auth handshake, payment, async job, retry or rollback. A plain CRUD endpoint: no diagram |

### Say the plan before drawing
Before writing the JSON, state in one line: the `kind`, the trigger from the table that fired, and what you leave out on purpose (components or links the reader does not need). Put it in the hand-off note, or in the question to the user when one is already being asked; do not add a round trip for it. Skip it only for an update that changes one node or edge.

### Rules
- **Format and style:** one self-contained HTML file from [templates/diagram.html](../../../skills/muffy/templates/diagram.html), following [diagram-style.md](../../../skills/muffy/references/diagram-style.md) (blueprint grid, floating cards, animated connectors, lower-third caption). Edit only `<title>` and the JSON, then run `node .claude/skills/muffy/scripts/check-diagram.mjs <file>`; a FAIL is fixed before hand-off
- **Update, don't add:** if the file exists, change only the part this task touches (edit its JSON). Never create a second overview or a per-task copy; a flow gets its own file only because it is a distinct flow
- The diagram shows what the contract and schema already decide. It never introduces a decision, a table or a field that `contract.md` / `contract/schemas.md` lacks. When they disagree, the contract wins and you fix the diagram
- Add one line with a link to `contract.md` (under the section it explains) only for a diagram you drew or changed
- Record in the brain note either the paths drawn or `diagrams: none needed (<reason>)`

### Onboard overview
- Facts only, from `baseline.md` and the code it points to: the components that exist (app, services, workers), datastores, external services, and the main call or data direction between them. Mark anything you could not confirm `verify: true`. Recommend and invent nothing
- `kind: architecture`, at most 15 nodes, every edge labelled, and `commit` set to the baseline's commit so staleness is visible
- Not a target design and not an ERD or a flow: those wait for a task that needs them
- The user reviews it with the baseline at `pause:onboard-review`; it is not committed before that approval
