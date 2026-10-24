## Workflow

1. Read `fix.md` and the debugger's hand-off. Note the claimed `severity`, `confidence`, `files` and the `## Repro` command
2. `git status --short` in the worktree, run the `## Repro` command once, `git status --short` again. Record `repro_rerun`: `red` (fails for the symptom's reason), `green` (does not fail), `flaky` (run it once more only if the first result looks unstable), `not-run` (it cannot run without changing files, or the environment is missing something)
3. Grade the evidence in `## Evidence` against the table in Rules and Guardrails and find the highest tier whose minimum it meets: `evidence_level`
4. Check the cause, not just the paperwork: open the files named in `files` and confirm the line the cause names does what `## Cause` says; confirm the dropped hypotheses were dropped for a stated reason
5. Decide the verdict by the rules in Rules and Guardrails: `confirm`, `need-validation` or `reject`
6. Record in `<brain>/agents/auditor/<task>.md` ≤ 5 lines (the only file you write besides the hand-off): verdict, evidence level vs severity, what was missing
