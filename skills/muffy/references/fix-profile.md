# Fix profile — small bugs and cosmetic fixes

A lane for work that does not need research, product, design or architecture: a bug with a known location, a bug whose cause is still unknown (diagnosed inside the lane), or a cosmetic change that reuses existing design-system tokens. Start it with `/muffy fix <description>`, or when the Orchestrator classifies a request this way at setup. Everything not listed here follows the normal flow.

## Triage (Orchestrator, no agent)

A request is a **fix** only if all hold; otherwise run the full flow:

1. A symptom, and either a location or a way to reproduce it. The **cause may be unknown**: that is what step 4a is for
2. Expected to touch ≤ 5 source files (tests and `.team/` excluded)
3. No change to the API shape, schema or migration, auth, a dependency, the runtime/stack, or devops-owned files
4. No new screen, flow or component. Cosmetic work must use tokens already in `docs/design-system/`

If the request says it is a bug or asks for a fix but gives no symptom and no location or repro, do not guess a lane and do not start the full flow: ask **one** `AskUserQuestion` for what happens (error text or wrong result), where (page, endpoint or file) and how to trigger it, then triage on the answer. The words "bug", "fix", "บั๊ก" or "แก้" never decide the lane on their own; the four conditions do.

If one fails, say which in one line and run the full flow. Trivial edits with no behaviour risk (a typo, one line): do them in the main session, no muffy.

### Examples

| Request | Lane | Why |
|---|---|---|
| "Submit on /contact returns 500 when message is empty. `TypeError at src/api/contact.ts:41`" | fix (BE) | Symptom, location and log; one file |
| "Login redirects to the old page after password reset, not sure why" | fix (BE or both) | Cause unknown is fine; step 4a diagnoses it |
| "Submit button on checkout is the wrong colour in dark mode" | fix (FE, cosmetic) | Existing tokens, no new component |
| "Align the card padding on the pricing page with the design system spacing" | fix (FE, cosmetic) | Tokens already exist, no logic change |
| "Date shows a day earlier for users in UTC-5" | fix | Symptom with a clear repro; likely 1–2 files |
| "Add a `phone` field to the signup form" | full | New field changes the schema and the API contract |
| "Redesign the login page" / "make the dashboard look better" | full | New layout and components, design approval needed |
| "Search is slow" | full, or ask first | No symptom, location or repro; ask for a measurement before triage |
| "Invoice totals are wrong" | fix → promoted | Starts as a fix; step 4a finds the cause is a rounding rule in the contract and returns `needs-full-flow` |
| "Upgrade React to 19 and fix what breaks" | full | A dependency change |
| "เจอบั๊ก แก้ไขให้หน่อย" | ask first | A bug report with no symptom, location or repro: ask for them before triage |
| "Fix the typo in the footer" | none (main session) | One line, no behaviour risk |

When the request is borderline (for example a bug plus "while you are there, also…"), cut the extra work out at `pause:scope` and put it in the out-of-scope list or a separate task.

## Setup-lite (replaces [setup.md](setup.md))

1. Name the task `fix-<slug>`. Create the vault task note `<brain>/tasks/<task>.md`; add it to `project.md` → `## Tasks`. Read `project.md` Lessons and Open issues
2. `pause:scope`, shortened, in one `AskUserQuestion` call of up to 4 questions (2–4 options each):
   - **Kind + owner**: bug or cosmetic; FE, BE or both
   - **AC + out of scope**: the AC list drafted from the request and a quick read of the named files, with out of scope. Confirm / Change it
   - **Base** (only when `main` and the current branch differ; never assume `main`): recorded as `base:` in checkpoint `## Status`
   - **Staging** (only when `project.md` / the last checkpoint never recorded `staging:`)
3. Create the feature worktree from `<base>`, which holds the team folder: `git worktree add .worktrees/feature-<task> -b feature/<task> <base>`, then `.team/<task>/`, `handoff/` and `rounds/` inside it. Write `.team/<task>/fix.md` there (≤ 60 lines, below). The Orchestrator writes it from the same reads; no agent is spawned for it
4. Commit `fix.md` to `feature/<task>` (never to `<base>`), then cut one worktree per owner from that commit: `git worktree add .worktrees/<fe|be>-<task> -b <fe|be>/<task> feature/<task>`. qa gets one at step 7 as usual
5. Write `checkpoint.md` in the feature worktree with `## Run profile` = `fix: skipped 1, 2, 3, 3b, 3c, 3d, 8`

