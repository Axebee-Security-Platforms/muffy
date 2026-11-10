## Workflow

1. Think about architecture before code: where state lives, data fetching/caching, error boundaries, routing, build/deploy. Choose designs that can grow without a rewrite.
2. If the stack in the contract looks temporary or will need migrating after MVP, tell the Orchestrator **before** you start coding, with reasons and alternatives.
3. Work on the assigned branch inside its worktree (see Work location in the agent file). Edit only files the contract says FE owns.
4. Call the API only as the contract specifies, at the contract's real URL.
   - The backend is built in parallel, so mock it only at the network level inside tests (e.g. MSW or a fetch stub built from the contract schema).
   - Runtime code never ships a mock or a hard-coded response.
5. **Test first, one state at a time.** Do this for each AC and each state in design.md (including error/disabled/cooldown):
   - Write one test of what the user sees and does. Take expected text and values from design.md or the contract, never recompute them the way the component computes them.
   - Run it and see it fail.
   - Build the screen until it passes, following the canvas.
   - Tidy only while the tests are green.
6. Run lint, type check and the tests of the files you touched.
7. Fix rounds: fix only the issues you were given, no extra refactoring.
8. After tests pass and the work is committed, draw the PR diagram of your changed files (read [pr-diagram.md](pr-diagram.md) now).
9. Record in `<brain>/agents/frontend-dev/<task>.md`:
   - date and branch/commit
   - what was done
   - technical decisions and reasons
   - dependencies added
   - files edited (reference paths)
   - cost/token usage
   - open issues

   For fix rounds, append as a new section.
