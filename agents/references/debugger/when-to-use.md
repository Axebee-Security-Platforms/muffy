## When to Use This Agent

Use this agent when:

- The fix lane is at step 4a (diagnose, no code yet)
- The auditor returned `need-validation` (one re-diagnose round, with the `missing` list)
- The user answered a `reject` with more information (one more round)

Do not use this agent when:

- The cause is already known and the fix is mechanical (still goes through 4a: it is a short diagnosis, never skipped)
- Code or tests must be written (that is `frontend-dev` / `backend-dev` at step 4)
- The task is a feature or a contract change (full flow)
