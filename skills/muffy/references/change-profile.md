# Change profile: change something the product already has

One lane for work on what already exists. Its **scope** says what changes:

| Scope | What changes | Was |
|---|---|---|
| `internal` | Nothing a user or outside caller sees, apart from speed: an internal API, a refactor, a measured performance fix, an index or a reversible migration | the lite lane |
| `ui-only` | Screens and UX, no backend change | redesign, UI only |
| `ui+logic` | Screens and the rules or API behind them | redesign, UI + logic |
| `logic-only` | Backend rules a user or caller sees the result of, no screen change | redesign, logic only |

It is not a new capability (that is the full flow) and not a bug (that is the fix lane). It skips research and runs only the agents the scope needs. The route picks it ([route.md](route.md)); `/muffy lite <request>` starts it with the `internal` scope and `/muffy redesign <request>` with a visible scope asked at `pause:scope`. Everything not listed here follows the normal flow. The scope decides the lane's rules in [lanes.mjs](../scripts/lanes.mjs): only `internal` has no human gates at 2b and 3c, a 15-file limit and a quick baseline.

[lite-profile.md](lite-profile.md) and [redesign-profile.md](redesign-profile.md) are kept as pointers here, for links and tasks written before the merge.

A bug with a symptom is triaged by [fix-profile.md](fix-profile.md) first, and goes to fix or full. A fix promoted out of its lane moves one rung up the [promotion ladder](run-profile.md#promotion-ladder) by its diagnosis's `promote_to`: to this lane's internal scope, a visible scope, or the full flow ([fix-profile.md](fix-profile.md#diagnose-budget-and-outcomes)).

## Triage (Orchestrator, no agent)

All hold for every scope; otherwise say which fails in one line and take the route that fits:

1. The screen, flow, rule, module or query already exists in this repo (check with Grep/Read; do not ask when the repo answers)
2. Not a bug: nothing that worked is broken (a symptom goes to the fix lane)
3. Not a new capability: the system already offers this to its users (a capability it lacks goes to the full flow)

Then the scope. A user or caller can see the change → a visible scope, asked at `pause:scope` (below). Nothing visible changes → `internal`, if all of the internal conditions hold; otherwise run the full flow.

### The internal scope

A request is `internal` only if all hold:

1. A goal and a named area (module, endpoint, table or query). Performance work also gives a measured before-number and how it was measured (`EXPLAIN ANALYZE`, a benchmark, a p95 from monitoring)
2. Nothing a user sees or does changes, apart from speed: no new screen, flow or component, no changed response for an outside caller. A frontend refactor with no visible change is fine
3. Every consumer of a changed API lives in this repo. A public or partner API change needs product sign-off, so it runs the full flow
4. No new dependency, provider, runtime or stack change, and no devops-owned files. A new dependency is where `researcher` finds licence and maintenance blockers
5. No auth, permission or personal-data change
6. Schema changes only through a reversible migration. Dropping data, or a migration with no down path, runs the full flow
7. Expected to touch ≤ 15 source files (tests and `.team/` excluded)

If the goal or the area is missing, or performance work has no before-number, ask **one** `AskUserQuestion` for what is missing (for the number, offer **measure it first**: the Orchestrator runs the read-only measuring command the requester agrees to (`EXPLAIN ANALYZE`, a benchmark script the repo already has), or asks the requester to run it, and records the number; then triage on it), then triage on the answer. Read the signals from the request, then let `node .claude/skills/muffy/scripts/next-action.mjs triage change '<json>'` decide (`triage lite` is the same; keys: `has_goal`, `has_area`, `kind` (`perf`), `has_measurement`, `user_visible`, `outside_consumers`, `adds_dependency`, `changes_auth`, `irreversible_migration`, `expected_source_files`). If a condition fails, say which in one line and run the full flow. A visible change is not held to these seven: its scope question, the plan and design gates and the contract do that work.

### Examples

| Request | Scope | Why |
|---|---|---|
| "Add an internal `GET /internal/jobs/:id/status` for the worker dashboard in this repo, with a `status` column migration" | internal (BE) | Consumer is in the repo; the migration has a down path |
| "Add an index on `orders(customer_id, created_at)`; the orders list query is 1.8 s at p95 (`EXPLAIN ANALYZE` attached)" | internal (BE, perf) | Measured before-number, one table |
| "Split `src/billing/service.ts` (1,200 lines) into modules, no behaviour change" | internal (BE, refactor) | Named area, behaviour unchanged |
| "Move the dashboard's data fetching into hooks; nothing on screen changes" | internal (FE, refactor) | No visible change |
| "Make the API faster" | ask first | No area and no measurement |
| "Add a public `/v1/webhooks` endpoint for partners" | full | Outside callers need docs and product sign-off |
| "Replace our hand-rolled queue with BullMQ" | full | A new dependency |
| "Add role checks to the admin endpoints" | full | An auth change |
| "Drop the unused `legacy_notes` column and its data" | full | Dropped data cannot be migrated back |
| "Move the whole API layer onto a new router structure (about 40 files)" | full | More than 15 source files |

When a request is borderline (an internal endpoint plus "and show it on the settings page"), the visible part makes it a visible scope; or cut it out at `pause:scope` into a separate task.

## Scope question (`pause:scope`, always asked for a visible change, never defaulted)

An `internal` triage needs no scope question: the scope is `internal`. Otherwise two calls, since the plan card depends on the scope: the **Scope** question alone, then one call with the plan card's question ([route.md](route.md#say-the-plan)), **Base** and **Announcement**:

- **Scope**, worded for the requester: **เปลี่ยนแค่หน้าตา / the look only** (`ui-only`: screens and UX, no backend change) / **เปลี่ยนทั้งหน้าตาและกฎ / the look and the rules** (`ui+logic`: screens and the rules or API behind them) / **เปลี่ยนแค่กฎเบื้องหลัง / the rules only** (`logic-only`: backend rules, no screen change). Recommend the look only when the prompt names no rule, permission, calculation or state
- **Base** (only when `main` and the current branch differ): recorded as `base:` in checkpoint `## Status`
- **Announcement** (user-facing change only; off by default): yes puts `announcement: yes` in the docs-writer prompt

## Setup-lite (replaces [setup.md](setup.md))

1. Name the task `change-<slug>` and run the common setup, [setup.md](setup.md) steps 1-4: brain and task note, the baseline check with `next-action.mjs baseline --lane change --scope <scope>` (an internal change needs a quick baseline, a visible one a full baseline), then `project.md` Lessons and Open issues. Write the held `baseline` value into `## Status` with the checkpoint
2. `pause:scope`. **Internal**: one `AskUserQuestion` call of up to 4 questions (2-4 options each):
   - **Plan**: the card from `next-action.mjs plan-card change --scope internal`, go / bigger ([route.md](route.md#say-the-plan))
   - **Kind + owner**: internal-api, refactor, perf or db; FE, BE or both
   - **AC + out of scope**: the AC list drafted from the request and a quick read of the named area. Perf AC name the before-number, the target and the measuring command; refactor AC say "behaviour unchanged" and name the tests that prove it. Confirm / Change it
   - **Base** (only when `main` and the current branch differ; never assume `main`): recorded as `base:` in checkpoint `## Status`

   **Visible**: the [Scope question](#scope-question-pausescope-always-asked-for-a-visible-change-never-defaulted) above
3. Create the feature worktree from `<base>`: `git worktree add .worktrees/feature-<task> -b feature/<task> <base>` (a baseline committed at the common setup on another branch is cherry-picked onto it first, [setup.md](setup.md) step 7), then `.team/<task>/`, `handoff/` and `rounds/` inside it. **Internal**: write `.team/<task>/ac.md` there (format below) and commit it to `feature/<task>` (never to `<base>`); the Orchestrator writes it from the same reads, no `product-manager` is spawned for it. **Visible**: no `brief.md`; the prompt and the existing code are the brief, and `product-manager` writes `ac.md` at step 2
4. Write `checkpoint.md` in the feature worktree, then its lane line with `node .claude/skills/muffy/scripts/checkpoint.mjs profile .team/<task> change --scope <scope>` (add `--skip 3d` when no smoke trigger is true, [run-profile.md](run-profile.md)); it writes `lane: change (<scope>) · skipped …` with the steps the table below skips for that scope. `gate-rules.mjs` reads this line

## `ac.md`

Internal, written by the Orchestrator:

```
# AC: <task>
Scope: internal    Kind: internal-api | refactor | perf | db    Owner: FE | BE | both
## Goal       verbatim request
## AC         one row per outcome: AC-<n> | observable result | how it is checked (test, command, measurement)
## Out of scope
```

Visible, written by `product-manager`: each change as an `AC-<n>`, plus `## Unchanged`: the behaviours of the touched screens or rules that must stay as they are. QA covers both. No plan phases and no product ADR unless a product decision is made.

≤ 60 lines and checked by [check-artifacts.mjs](../scripts/check-artifacts.mjs) like any `ac.md`: every AC id must appear in the contract the architect writes.

## Steps by scope

| # | Agent | internal | ui-only | ui+logic | logic-only |
|---|---|---|---|---|---|
| 1 | `researcher` | skipped | skipped | skipped | skipped |
| 2 | `product-manager` | skipped: the Orchestrator wrote `ac.md` | `ac.md` from the current screens and the request | same | `ac.md` from the current rules and the request |
| 2b | Human gate `pause:plan-review` | skipped (no gates) | **skipped**: `checkpoint.mjs gate 2b skip --reason "combined with the design gate"`; the AC are shown at 3c | asked | asked |
| 3 | `designer` ∥ `architect` ∥ `devops` mode 1 | `architect`, plus devops mode 1 in the same message only for a migration or when there is no `deploy.md`. `Read:` `ac.md` (no `brief.md`, no `design.md`). Devops mode 1 makes sure the migration runs up and down on docker local | `designer` only | `designer` ∥ `architect`; devops mode 1 only for a migration or when there is no `deploy.md` | `architect`; devops mode 1 as left |
| 3b, 3e | publish canvas, diagrams | skipped (no canvas); 3e only if a diagram trigger fires | as the full flow | as the full flow | skipped (no canvas) |
| 3c | Human gate `pause:design-review` | skipped (no gates) | design + AC together | design + contract | **contract gate**: the contract and the AC ([gate-summary.mjs](../scripts/gate-summary.mjs) shows them when `design.md` is absent) |
| 3d | `devops` mode 2 | only on a smoke trigger ([run-profile.md](run-profile.md)); cut worktrees for the owners named in `ac.md` exactly as [setup.md](setup.md) step 7 says | same | same | same |
| 4, 5 | dev, then Orchestrator merge | per `Owner:` in `ac.md`; perf: the dev records the before and after numbers with the AC's command in the hand-off summary | `frontend-dev` | `frontend-dev` ∥ `backend-dev` | `backend-dev` |
| 6 | `code-reviewer` | never skipped, never downgraded | same | same | same |
| 7 | `qa-tester` | **L2** for refactor, perf and db (refactor: the named tests pass before and after; db: the migration runs up and down), **L3** for internal-api with new AC; a migration is applied on docker local before the smoke | L3, limited to the pages the diff touched | L3, pages and endpoints the diff touched | L3 with no UI e2e, endpoints and flows the diff touched |
| 10 | Human gate | accept the branch; for perf, the question includes the before and after numbers | accept the branch | accept the branch | accept the branch |
| 11 | `docs-writer`, after the gate approves | changelog or release notes and a **Deploy hand-off** (migration and its rollback, new config, perf numbers); skipped when there is no migration, no new config, nothing a user sees and no doc mentions the changed part (`docs skipped: <reason>` in `tasks/<task>.md`) | changelog and user docs of the changed pages | those plus API docs and the changed business rules | API docs and the changed business rules |
| 12 | Orchestrator | [closing.md](closing.md) in full, `## Usage` from `spawns.tsv` | same | same | same |

Internal: Skipped: 1 (`researcher`), 2 (`product-manager`), `designer`, 3b, 3c. Never skipped: 3, 6, 7, 10.

Rules for the visible scopes:

- **The designer** reads the current screens (running page URL, screenshots or the component files) and `docs/design-system/`; `design.md` shows before and after for each screen. Tokens come from the design system; a new component or colour is a design-system change that the gate lists
- **The architect** writes a contract for the changed rules only and reads the current code; it does not redesign what the request leaves alone
- **QA scope is by path.** The Orchestrator maps `git diff --name-only <base>...<branch>` to pages, routes and endpoints and writes them into the qa-tester `Read:` line with the `## Unchanged` rows for them. `test-level` is `L3`. A touched shared component or module that other pages use is a trigger to offer `pause:full-regression` ([test-levels.md](test-levels.md)); QA never widens on its own
- **`docs-writer` always runs for a visible scope** (no skip rule). It follows step 11 of [steps.md](steps.md): after the Human gate, only what the diff touched, a Deploy hand-off, a self-check instead of a review
- **Never skipped:** 2, 6, 7, 10, 11, and 3c whenever a designer or architect ran

## Promote out of the internal scope

The internal scope signals a promote through a blocker owned by an agent it skips, so no new hand-off field is needed. The Orchestrator checks the blocker before acting (see below the table):

| Signal | Means | Restart at |
|---|---|---|
| Step 3 or 4 hand-off `status: blocked` with a blocker `owner: Researcher` | the change needs a new dependency, provider or stack fact | step 1 |
| a blocker `owner: PM` | the change is visible to users: **a visible scope**, asked (`logic-only` when only a rule or result changes) | step 2, as a visible change |
| a blocker `owner: PM` | an outside caller sees it, or it touches auth, permissions or personal data | step 2, full flow |
| a blocker `owner: Designer` | the change needs a changed screen, flow or component: **a visible scope** with a designer, `ui+logic` or `ui-only` (asked); a new one is the full flow | step 2 (then 3 with the designer) |
| Step 4 changed more than 15 source files, a dependency, devops-owned files or auth files (`node .claude/skills/muffy/scripts/diff-signals.mjs <base> <branch> --profile change` exits 1) | the work outgrew the scope | step 2 |

The owner alone does not promote. Read the blocker's `problem` and promote only when it names a failed triage condition (a visible change, an outside consumer, auth or personal data, a new dependency or stack fact, a new screen, flow or component). For the internal scope the Orchestrator wrote `ac.md`, so a `PM` blocker that only asks what an AC means is a clarification: ask the user one `AskUserQuestion`, update `ac.md`, and send the answer back to the same agent.

A blocker `owner: Architect` at step 4 is not a promote: the architect is in this scope, so it goes back to step 3 through the normal loop ([loops.md](loops.md)). On a promote: stop, keep `ac.md` and `contract.md` as input for the restarted steps, switch the lane with `node .claude/skills/muffy/scripts/checkpoint.mjs profile .team/<task> change --scope <visible scope>` for a visible change or `node .claude/skills/muffy/scripts/checkpoint.mjs profile .team/<task> feature` for the full flow (never by editing the line by hand), and record the reason in the checkpoint and the vault task note. A visible scope keeps the gates, so the plan and design are approved before code goes on.

## When a UI-only run needs logic

A designer or frontend-dev who finds the design needs a field, endpoint or rule the backend lacks does not invent it and does not edit the backend. It returns a `blocker` with `owner: Architect` and a `problem` that starts `needs-logic:` followed by what is missing.

1. Orchestrator saves `pause:scope-upgrade` and asks one `AskUserQuestion`: **add the logic** (becomes `ui+logic`) or **cut that part from the design** (stays `ui-only`)
2. Add: keep the work done, record the new scope with `checkpoint.mjs profile .team/<task> change --scope ui+logic`, run `product-manager` to revise `ac.md`, ask gate 2b (it is no longer skipped), spawn `architect` for the contract, then `backend-dev` after the gate. Nothing is redone
3. If the missing piece is a whole new capability (several endpoints or a new data model), say so in the question and offer the full flow as a third option
4. At most once per task. A second `needs-logic:` stops the run and the user decides in chat

## Model and effort

Defaults from [token-discipline.md](token-discipline.md); the architect keeps its default model and effort, and `code-reviewer`, `architect` and `devops` are never downgraded. `qa-tester` re-running existing tests only may use `haiku`.

## Prompt differences

No `Profile:` header. Build each prompt with `make-envelope.mjs --scope <scope>`, which puts `Scope: internal | ui-only | ui+logic | logic-only` in the header, so no agent works outside it. Internal: `Read:` lists `ac.md` and `contract.md` (and `deploy.md` where the step needs it); `brief.md` and `design.md` do not exist, and the architect reads the Internal-change note in its workflow. Visible: the usual `ac.md`, `design.md` and `contract.md`, minus `brief.md`; `Read:` for `qa-tester` carries the touched paths and the `## Unchanged` rows. Older tasks may still say `--profile lite`, which `make-envelope.mjs` turns into `Scope: internal`.
