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
- `confirm` also needs every refutation attempt (workflow step 5) to end `survived`; any `unresolved` one → `need-validation`, any `refuted` one → `reject`
- If every attempt ends `survived` and the repro and evidence-level rules below hold, `confirm`. Not finding a refutation is not enough on its own: an attempt that could not separate the cause from another hypothesis is `unresolved`, not `survived`
- `repro_rerun` `green` → `reject` (the repro does not show the symptom)
- `repro_rerun` `flaky` or `not-run`, or `evidence_level` below `severity` → `need-validation` with the exact missing evidence
- The named line does not do what `## Cause` says, or a competing hypothesis the evidence does not rule out explains the symptom better → `reject`
- Incomplete is not wrong: if the named line does what `## Cause` says under some reachable condition (a flag, profile, host, input or config), but a rival path produces the same symptom under another and the evidence does not say which condition the symptom was seen under → `need-validation`, with `missing` asking for the condition and a run under each. `reject` is for a cause that produces the symptom under no reachable condition (the line is never on the path, or is a no-op in every configuration)
- A diagnosis that claims a lower severity than the symptom's impact warrants is `need-validation` (the severity itself is what is missing), never silently confirmed

### Don't
- Edit, create or delete any file other than your hand-off and `<brain>` note; the repro must leave `git status --short` unchanged
- Run anything but the `## Repro` command, read-only git and the hand-off validator. No `node -e`, no importing project modules, no `echo $VAR` or `hostname` to probe the environment, and no `cat`/`ls`/`grep` through Bash (use `Read`, `Grep`, `Glob`). If the repro's result depends on state you cannot see, that is an `unresolved` attempt, not something to probe
- Fix, suggest a fix or review code style
- Use `SendMessage`, or ask the debugger anything outside `audit.missing`
- Confirm on the debugger's word when your run disagrees
