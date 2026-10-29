# Fix profile: small bugs and cosmetic fixes

A lane for work that does not need research, product, design or architecture: a bug with a known location, a bug whose cause is still unknown (diagnosed inside the lane), or a cosmetic change that reuses existing design-system tokens. Start it with `/muffy fix <description>`, or when the Orchestrator classifies a request this way at setup. Everything not listed here follows the normal flow.

## Triage (Orchestrator, no agent)

A request is a **fix** only if all hold; otherwise run the full flow:

1. A symptom, and either a location or a way to reproduce it. The **cause may be unknown**: that is what step 4a is for
2. Expected to touch ≤ 5 source files (tests and `.team/` excluded)
3. No change to the API shape, schema or migration, auth, a dependency, the runtime/stack, or devops-owned files
4. No new screen, flow or component. Cosmetic work must use tokens already in `docs/design-system/`

If the request says it is a bug or asks for a fix but gives no symptom and no location or repro, do not guess a lane and do not start the full flow: ask **one** `AskUserQuestion` for what happens (error text or wrong result), where (page, endpoint or file) and how to trigger it, then triage on the answer. The words "bug", "fix", "บั๊ก" or "แก้" never decide the lane on their own; the four conditions do.

Read the signals from the request, then let `node .claude/skills/muffy/scripts/next-action.mjs triage fix '<json>'` decide (keys: `trivial_one_line`, `has_symptom`, `has_location`, `has_repro`, `changes_contract`, `adds_new_ui`, `expected_source_files`). If one fails, say which in one line and run the full flow. Internal work that is not a bug fix (an internal API, a refactor, a measured performance fix, an index) is the change lane's internal scope, triaged by [change-profile.md](change-profile.md#the-internal-scope) instead. Trivial edits with no behaviour risk (a typo, one line): do them in the main session, no muffy.

### Examples

| Request | Lane | Why |
|---|---|---|
| "Submit on /contact returns 500 when message is empty. `TypeError at src/api/contact.ts:41`" | fix (BE) | Symptom, location and log; one file |
| "Login redirects to the old page after password reset, not sure why" | fix (BE or both) | Cause unknown is fine; step 4a diagnoses it |
| "Submit button on checkout is the wrong colour in dark mode" | fix (FE, cosmetic) | Existing tokens, no new component |
| "Align the card padding on the pricing page with the design system spacing" | fix (FE, cosmetic) | Tokens already exist, no logic change |
| "Date shows a day earlier for users in UTC-5" | fix | Symptom with a clear repro; likely 1-2 files |
| "Add a `phone` field to the signup form" | change | An existing form plus its schema and API contract; the scope is asked |
| "Redesign the login page" / "make the dashboard look better" | change | Changes an existing screen or flow; needs design approval ([change-profile.md](change-profile.md)) |
| "Search is slow" | full, or ask first | No symptom, location or repro; ask for a measurement before triage |
| "Invoice totals are wrong" | fix → promoted | Starts as a fix; step 4a finds the cause is a rounding rule users see and returns `needs-full-flow` with `promote_to: change-visible` |
| "Upgrade React to 19 and fix what breaks" | upgrade | A version bump of a dependency already used ([upgrade-profile.md](upgrade-profile.md)); not a fix |
| "เจอบั๊ก แก้ไขให้หน่อย" | ask first | A bug report with no symptom, location or repro: ask for them before triage |
| "Fix the typo in the footer" | none (main session) | One line, no behaviour risk |

When the request is borderline (for example a bug plus "while you are there, also…"), cut the extra work out at `pause:scope` and put it in the out-of-scope list or a separate task.

## Setup-lite (replaces [setup.md](setup.md))

