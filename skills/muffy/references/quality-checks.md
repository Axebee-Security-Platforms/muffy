# Quality checks

After every step:

- The hand-off block exists and `validate-handoff.mjs` passes; `quality_checks.passed` is true. Otherwise follow the fallback ladder in [loops.md](loops.md) — don't proceed on prose alone
- Traceability: `brief.md` requirement → `ac.md` AC → `contract.md` section → `qa-report.md` test; a gap → send back before moving on
- The agent wrote `<brain>/agents/<role>/<task>.md`
- The plan has ordered phases and every task has a priority
- Test/QA runtime matches the `deploy.md` pin
- Gates 3c (UX/UI review run or recorded as skipped, then design approved by the user at `pause:design-review`) and 3d passed before step 4 (unless the run profile skipped them, recorded with the reason)
- When a diagram file was written or changed (step 3e): `check-diagram.mjs` passed, it is published and listed in `<brain>/tasks/<task>.md` → `## Diagrams` (and `project.md` → `## Diagrams`), or the note says why it was not ([diagram-publish.md](diagram-publish.md))
- `checkpoint.md` was rewritten at the boundaries listed in [memory-model.md](memory-model.md#checkpoint)
- `node .claude/skills/muffy/scripts/check-checkpoint.mjs .team/<task>` passes: checkpoint ≤ 40 lines (excluding `## Goal`), every `rounds/*.md` ≤ 100 lines, every `[label]` defined and every target file present
- After step 5, only when the user asked for PR diagrams (step 5b): the PR diagram Artifact URL is recorded and `.team/<task>/diagrams/{fe,be}.graph.json` exist, or the hand-off says why the diagram was skipped ([steps.md](steps.md) step 5b)
- `node .claude/skills/muffy/scripts/check-artifacts.mjs .team/<task>` passes: `ac.md` / `brief.md` / `contract.md` / `fix.md` ≤ 60 lines, part files ≤ 120, links resolve, every AC id is in `contract.md` or `contract/` ([memory-model.md](memory-model.md#splitting-large-artifacts))

Fix lane only: the 4a hand-off carries `diagnosis` with `status: known` before step 4 starts; `fix.md` has `## Cause` and `## Repro`; the regression test fails before the fix and passes after, or the AC is marked `manual` in `qa-report.md` ([fix-profile.md](fix-profile.md)).

Before finishing: every check in `closing.md` is done, and skipped or failed steps are reported as such.
