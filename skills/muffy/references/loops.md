# Loops

- **Review reject** → owners fix → re-merge → reviewer checks only the new diff → until Approve
- **QA fail** → owner fixes → reviewer checks the fix diff → QA re-tests the blocker ACs and the fixes (scoped). A whole-system regression runs only after `pause:full-regression` ([run-profile.md](run-profile.md#named-pauses))
- **Smoke fail (3d)** → architect changes stack + ADR → smoke again; FE/BE wait
- **Staging fail** → logs to the relevant dev → back to step 6
- **UX/UI review finds `high` issues (3c, before the user is asked)** → findings to `designer` → republish → review again. Counts at loop point `3c:designer`, like a user's change request
- **Design review: changes requested (3c)** → reasons to `designer` (+ `architect` if the contract is affected) → republish canvas → Definition of done again → ask the user again. FE/BE stay blocked
- **Plan review: changes requested (2b)** → reasons to `product-manager` → revised `ac.md` + plan → ask the user again. Step 3 stays blocked. Counts at loop point `2b:product-manager`
- **Human reject** → reasons to the relevant agents → redo review + QA
- **Production health fail** → devops rolls back; report to the user before anything else
- **Diagnose unknown (4a, fix lane)** → ask the user for more evidence → one more diagnose round with a fresh `debugger` spawn (the fix lane is silent: no `SendMessage`); a second `unknown` escalates `loop-limit`. A `needs-full-flow` diagnosis is not a loop: promote to the full flow ([fix-profile.md](fix-profile.md))
- **Audit need-validation (4b, fix lane)** → the auditor's `audit.missing` goes to a fresh `debugger` spawn through the hand-off file → the `auditor` checks again. One round; an unresolved second `need-validation` counts as `reject` → the user chooses more information / accept the risk / cancel. A `reject` after the user gave more information escalates `loop-limit`. Counts at loop point `4b:auditor`
- More than 3 loops at one point → stop and ask the user (see Fallback ladder)

## Loop budget

- A **loop point** is `<step>:<owner>`, e.g. `6:code-reviewer`, `7:qa-tester`, `3d:devops`. Count rejections per point in `.team/<task>/checkpoint.md` → `## Loop counters`
- 3 fix loops are allowed per point; the **4th rejection stops the flow**. Nothing raises the limit except the user's answer to an escalation
- **Only the work product's failures count.** A reject or fail counts toward the 3 only when the code, contract, design or docs are wrong. These do not count: an environment failure (`docker` absent, Node version mismatch, a rate limit, a missing credential), a tool that did not run, and an interrupted run being resumed. Record them as one `env:` line in `## Open blockers` (owner `Devops` or the user), fix or wait, then re-run the step at the same round number. After an interruption run `git status --short` in the worktree before redoing anything, so finished work is not repeated
- A reviewer's `needs_validation` items (`V-1`…) are open questions, not blockers: they never make a Reject and never count toward the 3. Pass each one to its owner in the next prompt (or list it at the next human gate if the review is Approve). A `V-` id still open in 3 consecutive reviews escalates `repeated-blocker`, so a problem cannot dodge the check by switching between blocker and question
- Blockers keep a stable id (`B-1`, `B-2`…) across rounds. A fix round that closes a blocker drops it; one that doesn't re-lists it under the **same id**. Without stable ids the repeat check below cannot work

## Fallback ladder

**Compute it, don't count by hand**: `node .claude/skills/muffy/scripts/next-action.mjs loop <hand-off files in the order they came back> [--profile fix|lite] [--skip <steps>] --task <task> [--escalation-out .team/<task>/escalation-<n>.json]` applies this file (loop budget, repeated `B-`/`V-` ids, gates 3c/3d, fix-lane promotion) and prints `next=<action>` plus the counters to copy into `## Loop counters`. On `escalate:*` it drafts the escalation file: add the recommendation, then validate.

Apply in order. Each rung applies to one loop point; the validator is `node .claude/skills/muffy/scripts/validate-handoff.mjs <file>`.

1. **Invalid or missing hand-off block** (validator fails, or no JSON block) → `SendMessage` the same agent with the validator's error lines, once. Invalid again → escalate `invalid-handoff`. *Fix lane (silent):* never `SendMessage`; spawn the same role fresh once, with the validator's error lines and the path of its invalid hand-off in the prompt
2. **Agent reports `quality_checks.passed: false`** → `SendMessage` the failed items back, once. Fails again → escalate `quality-check-failed-twice`. *Fix lane (silent):* a fresh spawn of the role with the failed items and its hand-off path instead. The same applies to `retry:audit-below-severity` (a `confirm` whose `evidence_level` is below the severity): a fresh `auditor` spawn that is told the claimed severity and its own previous hand-off path
3. **Same blocker id open in 3 consecutive rejects** (the owner has already failed two fix attempts at it) → escalate `repeated-blocker` right away instead of spending the 4th-rejection budget. One failed fix is normal and not an escalation. Default recommendation: `change-approach` (often the contract or AC is wrong → architect/PM decides)
4. **Fourth rejection at a point** → escalate `loop-limit`
5. **Agent unreachable** (`SendMessage` fails, agent gone; in the fix lane a spawn that returned no result) → spawn once fresh with `Checkpoint:` + the path of its last hand-off. Fails again → escalate `agent-unavailable`
6. **Human gate rejected** (step 10, `pause:plan-review` or `pause:design-review`) twice for the same reason → escalate `human-reject-limit`

A reject that is not repeated and is under the limit is handled by the loop bullets above, not by this ladder.

## Escalation

1. Write `.team/<task>/escalation-<n>.json` ([schema](../schemas/escalation.schema.json)): trigger, loops used, owner, open blockers with rounds open, one line per attempt, a recommendation, 2–4 options
2. Validate it: `node .claude/skills/muffy/scripts/validate-handoff.mjs <file> escalation`
3. Ask the user with `AskUserQuestion` (≤10 lines of context, recommended option first). Options, as relevant:
   - `extend-loops` — +2 loops at this point, asked again if it runs out
   - `change-approach` — send the root cause to the right owner (architect/PM/designer), then restart the point's counter
   - `reduce-scope` — move the failing AC to the backlog in `docs/plan/<task>.md`, update `ac.md`, re-run traceability
   - `fix-manually` — pause; the user edits, then resume at the same step
   - `abort-task` — close per [closing.md](closing.md) with status `aborted`; lessons still get promoted
4. Record the answer in `checkpoint.md` and `<brain>/tasks/<task>.md` → `## Lessons`. Never continue silently, never merge or deploy past an unresolved escalation

## Context checkpoints in loops

Long loops lose the original goal. After every fix round and at steps 3d, 6 (on Approve) and 9, rewrite `.team/<task>/checkpoint.md` per [memory-model.md](memory-model.md#checkpoint). From round 2 on, every prompt carries `Checkpoint: <path>` and the owner reads only its `## Goal` and `## Open blockers` sections. Keep only the latest round's blockers in full; older rounds shrink to one `## History` line each.

Record a fix round with one command, not by hand: `node .claude/skills/muffy/scripts/checkpoint.mjs round .team/<task> --step <step> --round <n> --handoff <hand-off file> --summary "<one line>" [--notes "a|b"]`. It writes `rounds/<step>-r<n>.md` once and updates the checkpoint's `Updated:` line, `## Loop counters` (only a Reject/Fail counts), `## Open blockers` (rounds open carried by id), the `## History` line and its `[label]`. Then it runs `check-checkpoint.mjs`. Edit `## Status` and `## Decisions in force` yourself; the script leaves them alone.
