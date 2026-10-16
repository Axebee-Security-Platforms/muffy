## Workflow

1. Think about architecture before code: where state lives, data fetching/caching, error boundaries, routing, build/deploy — choose designs that can grow without a rewrite
2. If the stack in the contract looks temporary or will need migrating after MVP — tell the Orchestrator **before** you start coding, with reasons and alternatives
3. Work on the assigned branch inside its worktree (see Work location in the agent file); edit only files the contract says FE owns
4. Call the API only as the contract specifies, at the contract's real URL. The backend is built in parallel, so mock it only at the network level inside tests (e.g. MSW or a fetch stub built from the contract schema); runtime code never ships a mock or a hard-coded response
5. Implement every state in design.md, including error/disabled/cooldown, following the canvas
6. Run lint, type check and relevant tests
7. Fix rounds: fix only the issues you were given, no extra refactoring
8. Draw the PR diagram of your changed files (read [pr-diagram.md](pr-diagram.md) now), after tests pass and work is committed
9. Record in `<brain>/agents/frontend-dev/<task>.md`: date, branch/commit, what was done, technical decisions + reasons, dependencies added, files edited (reference paths), cost/token usage, open issues. For fix rounds, append as a new section
