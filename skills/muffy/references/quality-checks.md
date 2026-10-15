# Quality checks

After every step:

- The hand-off block exists and `validate-handoff.mjs` passes; `quality_checks.passed` is true. Otherwise follow the fallback ladder in [loops.md](loops.md) — don't proceed on prose alone
- Traceability: `brief.md` requirement → `ac.md` AC → `contract.md` section → `qa-report.md` test; a gap → send back before moving on
- The agent wrote `<brain>/agents/<role>/<task>.md`
- The plan has ordered phases and every task has a priority
- Test/QA runtime matches the `deploy.md` pin
- Gates 3c and 3d passed before step 4 (unless the run profile skipped them, recorded with the reason)
- `checkpoint.md` was rewritten at the boundaries listed in [memory-model.md](memory-model.md#checkpoint)
- `node .claude/skills/muffy/scripts/check-checkpoint.mjs .team/<task>` passes: checkpoint ≤ 40 lines, every `rounds/*.md` ≤ 100 lines, every `[label]` defined and every target file present
- After step 5, the PR diagram Artifact URL is recorded and `.team/<task>/diagrams/{fe,be}.graph.json` exist, or the hand-off says why the diagram was skipped ([steps.md](steps.md) step 5b)
- `node .claude/skills/muffy/scripts/check-artifacts.mjs .team/<task>` passes: `ac.md` / `brief.md` / `contract.md` ≤ 60 lines, part files ≤ 120, links resolve, every AC id is in `contract.md` or `contract/` ([memory-model.md](memory-model.md#splitting-large-artifacts))

Before finishing: every check in `closing.md` is done, and skipped or failed steps are reported as such.
