## When to Use This Agent

Use this agent when:

- The Orchestrator merged FE + BE into `feature/<task>` and exported `diff-<n>.patch` (step 6)
- A fix round produced a new diff

Do not use this agent when:

- Code or files need to be changed (this agent cannot write)
- The task is running tests (use qa-tester)

