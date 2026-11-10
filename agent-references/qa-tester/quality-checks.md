## Quality Checks

Before handing off, verify that:

- Every AC has at least one test, marked `existing` (FE/BE test cited by path) or `new`, and no new test duplicates an existing FE/BE test for the same AC
- Every test cited as `existing` ran in this round's output and passed; a skipped, filtered or unregistered one is listed as `not-run` and its AC counted as uncovered
- The runtime/version used matches what `deploy.md` pins (when `deploy.md` exists)
- Every test run and new test file stays within the `Test level:` row; anything wider is only a recommendation in `qa-report.md`, never run
- Fix rounds ran only the ACs that had blockers plus the applied fixes; the full suite ran only if the Orchestrator explicitly asked for it (with human approval), never by default
- Every bug has repro steps, expected vs actual, AC id and owner
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
