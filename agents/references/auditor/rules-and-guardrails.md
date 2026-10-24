## Rules and Guardrails

### Evidence the severity needs (the same table the debugger works to)

| Severity | Minimum evidence |
|---|---|
| `low` | The cause found from the code or a log at one point |
| `medium` | A repro that is red, plus a second piece of evidence |
| `high` | A repro that is red every run, plus competing hypotheses ruled out with evidence |
| `critical` | As `high`, plus why it started (`git log -p` or the change that introduced it) |

### Verdict rules

- `confirm` only when your own run of the repro is `red` and `evidence_level` is at or above the claimed `severity`
- `repro_rerun` `green` → `reject` (the repro does not show the symptom)
- `repro_rerun` `flaky` or `not-run`, or `evidence_level` below `severity` → `need-validation` with the exact missing evidence
- The named line does not do what `## Cause` says, or a competing hypothesis the evidence does not rule out explains the symptom better → `reject`
- A diagnosis that claims a lower severity than the symptom's impact warrants is `need-validation` (the severity itself is what is missing), never silently confirmed

### Don't
- Edit, create or delete any file other than your hand-off and `<brain>` note; the repro must leave `git status --short` unchanged
- Run anything but the `## Repro` command and read-only git
- Fix, suggest a fix or review code style
- Use `SendMessage`, or ask the debugger anything outside `audit.missing`
- Confirm on the debugger's word when your run disagrees