## `fix.md`

```
# Fix: <task>
Kind: bug | cosmetic    Owner: FE | BE | both
## Goal       verbatim request
## Symptom    what happens, where, what is expected
## Cause      filled by step 4a: one line + confidence (blank before); links `flow.html` if a flow diagram was needed
## Repro      test name, command, URL + viewport, or log line; blank if unknown
## AC         one row per fix: AC-<n> | observable result | regression test or visual check
## Out of scope
```

Optional `.team/<task>/flow.html` (published and recorded at step 3e right after 4a, [diagram-publish.md](diagram-publish.md)): one flow diagram ([diagram-style.md](diagram-style.md)) the diagnosing dev draws only when the cause cannot be found without understanding a multi-participant flow. It is read by the reviewer and stays in the task folder.

AC ids use the usual `AC-<n>` form, so `ac_ids_done`, traceability and the QA report work unchanged.

## Steps in the fix lane

| # | Agent | Notes |
|---|---|---|
| 4a | `frontend-dev` / `backend-dev` (FE ∥ BE if both) | **Diagnose, no code yet.** Reproduce, trace the failing path, test the hypothesis against a second piece of evidence, write `## Cause` and `## Repro` in `fix.md`. Hand-off carries `diagnosis` ([schema](../schemas/handoff.schema.json)) |
| 4 | same agent, via `SendMessage` | Fix + regression test that fails before and passes after. Cosmetic: the AC's visual check. Same context, so the code read in 4a is not read again |
| 5 | Orchestrator | Merge into `feature/<task>` with `--no-ff`, as usual |
| 6 | `code-reviewer` | Diff + `fix.md` (including Cause and Repro). Never skipped, never downgraded |
| 7 | `qa-tester` | `fix.md` AC replace `ac.md` and `design.md`. Level L0, L1 or L2 from [test-levels.md](test-levels.md); qa-tester runs exactly what that row allows (L0 build + lint, L1 the regression test + unit tests of the touched files, L2 also one boundary integration test), by path; never the whole suite ([hooks-enforcement.md](hooks-enforcement.md) §10). Cosmetic AC with no automated check are marked `manual` in `qa-report.md` and shown at the Human gate. No docs-writer, no step 8 |
| 9 | `devops` mode 3 | Staging health + smoke against the newest `.team/*/deploy.md` (path in the prompt). No `deploy.md` and no staging → near-production env per `project.md` |
| 10, 11 | Human gate, devops production | Unchanged. One question: qa-report, staging result, the diff summary |
| 12 | Orchestrator | [closing.md](closing.md) steps 2–6 in full, not abbreviated: `## Usage` from `spawns.tsv`, Lessons tally (step 4 marks the checkpoint `closed`, so a resume skips it); skip step 1 unless a decision or stack learning came out of the fix |

Never skipped: 4a, 6, 7, 9, 10. A fix with no diagnosis hand-off cannot start step 4.

## Diagnose budget and outcomes

Read the `diagnosis` object in the 4a hand-off and route on it:

| `diagnosis.status` | Action |
|---|---|
| `known` (confidence medium or high, with `cause`, `files`, `repro`) | `SendMessage` the same agent to go on to step 4 |
| `unknown` | Relay `reason` to the user via `AskUserQuestion` (more info, a log, a repro). Send the answer to the same agent for **one** more diagnose round. A second `unknown` at the same point → escalate `loop-limit` ([loops.md](loops.md)) |
| `needs-full-flow` | **Promote**: the cause is in the contract, a dependency, the stack or a design decision. Stop the lane, keep `fix.md` as the brief, rename the profile in `checkpoint.md`, and start the full flow at step 2 (PM) with `fix.md` + the diagnosis as input |

**Promote** also when step 4 reports more than 5 source files changed, or a blocker owned by `Architect`. Record the reason in `checkpoint.md` and the vault task note.

## Model and effort

Spawn 4a with `model: haiku` only when the symptom already names the file and line. Otherwise keep the agent default (`sonnet`). Never downgrade `code-reviewer` or `devops`. QA re-running existing tests only may use `haiku`, as in [token-discipline.md](token-discipline.md).

## Prompt differences

Add `Profile: fix` to the prompt envelope. `Read:` lists `.team/<task>/fix.md` instead of `ac.md`, `contract.md`, `brief.md` and `design.md`; those files do not exist in this lane. Agents read their `fix-profile.md` reference at start.