1. Name the task `fix-<slug>` and run the common setup, [setup.md](setup.md) steps 1-4: brain and task note, the baseline check with `next-action.mjs baseline --lane fix`, then `project.md` Lessons and Open issues. Write the held `baseline` value into `## Status` with the checkpoint
2. `pause:scope`, shortened, in one `AskUserQuestion` call of up to 4 questions (2-4 options each):
   - **Plan**: the card from `next-action.mjs plan-card fix --scope <bug | cosmetic>`, go / bigger ([route.md](route.md#say-the-plan))
   - **Kind + owner**: bug or cosmetic; FE, BE or both
   - **AC + out of scope**: the AC list drafted from the request and a quick read of the named files, with out of scope. Confirm / Change it
   - **Base** (only when `main` and the current branch differ; never assume `main`): recorded as `base:` in checkpoint `## Status`
3. Create the feature worktree from `<base>`, which holds the team folder: `git worktree add .worktrees/feature-<task> -b feature/<task> <base>` (a baseline committed at the common setup on another branch is cherry-picked onto it first, [setup.md](setup.md) step 7), then `.team/<task>/`, `handoff/` and `rounds/` inside it. Write `.team/<task>/fix.md` there (≤ 60 lines, below). The Orchestrator writes it from the same reads; no agent is spawned for it
4. Commit `fix.md` to `feature/<task>` (never to `<base>`). The `debugger` (4a) and `auditor` (4b) work in the feature worktree and write nothing outside `.team/<task>/`. The dev worktrees are cut at step 4, after the audit, from the feature commit that holds the confirmed `## Cause`: `git worktree add .worktrees/<fe|be>-<task> -b <fe|be>/<task> feature/<task>`, one per owner the debugger named. qa gets one at step 7 as usual
5. Write `checkpoint.md` in the feature worktree, then its lane line with `node .claude/skills/muffy/scripts/checkpoint.mjs profile .team/<task> fix --scope <bug | cosmetic>`, the `Kind:` of `fix.md` (it writes `lane: fix (bug) · skipped 1, 2, 2b, 3, 3b, 3c, 3d`, or with `4b` too for cosmetic; never type the line by hand, the gate and audit guards read it). A line with no scope reads as `bug`

## `fix.md`

```
# Fix: <task>
Kind: bug | cosmetic    Owner: FE | BE | both
## Goal       verbatim request
## Symptom    what happens, where, what is expected
## Cause      filled by step 4a: one line + confidence + severity + owner (blank before); links `flow.html` if a flow diagram was needed
## Repro      test name, command, URL + viewport, or log line; blank if unknown
## Evidence   filled by step 4a: the probes run and what each showed, the hypotheses dropped
## Audit      only when the user accepted the risk after an audit reject: `cause not audited, risk accepted by the user`
## AC         one row per fix: AC-<n> | observable result | regression test or visual check
## Out of scope
```

Optional `.team/<task>/flow.html` (published and recorded at step 3e right after 4a, [diagram-publish.md](diagram-publish.md)): one flow diagram ([diagram-style.md](../../../agents/references/shared/diagram-style.md)) the diagnosing dev draws only when the cause cannot be found without understanding a multi-participant flow. It is read by the auditor and the reviewer and stays in the task folder.

AC ids use the usual `AC-<n>` form, so `ac_ids_done`, traceability and the QA report work unchanged.

## Steps in the fix lane

| # | Agent | Notes |
|---|---|---|
| 4a | `debugger` (one agent for FE and BE) | **Diagnose, no code.** Reproduce with a tight, shrunk repro, trace the failing path, test 2 or 3 falsifiable hypotheses against a second piece of evidence, rate the **severity**, name the **owner** (`FE`, `BE` or `both`), write `## Cause`, `## Repro` and `## Evidence` in `fix.md`. Hand-off carries `diagnosis` with `files`, and `owner_files` per side when the owner is `both` ([schema](../schemas/handoff.schema.json)) |
| 4b | `auditor` (`opus`, a different model from the debugger) | **Audit the cause, no code.** Runs the `## Repro` once, grades `## Evidence` against the severity table below, opens the diagnosed files. Hand-off carries `audit`: `confirm`, `need-validation` or `reject`. Runs only on a `known` diagnosis. **Blocks step 4**. Skipped for `Kind: cosmetic` (below) |
| 4 | `frontend-dev` / `backend-dev` per the debugger's `owner` (FE ∥ BE if both), a fresh spawn | Fix + regression test that fails before and passes after. Cosmetic: the AC's visual check. Cold start: the prompt's `Read:` lists `fix.md` and the debugger's and auditor's hand-offs, so the dev reads only `diagnosis.files` plus tests |
| 5 | Orchestrator | Merge into `feature/<task>` with `--no-ff`, as usual |
| 6 | `code-reviewer` | Diff + `fix.md` (including Cause and Repro). Never skipped, never downgraded |
| 7 | `qa-tester` | `fix.md` AC replace `ac.md` and `design.md`. Level L0, L1 or L2 from [test-levels.md](test-levels.md); qa-tester runs exactly what that row allows (L0 build + lint, L1 the regression test + unit tests of the touched files, L2 also one boundary integration test), by path; never the whole suite ([hooks-enforcement.md](hooks-enforcement.md) §10). Cosmetic AC with no automated check, and an AC the dev says no seam can reach, are marked `manual` in `qa-report.md` and shown at the Human gate. Runs on docker local; there is no staging |
| 10 | Human gate | One question: qa-report, the diff summary, the AC marked `manual`. Approve means "accept this branch", not "deploy" |
| 11 | `docs-writer`, after the Human gate approves | The fix in the changelog or release notes (symptom, cause, what changed), the docs that described the wrong behaviour, and a **Deploy hand-off** (branch and commit, anything to run or configure). Only what the fix diff touched; self-check instead of a review. Skipped when the diff changes nothing a user sees, runs no migration, adds no config, and no doc mentions the fixed behaviour: record `docs skipped: <reason>` in `tasks/<task>.md` |
| 12 | Orchestrator | [closing.md](closing.md) steps 2-6 in full, not abbreviated: `## Usage` from `spawns.tsv`, Lessons tally (step 4 marks the checkpoint `closed`, so a resume skips it); skip step 1 unless a decision or stack learning came out of the fix |

Never skipped: 4a, 4b, 6, 7, 10. A fix with no diagnosis hand-off, or no `confirm` from the auditor (or the user's accepted risk, below), cannot start step 4.

**Cosmetic** (`Kind: cosmetic`, `--scope cosmetic`): a look that reuses existing design-system tokens has no cause whose evidence needs grading, so 4b is skipped and step 4 starts after a `known` diagnosis of severity `low`. A higher severity means it is not only the look: switch with `checkpoint.mjs profile .team/<task> fix --scope bug` and run 4b (the guard, `check-all` and the loop refuse step 4 until then). Build the plan card from the Kind you drafted for `pause:scope`; if the user changes the Kind there, show the card again. 4a still runs (on `haiku`, below): it names the files, the owner and the visual check. Never skipped for cosmetic: 4a, 6, 7, 10. Any doubt that it is only the look (a condition, a state, data) makes it a bug.

**The lane is silent.** No fix-lane agent talks to another and none is continued with `SendMessage`. The debugger, the auditor and the devs exchange only hand-off JSON: the Orchestrator validates each file in `handoff/` and puts its path in the next spawn's `Read:` line. Every round, including a re-diagnose, is a fresh spawn.

## Severity and the evidence it needs

Severity is the **impact of the bug**, not the effort to fix it. The debugger sets it; the auditor holds the evidence to it. When unsure between two tiers, take the higher one.

| Severity | Meaning | Minimum evidence |
|---|---|---|
| `low` | Cosmetic or minor, has a workaround | The cause found from the code or a log at one point |
| `medium` | Feature wrong, no data lost | A repro that is red, plus a second piece of evidence |
| `high` | Wrong data, money, permissions, or many users blocked | A repro that is red every run, plus competing hypotheses ruled out with evidence |
| `critical` | Data loss or leak, production down | As `high`, plus why it started (`git log -p` or the change that introduced it) |

The auditor's `evidence_level` is the highest tier whose minimum the diagnosis meets (`none` if not even `low`). A `confirm` needs `repro_rerun: red` and `evidence_level` at or above `severity`; `next-action.mjs` sends a `confirm` below the severity back once, then escalates `invalid-handoff`. The same table is kept in the debugger's and the auditor's `rules-and-guardrails.md`; `npm test` fails if the three drift.

## Diagnose budget and outcomes

Read the `diagnosis` object in the 4a hand-off and route on it:

| `diagnosis.status` | Action |
|---|---|
| `known` (confidence medium or high, with `cause`, `files`, `repro`, `severity`, `owner`; `owner_files` per side when `owner` is `both`) | Spawn the `auditor` (step 4b). Never go straight to step 4 |
| `unknown` | Relay `reason` to the user via `AskUserQuestion` (more info, a log, a repro). Write the answer to `.team/<task>/evidence-r<n>.md` and spawn the `debugger` fresh with that path in `Read:` for **one** more diagnose round, pointing at its previous hand-off. A second `unknown` at the same point → escalate `loop-limit` ([loops.md](loops.md)) |
| `needs-full-flow` | **Promote** to the smallest lane that fits, by `diagnosis.promote_to` (missing = `full`). Stop the lane, keep `fix.md` and the diagnosis as the input, and switch the lane with `checkpoint.mjs profile` (never by editing the line: a hand-written "promoted from the fix lane" still reads as fix and leaves the gates off):<br>`change-internal` (an internal contract or module; nothing a user sees changes beyond the fix) → `checkpoint.mjs profile .team/<task> change --scope internal`, the Orchestrator writes `ac.md` from `fix.md`, start at step 3 (architect) per [change-profile.md](change-profile.md)<br>`change-visible` (a rule, screen or flow users see must change) → ask the visible scope ([change-profile.md](change-profile.md#scope-question-pausescope-always-asked-for-a-visible-change-never-defaulted)), `checkpoint.mjs profile .team/<task> change --scope <scope>`, start at step 2 (PM)<br>`full` (a dependency, the stack, auth or a new capability) → `checkpoint.mjs profile .team/<task> feature`, start the full flow at step 2 (PM) |

### Audit outcomes (4b)

Read the `audit` object in the 4b hand-off and route on it:

| `audit.verdict` | Action |
|---|---|
| `confirm` | Spawn the dev(s) the diagnosis names (`owner`) for step 4, with the debugger's and the auditor's hand-off paths in `Read:` |
| `need-validation` | Spawn the `debugger` fresh with the auditor's hand-off path (`audit.missing` lists the evidence to add), then the `auditor` again. **One round only**; the files are the whole conversation |
| `reject` | The cause does not hold. A `need-validation` that is still unresolved after its one round counts as `reject`. The Orchestrator asks the user (`AskUserQuestion`, one question, three options): **more information** (the user's answer goes in `.team/<task>/evidence-r<n>.md`; one more `debugger` round, then the `auditor`; a second `reject` after this escalates `loop-limit`), **accept the risk** (go to step 4, record `audit 4b: risk accepted` in checkpoint `## Status` and a `## Audit` section (`cause not audited, risk accepted by the user`) in `fix.md`; the reviewer is told) or **cancel** (close per [closing.md](closing.md) with status `aborted`) |

`node .claude/skills/muffy/scripts/next-action.mjs loop <hand-offs…> --profile fix` computes this: `accept`, `revalidate:debugger`, `ask:reject-options`, `rediagnose:debugger`, `proceed:risk-accepted` or `escalate:loop-limit`. A user answer is an event `{ "answer": "more-info" | "accept-risk" | "cancel" }` in a scenario.

**Promote** also when step 4 changed more than 5 source files, or reports a blocker owned by `Architect`. Count from the diff, not from the agent's `paths_written`: `node .claude/skills/muffy/scripts/diff-signals.mjs <base> <branch> --profile fix` exits 1 with `next=promote:full-flow` and one `reason:` line per broken limit (file count, dependency, devops-owned files, auth files, schema or migration). Switch the lane with `checkpoint.mjs profile .team/<task> feature` and record the reason in checkpoint `## Status` and the vault task note.

## Diagnose only

For "find out why, don't fix it yet" ("แค่หาสาเหตุ", "หาสาเหตุให้ก่อน ยังไม่ต้องแก้", "why does X happen?" about a symptom): the fix lane with a stop point. The plan card is `plan-card fix --scope bug --until 4b` (`--until 4a` for a cosmetic look, which has no 4b).

- Setup as above, but the lane line carries the stop: `checkpoint.mjs profile .team/<task> fix --scope bug --until 4b`. No dev worktrees are cut
- 4a and 4b run as usual, with every loop and audit outcome. A `needs-full-flow` diagnosis is not promoted: `check-all` answers `close:stop-point` and its `promote_to` goes in the report as advice ("the fix belongs in …")
- When the `until` step is accepted, `check-all` and the loop answer `next=close:stop-point`, and the guard refuses a step-4 dev spawn. Close per [closing.md](closing.md#stopped-at-a-stop-point): the deliverable is `fix.md` (Symptom, Cause, Repro, Evidence) and the audit verdict
- To go on and fix it later: `checkpoint.mjs profile .team/<task> fix --scope bug` (no `--until`), then step 4

## Model and effort

Spawn the `debugger` (4a) with `model: haiku` only for a cosmetic fix, or when the symptom already names the file and line. Otherwise keep the agent default (`sonnet`, effort `high`). The `auditor` (4b) always runs on its default, `opus`, so it stays a different model from the debugger; never downgrade it, `code-reviewer` or `devops`. QA re-running existing tests only may use `haiku`, as in [token-discipline.md](token-discipline.md).

## Prompt differences

Add `Profile: fix` to the prompt envelope. `Read:` lists `.team/<task>/fix.md` instead of `ac.md`, `contract.md`, `brief.md` and `design.md`; those files do not exist in this lane. `frontend-dev`, `backend-dev` and `code-reviewer` read their `fix-profile.md` reference at start; the `debugger` and `auditor` are fix-lane-only and have no profile file. Steps 4 and 6 add the debugger's and the auditor's hand-off paths to `Read:`.
