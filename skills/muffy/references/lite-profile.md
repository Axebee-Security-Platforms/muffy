# Lite profile: internal changes that need a contract, not a product

A lane between the fix lane and the full flow, for internal work whose shape the requester already knows: an internal API, a refactor, a performance fix or a database change (index, reversible migration). It skips research, product and design and goes straight to `architect` for the contract, then the usual build, review, QA, staging and Human gate. Start it with `/muffy lite <description>`, or when the Orchestrator classifies a request this way at setup. Everything not listed here follows the normal flow.

A bug with a symptom is triaged by [fix-profile.md](fix-profile.md) first, and goes to fix or full; this lane takes internal work that is not a bug fix. A fix promoted out of its lane goes to the full flow, as the fix profile says.

## Triage (Orchestrator, no agent)

A request is **lite** only if all hold; otherwise run the full flow:

1. A goal and a named area (module, endpoint, table or query). Performance work also gives a measured before-number and how it was measured (`EXPLAIN ANALYZE`, a benchmark, a p95 from monitoring)
2. Nothing a user sees or does changes, apart from speed: no new screen, flow or component, no changed response for an outside caller. A frontend refactor with no visible change is fine
3. Every consumer of a changed API lives in this repo. A public or partner API change needs `docs-writer`, step 8 and product sign-off
4. No new dependency, provider, runtime or stack change, and no devops-owned files. A new dependency is where `researcher` finds licence and maintenance blockers
5. No auth, permission or personal-data change
6. Schema changes only through a reversible migration. Dropping data, or a migration with no down path, runs the full flow
7. Expected to touch ≤ 15 source files (tests and `.team/` excluded)

If the goal or the area is missing, or performance work has no before-number, ask **one** `AskUserQuestion` for what is missing, then triage on the answer. Read the signals from the request, then let `node .claude/skills/muffy/scripts/next-action.mjs triage lite '<json>'` decide (keys: `has_goal`, `has_area`, `kind` (`perf`), `has_measurement`, `user_visible`, `outside_consumers`, `adds_dependency`, `changes_auth`, `irreversible_migration`, `expected_source_files`). If a condition fails, say which in one line and run the full flow.

### Examples

| Request | Lane | Why |
|---|---|---|
| "Add an internal `GET /internal/jobs/:id/status` for the worker dashboard in this repo, with a `status` column migration" | lite (BE) | Consumer is in the repo; the migration has a down path |
| "Add an index on `orders(customer_id, created_at)`; the orders list query is 1.8 s at p95 (`EXPLAIN ANALYZE` attached)" | lite (BE, perf) | Measured before-number, one table |
| "Split `src/billing/service.ts` (1,200 lines) into modules, no behaviour change" | lite (BE, refactor) | Named area, behaviour unchanged |
| "Move the dashboard's data fetching into hooks; nothing on screen changes" | lite (FE, refactor) | No visible change |
| "Make the API faster" | ask first | No area and no measurement |
| "Add a public `/v1/webhooks` endpoint for partners" | full | Outside callers need docs and product sign-off |
| "Replace our hand-rolled queue with BullMQ" | full | A new dependency |
| "Add role checks to the admin endpoints" | full | An auth change |
| "Drop the unused `legacy_notes` column and its data" | full | Dropped data cannot be migrated back |
| "Move the whole API layer onto a new router structure (about 40 files)" | full | More than 15 source files |

When a request is borderline (an internal endpoint plus "and show it on the settings page"), cut the visible part out at `pause:scope` into a separate task, or run the full flow.

## Setup-lite (replaces [setup.md](setup.md))

1. Name the task `lite-<slug>`. Create the vault task note `<brain>/tasks/<task>.md`; add it to `project.md` → `## Tasks`. Read `project.md` Lessons and Open issues
2. `pause:scope`, shortened, in one `AskUserQuestion` call of up to 4 questions (2-4 options each):
   - **Kind + owner**: internal-api, refactor, perf or db; FE, BE or both
   - **AC + out of scope**: the AC list drafted from the request and a quick read of the named area. Perf AC name the before-number, the target and the measuring command; refactor AC say "behaviour unchanged" and name the tests that prove it. Confirm / Change it
   - **Base** (only when `main` and the current branch differ; never assume `main`): recorded as `base:` in checkpoint `## Status`
   - **Staging and infra** (only when `project.md` / the last checkpoint never recorded `staging:` or `infra:`); otherwise copy both into checkpoint `## Status`
