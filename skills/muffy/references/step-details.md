# Step details

The long form of the rows in [steps.md](steps.md) that need more than one line. Open only the section of the step you are at.

## Step 2b

**Agent:** **Human gate** `pause:plan-review`, runs only when step 2 ran

**Input:** `ac.md`, `docs/plan/<task>.md`, the product ADR

**Output:** Before asking: save `paused at pause:plan-review` in checkpoint `## Status` and the vault task note. Build the question body with `node .claude/skills/muffy/scripts/gate-summary.mjs .team/<task> 2b --plan docs/plan/<task>.md` (`ready=no` → fix its reasons before asking): `AskUserQuestion` with the user stories, the AC list (ids + one line each), out of scope, the plan's phases (which are in this run, which are backlog, each with its P0/P1/P2 tasks and strategy score), the brief-item → AC traceability gaps if any, and every `[assumed]` item. Approve / Request changes / Reject. Request changes → reasons to `product-manager` (resume it with `SendMessage`), re-ask. **Blocks step 3 until the user approves**: record the answer with `node .claude/skills/muffy/scripts/checkpoint.mjs gate .team/<task> 2b approve --by "<the user's reply>"` (or `reject`; the pause stays). `guard-gates.mjs` blocks every spawn past step 2 until `gate 2b passed` is on record (hooks-enforcement.md §14); `designer`, `architect` and `devops` are not spawned before

## Step 3

**Agent:** `designer` ∥ `architect` ∥ `devops` mode 1 — one message

**Input:** `ac.md`, `brief.md`, plan

**Output:** `design.md`, `contract.md`, `deploy.md` (architect may return `needs-input` to have you pick a third-party provider, designer, only when the sources conflict on the Platform, and devops mode 1, only when `infra: propose`, to have you pick the infrastructure (cloud, on-premises, hybrid): interview the user per [requirements.md](requirements.md), then resume it). A designer that created the design system returns `done` on the starter style with one non-blocking style question: keep it for the 3c question ([requirements.md](requirements.md)). When every needs-input is answered, architect aligns the contract with `deploy.md`: pinned runtime, devops-owned files and, when the user picked infrastructure, its ADR; record that choice as `infra: existing: <chosen>` in checkpoint `## Status` and `project.md` so it is not proposed again. If the architect's hand-off carries `diagrams_spec`, relay each entry to the same `designer` (`SendMessage`, after its own canvas/screen-map work) to draw — `designer` never specs a diagram's content itself except the screen map

## Step 3b

**Agent:** Orchestrator

**Input:** `.team/<task>/canvas/`

**Output:** Publish the canvas on Claude Design (Artifact type "Design", `quickstart` intent `design`), put the URL in `design.md`, and **save it right away** in `checkpoint.md` `## Status` (`canvas: <url>`) and as a link in `<brain>/tasks/<task>.md`, so a resume finds it; after `contract.md`, designer aligns fields and you republish. When `design.md` starts with `Design system: after contract`, skip the first publish (wireframes only): the align round creates the design system from the contract's Stack and applies it, then you publish once

## Step 3e

**Agent:** Orchestrator, **only if a diagram file was written or changed**

**Input:** the diagram `.html` paths in `paths_written` (`diagrammer` drew it from facts spec'd by architect at step 3 or onboard 0c, by the designer's screen-map spec at step 3 or by the product-manager at step 1, each relayed in one `diagrammer` spawn after 3b; fix-lane 4a is the exception — the diagnosing dev draws `flow.html` itself)

**Output:** Runs right after 3b (before 3c), after onboard 0c (before 0d) or after 4a. First spawn `diagrammer` once, fresh at effort `medium`, with every `diagrams_spec` of the round (none in the fix lane: the dev drew `flow.html`); its hand-off lists the files. Then validate with `check-diagram.mjs` then `check-diagram-render.mjs`, publish each file as its own Artifact (republish keeps the URL from `project.md` → `## Diagrams`), then **record it right away** in `<brain>/tasks/<task>.md` → `## Diagrams`, `project.md` → `## Diagrams` and `checkpoint.md` `## Status` (`diagrams: <n> published`). Never block: invalid or unpublishable → record why and continue. Details: [diagram-publish.md](diagram-publish.md)

## Step 3c

**Agent:** **Design gate** (automated check, then **Human gate** `pause:design-review`)

**Input:** `design.md` + URL, `contract.md`

**Output:** (1) Designer's Definition of done all checked (published, every AC has an artboard, no placeholders, values from `docs/design-system/` tokens, new components documented) — else send back, no question to the user yet. (1b) **UX/UI review** of the rendered canvas by the Orchestrator ([design-review.md](design-review.md)): `high` findings go back to `designer` before the user is asked; the rest go into the question. (2) Then `node .claude/skills/muffy/scripts/gate-summary.mjs .team/<task> 3c` builds the body (a `high` finding or an AC without an artboard → `ready=no`, back to `designer`) and `AskUserQuestion` with the canvas URL, an artboard-per-AC list, new components, open `[verify]` items and the UX/UI review's remaining findings (or "review skipped: impeccable not installed"). Before asking: save `paused at pause:design-review` in checkpoint `## Status` and the vault task note. Approve / Request changes / Reject. Request changes → reasons to `designer` (+ `architect` if the contract is affected), republish, check (1) and (1b) again, ask again. **Blocks step 4 until the user approves**: record the answer with `node .claude/skills/muffy/scripts/checkpoint.mjs gate .team/<task> 3c approve --by "<the user's reply>"` (or `reject`). `approve` refuses unless `gate-summary.mjs … 3c` is ready. `guard-gates.mjs` blocks backend-dev, frontend-dev, code-reviewer, qa-tester, docs-writer and devops mode 2 until `gate 3c passed` is on record (hooks-enforcement.md §14)

## Step 5

**Agent:** Orchestrator

**Input:** —

**Output:** First `node .claude/skills/muffy/scripts/check-ownership.mjs .team/<task>` in the feature worktree: an `out-of-lane` file or one changed on `both` fe and be goes back to its owner per `contract/ownership.md` before any merge (the other side sends its need as a blocker); `unowned` notes go to the architect for a row; a `stale-contract` (a step-4 hand-off whose `contract_commit` is older than the last contract commit on `feature/<task>`) goes back to that dev to re-read the contract. Then merge into `feature/<task>` with `git merge --no-ff` (never `--ff-only`: branches diverge by design); a conflict left after that → file owner rebases

## Step 5b

**Agent:** Orchestrator, **only if the user asked for PR diagrams (off by default; put "draw the PR diagram" in the FE/BE prompts)**

**Input:** `fe/<task>` + `be/<task>` worktrees: each `.pr-lens/<title>/` render folder (folder path in the hand-off `paths_written`)

**Output:** (1) Publish the PR diagrams as one Claude Artifact (not the prlens.dev canvas): `node .claude/skills/muffy/scripts/build-diagram-page.mjs <scratchpad>/pr-diagrams.html <fe render dir> <be render dir>`, then publish that file with the Artifact tool (icon `diagram`); keep the URL for `review-<n>.md`, the Human gate and the closing report. (2) Copy each `drawn.graph.json` to `.team/<task>/diagrams/fe.graph.json` / `be.graph.json` (the reviewer is read-only and cannot open a URL; step 6 reads these files). Missing diagram → skip, never block. Details: [pr-diagram.md](../../../agents/references/frontend-dev/pr-diagram.md)
