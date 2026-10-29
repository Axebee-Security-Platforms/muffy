# Quality checks

After every step, two halves.

## 1. Run the script (one call)

```
node .claude/skills/muffy/scripts/check-all.mjs .team/<task> --step <s> --round <n> [--profile fix|change|verify|upgrade] [--skip <steps>] --brain <brain> [--base <feature or ops branch> --head <step branch>]
```

It prints `next=<action>` and one `ok`/`FAIL` line per check. Act on `next=` and do not re-check by hand what it covers:

- **handoff**: every hand-off of this step and round validates and has `quality_checks.passed` true (code-reviewer: save its block first)
- **loop**: the [loops.md](loops.md) rules over all the task's hand-offs, with gates 3c/3d read from checkpoint `## Status` (`Gates 3c and 3d passed`). `next=fix:<owner>`, `retry:*`, `ask:*`, `escalate:*` or `block:*` → follow [loops.md](loops.md)
- **checkpoint**: `check-checkpoint.mjs`. Checkpoint ≤ 40 lines outside `## Goal`, `rounds/*.md` ≤ 100, labels defined, `spawns.tsv` well formed
- **artifacts**: `check-artifacts.mjs`. Sizes, links, and traceability `brief.md` → `ac.md` → `contract.md` → `qa-report.md` (an internal change starts at `ac.md`; fix lane: `fix.md` → `qa-report.md`) ([memory-model.md](memory-model.md#splitting-large-artifacts))
- **brain**: each role of the step wrote `<brain>/agents/<role>/<task>.md`
- **runtime**: the `Runtime:` in `qa-report.md` matches the `deploy.md` pin
- **fix lane** (from step 4): the 4a diagnosis is `known` (with `severity` and `owner`) and the 4b audit is `confirm` (or `audit 4b: risk accepted` is in checkpoint `## Status`); `fix.md` has `## Cause` and `## Repro` ([fix-profile.md](fix-profile.md))
- **diff** (with `--base`): a skipped 3d while a smoke trigger is true, and from step 4 a change that outgrew its lane (`next=promote:full-flow`) ([diff-signals.mjs](../scripts/diff-signals.mjs))

`next=proceed` and exit 0 means every scripted check passed. `next=send-back:<checks>` → send the `FAIL` lines to the owner before moving on.

## 2. Judge these yourself

- The plan has ordered phases and every task has a priority
- Gate 2b was answered by the user at `pause:plan-review` before step 3, and 3c at `pause:design-review` before step 4, with the UX/UI review run or recorded as skipped (unless the run profile skipped the step, recorded with the reason). Record each answer with `checkpoint.mjs gate <dir> 2b|3c approve --by "<reply>"` only after that (it refuses without the pause and a ready summary); `check-all` reads the line, and `guard-gates.mjs` reads it before every spawn
- Step 3e, when a diagram file was written or changed: `check-diagram.mjs` and `check-diagram-render.mjs` passed (a render SKIP is recorded as `render: not checked`), and it is published and listed in `<brain>/tasks/<task>.md` → `## Diagrams` (and `project.md`), or the note says why not ([diagram-publish.md](diagram-publish.md))
- Step 5b, only when the user asked for PR diagrams: the Artifact URL is recorded and `.team/<task>/diagrams/{fe,be}.graph.json` exist, or the hand-off says why the diagram was skipped ([steps.md](steps.md))
- `checkpoint.md` was rewritten at the boundaries in [memory-model.md](memory-model.md#checkpoint) (`checkpoint.mjs round` does the fix-round part)
- Fix lane: the regression test fails before the fix and passes after, or the AC is marked `manual` in `qa-report.md`

Before finishing: every check in `closing.md` is done, and skipped or failed steps are reported as such.
