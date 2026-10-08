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
| Checkpoint format | `checkpoint.md` fixture | Required sections, ≤ 40 lines, loop counters within limit |
| Loop rules | `mock-scenarios/*.json` → `scripts/lib/loop-sim.mjs` | Reject→fix→approve, 4th-rejection cut-off, repeated blocker, invalid hand-off retry, QC failed twice, gates 3c/3d block step 4, run-profile skips, never-skip steps |

When you change a rule in `skills/muffy/references/loops.md`, change `scripts/lib/loop-sim.mjs` and the matching scenario in the same commit.

## What is NOT covered offline

Whether a real model follows the prompts. `live_scenarios` in each `*.eval.json` are the cases to run by hand (or a future LLM-graded runner): spawn the agent with `input` against the golden fixture, then grade the final message and files against `must` / `must_not`, plus the rubric. Record results in the PR; treat any `must_not` hit as a regression.

## Adding a scenario

1. Copy a file in `mock-scenarios/`, set `defaults` (fields shared by every hand-off) and `events` (one per agent response; `handoff` fields override defaults; omit `handoff` to simulate a missing block)
2. Set `expect.outcome` (`completed | escalated | blocked | invalid-profile`), `expect.actions` (`accept`, `fix:<owners>`, `retry:*`, `escalate:<trigger>`, `block:*`) and optionally `trigger` / `loops`
3. `npm run eval`
