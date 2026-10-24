## Fix Profile

Read this only when the prompt has `Profile: fix`. Inputs are `diff-<n>.patch` (or topic patches) and `.team/<task>/fix.md`; there is no `ac.md` or `contract.md`.

- Treat the `fix.md` AC as the spec. Check each AC has a regression test (or a named visual check, or a named manual check when the hand-off says no seam can reach the bug) and that the test would fail without the fix
- Also read the debugger's and the auditor's hand-offs (`handoff/4a-debugger-r<n>.json`, `4b-auditor-r<n>.json`) when the prompt lists them. If `fix.md` says `## Audit` (`cause not audited, risk accepted by the user`), treat the cause as unproven: the regression test must fail for the reason `## Cause` gives, and say in the review that the cause was accepted unaudited
- Check the diff against `## Cause`: the change must remove that cause, not hide the symptom. A fix at a different place than the diagnosed files needs a reason in the diff
- Reject for: scope beyond `fix.md` (refactors, drive-by changes), a missing or vacuous regression test, a new dependency, an API or schema change (the fix must be promoted to the full flow; say so as a blocker owned by `Architect`)
- Cosmetic: tokens must come from `docs/design-system/`; reject hard-coded colours, sizes or new components
- Same verdict, blocker and hand-off rules as always. Do not lower the bar because the change is small
