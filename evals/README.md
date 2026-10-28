# Evals

Dev-only (not shipped by `npm run package`). Zero dependencies; Node ≥ 18.

```bash
npm test          # lint + evals
npm run eval      # evals only
npm run eval:sync # re-copy each agent's rubric from its quality-checks.md
```

## What is covered offline (`scripts/eval.mjs`, runs in CI)

| Layer | Where | What it proves |
|---|---|---|
| Rubric sync | `agents/<role>.eval.json` → `rubric` | The eval still lists exactly the bullets in `agents/references/<role>/quality-checks.md`. Edit a quality check and CI fails until you review the eval (`eval:sync`) |
| Artifact spec | `agents/<role>.eval.json` → `artifacts` | Headings/patterns derived from `output-format.md` hold on the golden fixture, and the rules reject an empty file (so they are not vacuous) |
| Hand-off schema | `fixtures/login-flow/.team/login-flow/handoff/*.json` | One valid golden hand-off per role; dropping a required field is rejected |
| Traceability | `fixtures/login-flow/.team/login-flow/` | Every AC in `ac.md` appears in design / contract / qa-report; runtime pin equal in deploy / contract / qa-report; both checks fail when mutated |
| Checkpoint format | `checkpoint.md` fixture | Required sections, ≤ 40 lines outside `## Goal`, loop counters within limit |
| Loop rules | `mock-scenarios/*.json` → `skills/muffy/scripts/next-action.mjs` | Reject→fix→approve, 4th-rejection cut-off, repeated blocker, invalid hand-off retry, QC failed twice, gates 3c/3d block step 4, run-profile skips, never-skip steps |

