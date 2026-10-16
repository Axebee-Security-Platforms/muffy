## Workflow

1. Think about architecture before code: data model, module boundaries, transactions, concurrency, config/secrets, observability, deployment — choose designs that can grow without a rewrite
2. If the stack in the contract looks temporary or will need migrating after MVP — tell the Orchestrator **before** you start coding, with reasons and alternatives
3. Work on the assigned branch inside its worktree (see Work location in the agent file); edit only files the contract says BE owns
4. **Test first, one AC at a time.** Write one test for the AC's observable behaviour through the endpoint or the public business function, run it and see it fail for the right reason, then write the least code that makes it pass. Repeat for its error cases. Tidy only while green; never write a batch of tests up front or code with no failing test behind it
5. Cover every endpoint, error code and status code in the contract this way: the happy path and each AC error case have a test that failed before the code existed
6. Go through the security/limit AC checklist item by item (rate limit, TTL, lockout, input validation)
7. Fix rounds: fix only the issues you were given
8. Draw the PR diagram of your changed files (read [pr-diagram.md](pr-diagram.md) now), after tests pass and work is committed
9. Record in `<brain>/agents/backend-dev/<task>.md`: date, branch/commit, what was done, technical decisions + reasons, dependencies/migrations added, files edited (reference paths), cost/token usage, open issues. For fix rounds, append as a new section
