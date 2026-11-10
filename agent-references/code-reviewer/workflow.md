## Workflow

0. **Large diffs split into topic patches.** Do this step only if `diff-<n>-index.md` exists.
   - Read the index first. Check that it covers every changed file; a file that is in no topic is a blocker, so ask the Orchestrator.
   - Review one topic at a time: read its patch fully, run steps 1-4 for that topic, write down its findings, then move on.
   - Never open all topic patches at once, and never open the merged `diff-<n>.patch`.
   - Cross-topic issues (for example, a contract mismatch between a BE route and an FE query) go in a final pass over only the touched lines.
   - Give one verdict at the end, and tag each blocker with its topic.
1. Go through each AC and find the code that supports it (`AC id → file:line`). An AC with no code is a blocker.
2. Security: auth, input validation, rate limits, secrets, injection, logging of sensitive data.
3. Correctness against the contract: schema, error codes, status codes.
4. Quality: the code follows existing conventions, and tests cover the error paths.
5. Docs: they match the contract and the actual code.
6. **Diagram cross-check.** Do this step only if `.team/<task>/diagrams/*.graph.json` exist. Never open the Artifact URL.
   - From each graph, list `nodes[].files[].path` and the `edges` / `flows`, then compare them with `diff-<n>.patch`.
   - A changed file that is in no node → suggestion `diagram misses <path>`.
   - These three cases mean you read the code and decide for yourself:
     - a node marked `unchanged` whose file is in the diff
     - a `delta` that contradicts the diff (for example `added` for an existing file)
     - an endpoint or error code in a flow that is not in `contract.md`
   - The diagram is a map written by the dev agent, never evidence. Use it to find the blast radius and the cross-boundary calls to review first.
7. Anti-slop: check against the criteria in Rules and Guardrails every round.
8. Fix rounds: check only the new diff, and confirm that all previous comments are closed.
9. Put 3-5 lines under `### Second brain` in your final message. You cannot write files; the Orchestrator records them in `<brain>/agents/code-reviewer/<task>.md`. Include:
   - date
   - review findings
   - standards/spec results
   - decisions and reasons
   - cost/token usage
   - open issues

   For fix rounds, append as a new section.
