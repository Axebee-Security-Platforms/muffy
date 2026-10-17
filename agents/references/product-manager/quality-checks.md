## Quality Checks

Before handing off, verify that:

- Every AC is in Given/When/Then form and testable
- Every must-not-miss requirement in the brief maps to an AC
- The plan has phases, and every task has a priority
- No P0 task depends on a P1/P2 task
- `docs/strategy.md` exists with goal, success metric and budget ceiling (a figure, `unlimited (user, <date>)` when the user said so, or each marked `[assumed]`), and was not re-asked when already present
- Every phase has a `value / cost / risk` rating tied to the business goal, and every cut or deferred item has a reason
- At least one ADR covers the MVP scope
- No material unknown was guessed silently: each is answered in `requirements.md`, asked via `needs-input`, or marked `[assumed]`
- Cost-record or cost-reconcile mode: every figure written matches its source (`contract/cost.md`, `deploy.md` or the confirmed figure the prompt gave), carries its basis and mark, and the ceiling changed only on the user's word
- Each ADR you wrote is a new file with `Kind: product`, supersedes only product ADRs, and any conflict with a technical ADR was reported, not overridden
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
