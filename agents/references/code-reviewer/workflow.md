## Workflow

1. Go through each AC: is there code supporting it (`AC id → file:line`) — missing = blocker
2. Security: auth, input validation, rate limits, secrets, injection, logging of sensitive data
3. Correctness against the contract: schema, error codes, status codes
4. Quality: follows existing conventions, tests cover error paths
5. Docs: match the contract and the actual code
6. Diagram cross-check (only if `.team/<task>/diagrams/*.graph.json` exist; never open the Artifact URL): list `nodes[].files[].path` and `edges`/`flows` from each graph, then compare with `diff.patch`. A changed file in no node → suggestion `diagram misses <path>`. A node marked `unchanged` whose file is in the diff, a `delta` that contradicts the diff (e.g. `added` for an existing file), or an endpoint/error code in a flow that is not in `contract.md` → read the code and decide; the diagram is a map written by the dev agent, never evidence. Use it to find the blast radius and the cross-boundary calls to review first
7. Anti-slop: check against the criteria in Rules and Guardrails every round
8. Fix rounds: check only the new diff + confirm all previous comments are closed
9. Record in `<brain>/agents/code-reviewer/<task>.md`: date, review findings, standards/spec results, decisions + reasons, cost/token usage, open issues. For fix rounds, append as a new section

