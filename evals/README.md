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
| Loop rules | `mock-scenarios/*.json` → `scripts/lib/loop-sim.mjs` | Reject→fix→approve, 4th-rejection cut-off, repeated blocker, invalid hand-off retry, QC failed twice, gates 3c/3d block step 4, run-profile skips, never-skip steps |

| Smoke triggers | `smoke-scenarios.json` → `scripts/lib/smoke-sim.mjs`, `mock-scenarios/smoke-skipped-*.json` | 3d runs only when a trigger in `run-profile.md` is true (incl. `staging: none`); a profile that skips 3d despite a trigger is rejected; the doc lists every trigger |
| Fix triage | `triage-scenarios.json` → `scripts/lib/triage-sim.mjs`, `scripts/lib/fix-lane-evals.mjs` | The Examples table in `fix-profile.md` and the scenarios list the same requests and lanes; boundary cases (5 vs 6 files, symptom without location); a golden `fixtures/fix-login-redirect/` (`fix.md`, 4a and 4 hand-offs) keeps the lane invariants; the `diagnosis` block rejects low confidence, missing repro, missing reason, wrong step and wrong role |
| Fix lane | `mock-scenarios/fix-*.json` (`"profile": "fix"`) → `scripts/lib/loop-sim.mjs` | Step 4a cannot be skipped, step 4 is blocked without a passed 4a, `unknown` diagnosis asks once then escalates, `needs-full-flow` or more than 5 source files promotes to the full flow |
| File ownership | `scripts/lib/ownership-evals.mjs` → `skills/muffy/scripts/ownership.mjs`, `check-ownership.mjs` on a throwaway git repo | One owner per `contract/ownership.md` row, no overlapping patterns across owners; before the step-5 merge an out-of-lane file or one changed on both fe and be fails, an unowned file is a note; a step-4 hand-off whose `contract_commit` is not the latest contract commit fails as stale-contract |
| Lite lane | `lite-triage-scenarios.json` → `triageLite` in `scripts/lib/triage-sim.mjs`, `scripts/lib/lite-lane-evals.mjs` | The Examples table in `lite-profile.md` and the scenarios agree; the 15-file limit is stated; review, QA, staging and the Human gate are never skipped; promote owners exist in the hand-off schema; the envelope accepts `profile: lite` |
| Routing | `route-scenarios.json` → `scripts/lib/route-sim.mjs`, `scripts/lib/route-evals.mjs` | The decision order in `route.md` gives the expected route for each scenario (stop point beats outcome, resume beats everything, bug → fix triage, internal → lite triage); the Examples table and the scenarios list the same prompts and routes (mostly Thai); every route has a minimum-intake row; the held-out set in `route-live-scenarios.json` has valid routes and never appears in `route.md` |

When you change a rule in `skills/muffy/references/loops.md`, change `scripts/lib/loop-sim.mjs` and the matching scenario in the same commit.

## What is NOT covered offline

Whether a real model follows the prompts. `live_scenarios` in each `*.eval.json` are the cases to run by hand (or a future LLM-graded runner): spawn the agent with `input` against the golden fixture, then grade the final message and files against `must` / `must_not`, plus the rubric. Record results in the PR; treat any `must_not` hit as a regression.

`triage-scenarios.json` and `route-scenarios.json` also have the raw `request` text of each example: paste it after `/muffy` (without `fix`) to check by hand that the Orchestrator picks the same lane.

Routing has a held-out live set, `route-live-scenarios.json`: prompts that are in no doc, with the route expected. Give a subagent `SKILL.md`, `route.md` and the triage sections of `fix-profile.md` and `lite-profile.md`, plus the prompts without `expect`, and compare its answers. Record the score in `about` and in the PR.

## Adding a scenario

1. Copy a file in `mock-scenarios/`, set `defaults` (fields shared by every hand-off) and `events` (one per agent response; `handoff` fields override defaults; omit `handoff` to simulate a missing block)
2. Set `expect.outcome` (`completed | escalated | blocked | invalid-profile`), `expect.actions` (`accept`, `fix:<owners>`, `retry:*`, `escalate:<trigger>`, `block:*`) and optionally `trigger` / `loops`
3. `npm run eval`
