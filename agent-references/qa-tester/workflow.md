## Workflow

0. **Unfamiliar stack.** If the test runner or commands for this stack are not obvious from the repo, read `docs/stacks/<framework>.md` for the `Test (scoped):` and `Whole-suite:` commands. Run `check-stack-notes.mjs <framework>` first; the ladder is in [stack-ladder.md](../shared/stack-ladder.md).
   - No note and no way to tell → `status: blocked`, blocker `owner: Researcher`, problem `stack-unknown: <framework> <version>`.
   - Never guess a runner or run an unknown whole-suite command.
1. **Coverage first, then write.** Before writing anything:
   - List the test files the FE/BE diff added or changed (names only, from `diff*.patch` or `git diff --name-only <base>`).
   - Map each AC to the existing tests that assert it (`AC id → existing test name`).

   An AC counts as **covered** only if a test asserts its observable behavior, success and error paths. Read the assertions: a test that only renders or only checks the status code does not cover a behavior AC.
   - Covered ACs: write no new test. Run the existing one and cite it in the report.
   - Write new tests only for the gaps:
     - an AC with no covering test
     - a state in design.md (cooldown, lockout, expired) that no test reaches
     - an FE↔BE integration/e2e path that neither side's unit tests cross
   - Never duplicate an FE/BE test at the same level.
2. Every AC ends with at least 1 test: either `existing` (FE/BE's, with its path) or `new` (yours).
3. Run the test types the `Test level:` row allows (L3: unit + integration + e2e) for this task's AC and the files the diff touches. Select by path, name or filter.
   - Use browser automation if there is a web UI.
   - For mobile, desktop and CLI, use the platform's runner from [platform-runners.md](platform-runners.md). Report an AC as `not-run: toolchain-missing` when the host lacks the simulator, emulator or SDK, never as passed.
   - Existing covered tests are run, not rewritten.
   - Never widen this to the whole repo suite without `Full regression: approved` in the prompt.
4. Write up every bug with: reproduction steps, expected vs actual result, AC id, likely owner (FE/BE).
5. **Blocker vs non-blocker.** Separate bugs into:
   - blockers: break an AC entirely or prevent shipping
   - non-blockers: nice-to-have polish, minor UX

   Report **blockers only** to the Orchestrator; FE/BE must fix these before this agent's work is done. Non-blockers go in open issues for the backlog.
6. **Fix rounds** (FE/BE fixed the blockers): test only the AC items that had blockers, plus the fixes that were applied. Do not run the full test suite in fix rounds.
7. Record in `<brain>/agents/qa-tester/<task>.md`:
   - date and what was done
   - pass/fail results, blockers (must fix) and non-blockers (backlog)
   - decisions and reasons
   - files created/edited (reference paths, don't copy content)
   - cost/token usage
   - open issues

   For fix rounds, append as a new section detailing which blockers were retested and their new status.
