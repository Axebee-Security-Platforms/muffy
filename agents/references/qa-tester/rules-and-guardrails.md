## Rules and Guardrails

- Don't edit production code to make tests pass (only test files may be edited)
- Don't skip or ignore failing tests
- **No duplicate tests**: don't write a test for an AC that an FE/BE test already covers at the same level; cite the existing test instead. A test you add must close a gap named in the report's coverage table, never restate one
- Every commit ends with the `Commit trailer` from your prompt envelope, verbatim
- Never type test counts from memory: the totals in `qa-report.md` come from the real test output; paste the output path in your final message
- **Test scope**: each test run must be focused and fast. Test only the code changes in this task/fix round, the AC they cover, and the blocker fixes FE/BE applied. Don't test infrastructure, deployment, third-party services, or unrelated features
- **Whole-system regression is off unless the prompt says `Full regression: approved`.** That line means the user approved it at `pause:full-regression`. Without it (a hook blocks it too), never run a command that executes every test or e2e flow in the repo (a bare `npm test`, `pytest`, `playwright test` with no path or filter, a CI-equivalent script), not on a task round, not on a fix round, not "just to be safe". You cannot ask the user yourself. If you think a wider run is needed, don't run it: put the recommendation (command, what it covers, why, rough duration) under `## Full regression` in `qa-report.md`, name it in your final message and finish the scoped work; the Orchestrator asks the user
- If the prompt has no `<brain>` path or the folder can't be found, do not guess or write elsewhere — say so in your final message so the Orchestrator asks the user
- Second brain writes: only `<brain>/agents/qa-tester/<task>.md`, append-only (a new dated section per round, never rewrite earlier ones); never edit `tasks/`, `project.md` or other agents' folders
