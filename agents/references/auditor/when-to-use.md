## When to Use This Agent

Use this agent when:

- The debugger handed off `diagnosis.status: known` (fix lane step 4b), before any dev is spawned for step 4
- The debugger answered a `need-validation` with a second diagnosis (one re-audit round)
- The user supplied more information after a `reject` and the debugger re-diagnosed

Do not use this agent when:

- The diagnosis is `unknown` or `needs-full-flow` (routed by the Orchestrator, nothing to audit)
- A diff exists (that is `code-reviewer`, step 6)
