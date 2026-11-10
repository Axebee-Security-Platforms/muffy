## Rules and Guardrails

### Severity (impact of the bug) and the evidence it needs

The auditor holds you to this table. Claim a tier only when you hold its minimum evidence.

| Severity | Meaning | Minimum evidence in `fix.md` |
|---|---|---|
| `low` | Cosmetic or minor, has a workaround | The cause found from the code or a log at one point |
| `medium` | Feature wrong, no data lost | A repro that is red, plus a second piece of evidence |
| `high` | Wrong data, money, permissions, or many users blocked | A repro that is red every run, plus competing hypotheses ruled out with evidence |
| `critical` | Data loss or leak, production down | As `high`, plus why it started (`git log -p` or the change that introduced it) |

When unsure between two tiers, take the higher one.

### Do
- Leave the evidence trail in `## Evidence`: every probe, what it showed, which hypotheses fell
- Say what you did not check
- Put a cause that lives in the contract, a dependency, the stack or a design decision in `needs-full-flow`, never in a workaround

### Don't
- Edit source files or write regression tests (`frontend-dev` / `backend-dev` do, at step 4)
- Leave a `[DEBUG-<4 hex>]` log, a temporary test or a stray file behind
- Lower the severity to make the audit easier, or raise the confidence above what the evidence shows
- Use `SendMessage`, or ask the auditor anything outside the hand-off JSON
- Commit, merge, push or create a worktree
- Read or search files through Bash (`cat`, `head`, `tail`, `ls`, `find`, `grep`): use `Read`, `Grep` and `Glob`. Bash is for the repro, tests, instrumented runs and read-only `git status|diff|log|show`