| Smoke triggers | `smoke-scenarios.json` → `skills/muffy/scripts/next-action.mjs`, `mock-scenarios/smoke-skipped-*.json` | 3d runs only when a trigger in `run-profile.md` is true ); a profile that skips 3d despite a trigger is rejected; the doc lists every trigger |
| Fix triage | `triage-scenarios.json` → `skills/muffy/scripts/next-action.mjs`, `scripts/lib/fix-lane-evals.mjs` | The Examples table in `fix-profile.md` and the scenarios list the same requests and lanes; boundary cases (5 vs 6 files, symptom without location); a golden `fixtures/fix-login-redirect/` (`fix.md`, 4a and 4 hand-offs) keeps the lane invariants; the `diagnosis` block rejects low confidence, missing repro, missing reason, wrong step and wrong role |
| Fix lane | `mock-scenarios/fix-*.json` (`"profile": "fix"`) → `skills/muffy/scripts/next-action.mjs` | Steps 4a and 4b cannot be skipped, step 4 is blocked without a passed 4a and a `confirm` at 4b (or the user's accepted risk), the audit verdicts route to confirm / revalidate / ask the user (more info, accept risk, cancel), a confirm below the severity is sent back, `unknown` diagnosis asks once then escalates, `needs-full-flow` or more than 5 source files promotes to the full flow |
| File ownership | `scripts/lib/ownership-evals.mjs` → `skills/muffy/scripts/ownership.mjs`, `check-ownership.mjs` on a throwaway git repo | One owner per `contract/ownership.md` row, no overlapping patterns across owners; before the step-5 merge an out-of-lane file or one changed on both fe and be fails, an unowned file is a note; a step-4 hand-off whose `contract_commit` is not the latest contract commit fails as stale-contract |
| Lite lane | `lite-triage-scenarios.json` → `triageLite` in `skills/muffy/scripts/next-action.mjs`, `scripts/lib/lite-lane-evals.mjs` | The Examples table in `lite-profile.md` and the scenarios agree; the 15-file limit is stated; review, QA, staging and the Human gate are never skipped; promote owners exist in the hand-off schema; the envelope accepts `profile: lite` |
| Lane table | `scripts/lib/lane-table-evals.mjs` → `skills/muffy/scripts/lanes.mjs` | Every lane and redesign scope round-trips through the `## Run profile` lane line and older wordings still parse; the gate and audit guards act on the lines the references prescribe; `check-all` reads gates with `gateState` and the lane and skips from the checkpoint; each lane reference names `checkpoint.mjs profile` and states the never-skip list the table holds |
| Onboarding | `baseline-scenarios.json` → `baselineAction` in `skills/muffy/scripts/next-action.mjs`, `scripts/lib/onboard-evals.mjs` | What setup does per baseline colour, depth and lane (yellow never asks, a quick baseline is enough for fix and lite only); `check-baseline.mjs --json` reports depth; every lane runs the common setup; onboard resumes the request that sent the user there; the installer scans by default |
| Routing | `route-scenarios.json` → `scripts/lib/route-sim.mjs`, `scripts/lib/route-evals.mjs` | The decision order in `route.md` gives the expected route for each scenario (stop point beats outcome, resume beats everything, bug → fix triage, internal → lite triage); the Examples table and the scenarios list the same prompts and routes (mostly Thai); every route has a minimum-intake row; the held-out set in `route-live-scenarios.json` has valid routes and never appears in `route.md` |
| Reviewer bench | `evals/review-bench/cases.mjs` → `scripts/lib/review-bench.mjs`, `scripts/lib/review-bench-evals.mjs` | Every seeded case is well formed (defect found on exactly one line, clean cases have none); the scorer tells a perfect, a demoting, a silent and a spamming reviewer apart; the parser, the line/keyword matcher, the gate and the inlined reviewer prompt behave as documented |

When you change a rule in `skills/muffy/references/loops.md`, change `skills/muffy/scripts/next-action.mjs` and the matching scenario in the same commit.

## What is NOT covered offline

Whether a real model follows the prompts. `live_scenarios` in each `*.eval.json` are the cases to run by hand (or a future LLM-graded runner): spawn the agent with `input` against the golden fixture, then grade the final message and files against `must` / `must_not`, plus the rubric. Record results in the PR; treat any `must_not` hit as a regression.

`triage-scenarios.json` and `route-scenarios.json` also have the raw `request` text of each example: paste it after `/muffy` (without `fix`) to check by hand that the Orchestrator picks the same lane.

Routing has a held-out live set, `route-live-scenarios.json`: prompts that are in no doc, with the route expected. Give a subagent `SKILL.md`, `route.md` and the triage sections of `fix-profile.md` and `lite-profile.md`, plus the prompts without `expect`, and compare its answers. Record the score in `about` and in the PR.

## Reviewer miss-rate bench (live, costs tokens)

Measures what the code-reviewer misses and over-flags, so a rule change such as "unsure -> Suggestion" is judged on numbers. The default run uses the 7 `core` cases (the tautological and skipped-test rules, a missing AC, SQL injection, a swallowed error with its clean twin, and the decoys case) twice: 14 calls. `--all` adds the rest. All 12 cases are: nine that seed one defect each (missing AC, SQL injection, swallowed error, tautological test, skipped test, scope creep, N+1, missing auth); three clean cases (one with decoys that look like findings) must be approved. Each case is a new-file diff plus its AC and contract; no code comment hints at the defect.

```bash
node scripts/review-bench.mjs list
node scripts/review-bench.mjs run --out .bench/r1 --yes             # core cases x 2 runs = 14 calls; without --yes it only prints the plan
node scripts/review-bench.mjs run --out .bench/all --all --runs 3 --yes   # every case x 3 runs = 36 calls
node scripts/review-bench.mjs score .bench/r1 [--json] [--gate]
```

`run` inlines the agent file and its references as the system prompt and calls `claude -p` with read-only tools (set `CLAUDE_BIN` to override the executable). Metrics from `score`:

| Metric | Meaning |
|---|---|
| miss rate | a seeded defect not filed as a Blocker (hard miss + demoted) |
| hard miss | not mentioned at all |
| demotion rate | filed only as a Suggestion: the price of the "unsure -> Suggestion" rule |
| false reject rate | a clean case rejected or given any Blocker |
| false blockers / clean run | Blockers on a clean case (the loop-budget cost) |
| verdict accuracy | Approve / Reject as expected |

A defect counts as found when a finding cites its file and a line within 3 lines of it, or names its keywords with the file. Extra Blockers on a defect case are reported but not counted as false, since a case can hold a real second issue. `evals/review-bench/baseline.json` holds the gate limits (null = not gated): set them from the first recorded run, record the run in the PR, and rerun after any change to the reviewer's principles, rules or output format. Use several runs: one run of a case is a sample, not a rate.

## Adding a scenario

1. Copy a file in `mock-scenarios/`, set `defaults` (fields shared by every hand-off) and `events` (one per agent response; `handoff` fields override defaults; omit `handoff` to simulate a missing block)
2. Set `expect.outcome` (`completed | escalated | blocked | invalid-profile`), `expect.actions` (`accept`, `fix:<owners>`, `retry:*`, `escalate:<trigger>`, `block:*`) and optionally `trigger` / `loops`
3. `npm run eval`
