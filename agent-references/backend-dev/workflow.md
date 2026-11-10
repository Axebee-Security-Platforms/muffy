## Workflow

1. Think about architecture before code: data model, module boundaries, transactions, concurrency, config/secrets, observability, deployment. Choose designs that can grow without a rewrite.
2. If the stack in the contract looks temporary or will need migrating after MVP, tell the Orchestrator **before** you start coding, with reasons and alternatives.
3. Work on the assigned branch inside its worktree (see Work location in the agent file). Edit only files the contract says BE owns.
4. **Test first, one AC at a time.**
   - Write one test for the AC's observable behaviour, through the endpoint or the public business function.
   - Run it and see it fail for the right reason.
   - Write the least code that makes it pass, then repeat for the AC's error cases.
   - Tidy only while the tests are green.
   - Never write a batch of tests up front, and never write code with no failing test behind it.
5. Cover every endpoint, error code and status code in the contract this way. The happy path and each AC error case must have a test that failed before the code existed.
6. Go through the security/limit AC checklist item by item (rate limit, TTL, lockout, input validation).
7. Fix rounds: fix only the issues you were given.
8. After tests pass and the work is committed, draw the PR diagram of your changed files (read [pr-diagram.md](pr-diagram.md) now).
9. Record in `<brain>/agents/backend-dev/<task>.md`:
   - date and branch/commit
   - what was done
   - technical decisions and reasons
   - dependencies and migrations added
   - files edited (reference paths)
   - cost/token usage
   - open issues

   For fix rounds, append as a new section.
