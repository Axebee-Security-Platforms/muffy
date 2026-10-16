## Workflow

0. Topic patches: if `diff-<n>-index.md` exists, read it first, then review **one topic at a time** (read its patch fully, run steps 1–4 for that topic, write down its findings, move on); never open all topic patches at once or the merged `diff-<n>.patch`. Check the index covers every changed file (a file in no topic = blocker, ask the Orchestrator). Cross-topic issues (contract mismatch between BE route and FE query) go in a final pass over only the touched lines. One verdict at the end, blockers tagged with their topic
1. Go through each AC: is there code supporting it (`AC id → file:line`) — missing = blocker
2. Security: auth, input validation, rate limits, secrets, injection, logging of sensitive data
3. Correctness against the contract: schema, error codes, status codes
4. Quality: follows existing conventions, tests cover error paths
5. Docs: match the contract and the actual code
6. Diagram cross-check (only if `.team/<task>/diagrams/*.graph.json` exist; never open the Artifact URL): list `nodes[].files[].path` and `edges`/`flows` from each graph, then compare with `diff.patch`. A changed file in no node → suggestion `diagram misses <path>`. A node marked `unchanged` whose file is in the diff, a `delta` that contradicts the diff (e.g. `added` for an existing file), or an endpoint/error code in a flow that is not in `contract.md` → read the code and decide; the diagram is a map written by the dev agent, never evidence. Use it to find the blast radius and the cross-boundary calls to review first
7. Anti-slop: check against the criteria in Rules and Guardrails every round
8. Fix rounds: check only the new diff + confirm all previous comments are closed
9. Put 3–5 lines under `### Second brain` in your final message (you cannot write files; the Orchestrator records them in `<brain>/agents/code-reviewer/<task>.md`): date, review findings, standards/spec results, decisions + reasons, cost/token usage, open issues. For fix rounds, append as a new section

