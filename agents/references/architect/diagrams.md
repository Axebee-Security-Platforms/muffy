## Diagrams (only when needed)

**Default: no diagram.** A diagram costs tokens and goes stale. Spec one only when a trigger below fires and one sentence in the contract would not do. You never draw the file yourself — `designer` draws every diagram muffy produces; your job here is deciding whether a trigger fired, which kind, and the facts it must show. Never spec one in the fix lane (the diagnosing dev may draw a `flow.html` there itself, see that lane's profile), or for a change that only adds a column, route, screen or copy.

**One onboard exception:** in onboard mode, if the repo has no architecture diagram (defined below), spec `docs/architecture/overview.html` once from `baseline.md`, for `designer` to draw. High-level only: no ERD, no flows. Rules for it are in "Onboard overview" below. A repo that already has one gets none: link the existing one in the ADR instead.

**What counts as an existing architecture diagram.** Only a drawn picture of components and how they connect, found by looking in `docs/`, `docs/architecture/` and the README:
- counts: `docs/architecture/overview.html`; a Mermaid/PlantUML/D2 block (```mermaid …) or `.mmd`/`.puml`/`.d2`/`.drawio` file showing components; an image (`.svg`/`.png`/`.jpg`) of an architecture or system diagram, linked from the README or `docs/`
- does not count: a directory-tree listing or other ASCII file layout; a prose architecture document (`ARCHITECTURE.md`, `overview.md`) with no drawn diagram; a PDF or slide deck; ADRs; a diagram that is an ERD or a flow (those are not the overview)
- Unsure whether something is a diagram: it does not count; write the overview and mention the doubt in the ADR as `[verify]`
- Record in the brain note which file counted, or `existing diagram: none`

| Diagram | File | `kind` | Spec it for `designer` only when |
|---|---|---|---|
| High-level architecture | `docs/architecture/overview.html` | `architecture` | The task adds or removes a component, datastore, queue, external integration or changes the deploy model (and the change is not already clear from `deploy.md` / an ADR). For a mobile, desktop or CLI target show the app, its local storage, the backend if any, and the OS or external services it calls |
| State | `docs/architecture/states/<slug>.html` | `state` | The task adds or changes a status field or lifecycle with three or more states and a rule on how it moves (order, job, subscription, approval): events, guards, retries and the terminal states. A boolean or a two-value status: no diagram |
| Deployment | `docs/architecture/deployment.html` | `deployment` | The task changes where something runs: a new host, container, replica count, port or managed service. Not for the logical components (that is `overview.html`) |
| Database (ERD) | `docs/architecture/data-model.html` | `erd` | The contract adds two or more tables, or adds or changes a relationship (FK, join table, cardinality). One new column or index: no diagram |
| Flow | `docs/architecture/flows/<slug>.html` | `flow` | An AC's behaviour spans three or more participants (client, API, DB, queue, third party) or its ordering is not obvious: auth handshake, payment, async job, retry or rollback. A plain CRUD endpoint: no diagram |

### Patterns
When the point of a diagram is behaviour, add `"pattern"` (see [diagram-style.md](../../../skills/muffy/references/diagram-style.md) "Patterns"): `queue-bottleneck` for a task that adds a queue or a shared worker where load matters, `lifecycle` for a `state` diagram of an entity with retries and end states, `db-schema` for the ERD when `contract/schemas.md` already fixes SQL types, constraints and indexes (a logical ERD without them stays plain), `trust-boundary` for a task that changes who may reach a datastore or an internal service. For a change to an existing architecture, `delta` marks what the task added, removed or altered on top of the current overview (the ADR or the contract links it). `overview.html` stays the current picture and is never copied per task; a delta is its own distinct file `docs/architecture/changes/<slug>.html` (like a flow), only when the change touches three or more components or links and the contract alone does not make it clear. A pattern is not a new trigger: it only applies when a table trigger above already fired.

### A diagram the user already has
Redrawing a user's Mermaid, draw.io or Excalidraw file into muffy's format is only on request, never a trigger of its own. Follow "Importing an existing diagram" in [diagram-style.md](../../../skills/muffy/references/diagram-style.md). In onboard mode an existing diagram still counts and is linked, not redrawn.

### Say the plan before handing off
Before writing the spec, state in one line: the `kind`, the trigger from the table that fired, and what you leave out on purpose (components or links the reader does not need). Put it in the hand-off note, or in the question to the user when one is already being asked; do not add a round trip for it. Skip it only for an update that changes one node or edge.

### What you hand `designer`
You write the diagram's **content**, not the file: the `kind`, the JSON body per [diagram-style.md](../../../skills/muffy/references/diagram-style.md) (nodes/edges or the kind's equivalent, with `col`/`row` left to `designer` if you have no layout opinion), the target path, the pattern if any, and the link to the `contract.md` section it explains. Put this in your hand-off (`diagrams_spec`, one entry per diagram) for the Orchestrator to pass to `designer`. `designer` copies the template, pastes the JSON, runs `check-diagram.mjs` and `check-diagram-render.mjs`, and fixes layout-only failures itself; a content failure (a fact that doesn't check out) goes back to you.

### Rules
- **Update, don't add:** if the file exists, your spec changes only the part this task touches (the JSON for that part). Never spec a second overview or a per-task copy; a flow gets its own file only because it is a distinct flow
- The diagram shows what the contract and schema already decide. It never introduces a decision, a table or a field that `contract.md` / `contract/schemas.md` lacks. When they disagree, the contract wins and you fix the spec
- **Terms are the code's terms.** Before the spec goes out, check every table, field, status, state and endpoint name in the JSON against the schema or code it comes from (grep the identifier). Use that exact spelling and meaning: a field `eos` (end of support) is not "EOL". A name you cannot find in the code is `verify: true`, never a guessed synonym
- **Notes are written for a reader who did not write the code.** One short point per line (`"\n- point"`), no paragraph, labels short enough to fit a card or a step. Full wording goes in the contract, not the diagram
- Add one line with a link to `contract.md` (under the section it explains) only for a diagram you spec'd or changed this round
- Record in the brain note either the paths spec'd or `diagrams: none needed (<reason>)`

### Onboard overview
- Facts only, from `baseline.md` and the code it points to: the components that exist (app, services, workers), datastores, external services, and the main call or data direction between them. Mark anything you could not confirm `verify: true`. Recommend and invent nothing
- `kind: architecture`, at most 15 nodes, every edge labelled, and `commit` set to the baseline's commit so staleness is visible
- Not a target design and not an ERD or a flow: those wait for a task that needs them
- The user reviews it with the baseline at `pause:onboard-review`; it is not committed before that approval