3. Create the feature worktree from `<base>`: `git worktree add .worktrees/feature-<task> -b feature/<task> <base>`, then `.team/<task>/`, `handoff/` and `rounds/` inside it. Write `.team/<task>/ac.md` there (format below). The Orchestrator writes it from the same reads; no `product-manager` is spawned for it
4. Commit `ac.md` to `feature/<task>` (never to `<base>`)
5. Write `checkpoint.md` in the feature worktree with `## Run profile` = `lite: skipped 1, 2, 3b, 3c, 8` (add `3d` when no smoke trigger is true, [run-profile.md](run-profile.md))

## `ac.md` in this lane

```
# AC: <task>
Profile: lite    Kind: internal-api | refactor | perf | db    Owner: FE | BE | both
## Goal       verbatim request
## AC         one row per outcome: AC-<n> | observable result | how it is checked (test, command, measurement)
## Out of scope
```

≤ 60 lines and checked by [check-artifacts.mjs](../scripts/check-artifacts.mjs) like any `ac.md`: every AC id must appear in the contract the architect writes.

## Steps in the lite lane

| # | Agent | Notes |
|---|---|---|
| 3 | `architect`, plus `devops` mode 1 in the same message only when the change has a migration or the repo has no `deploy.md` | `Read:` `ac.md` (no `brief.md`, no `design.md`). Contract as usual: index + part files, diagrams only if a trigger fires. Devops mode 1 makes sure step 9 applies the migration |
| 3d | `devops` mode 2 | Only if a smoke trigger is true ([run-profile.md](run-profile.md)). Commit the planning files and cut worktrees for the owners named in `ac.md` exactly as [setup.md](setup.md) step 7 says (from `ops/<task>` after 3d, or from `feature/<task>` when 3d is skipped) |
| 4, 5 | `frontend-dev` ∥ `backend-dev`, then Orchestrator merge | As in the full flow. Perf: the dev records the before and after numbers with the AC's command in the hand-off summary |
| 6 | `code-reviewer` | Never skipped, never downgraded |
| 7 | `qa-tester` | Level from [test-levels.md](test-levels.md): **L2** for refactor, perf and db (refactor: the named tests pass before and after; db: the migration runs up and down), **L3** for internal-api with new AC. No `docs-writer`, no step 8 |
| 9 | `devops` mode 3 | Staging against `deploy.md` (the one devops wrote at step 3, or the newest `.team/*/deploy.md`); a migration is applied there before the smoke |
| 10, 11 | Human gate, devops production | Unchanged. For perf, the question includes the before and after numbers |
| 12 | Orchestrator | [closing.md](closing.md) in full, `## Usage` from `spawns.tsv` |

Skipped: 1 (`researcher`), 2 (`product-manager`), `designer`, 3b, 3c, 8. Never skipped: 3, 6, 7, 9, 10.

## Promote to the full flow

The lane signals a promote through a blocker owned by an agent this lane skips, so no new hand-off field is needed. The Orchestrator checks the blocker before acting (see below the table):

| Signal | Means | Restart at |
|---|---|---|
| Step 3 or 4 hand-off `status: blocked` with a blocker `owner: Researcher` | the change needs a new dependency, provider or stack fact | step 1 |
| a blocker `owner: PM` | the change is visible to users or outside callers, or touches auth, permissions or personal data | step 2 |
| a blocker `owner: Designer` | the change needs a new or changed screen, flow or component | step 2 (then 3 with the designer) |
| Step 4 changed more than 15 source files, a dependency, devops-owned files or auth files (`node .claude/skills/muffy/scripts/diff-signals.mjs <base> <branch> --profile lite` exits 1) | the work outgrew the lane | step 2 |

The owner alone does not promote. Read the blocker's `problem` and promote only when it names a failed triage condition (a visible change, an outside consumer, auth or personal data, a new dependency or stack fact, a new screen, flow or component). In this lane the Orchestrator wrote `ac.md`, so a `PM` blocker that only asks what an AC means is a clarification: ask the user one `AskUserQuestion`, update `ac.md`, and send the answer back to the same agent.

A blocker `owner: Architect` at step 4 is not a promote: the architect is in this lane, so it goes back to step 3 through the normal loop ([loops.md](loops.md)). On a promote: stop the lane, keep `ac.md` and `contract.md` as input for the restarted steps, change `## Run profile` in `checkpoint.md` to the full-flow profile, and record the reason in the checkpoint and the vault task note.

## Model and effort

The architect keeps its default model and effort; never downgrade `code-reviewer`, `architect` or `devops`. Devs follow [token-discipline.md](token-discipline.md). QA re-running existing tests only may use `haiku`.

## Prompt differences

Add `Profile: lite` to the prompt envelope. `Read:` lists `ac.md` and `contract.md` (and `deploy.md` where the step needs it); `brief.md` and `design.md` do not exist in this lane. The architect reads the Lite note in its workflow; other agents work as in the full flow.
