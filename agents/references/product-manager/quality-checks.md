## Quality Checks

Before handing off, verify that:

- Every AC is in Given/When/Then form and testable
- Every must-not-miss requirement in the brief maps to an AC
- The plan has phases, and every task has a priority
- No P0 task depends on a P1/P2 task
- `docs/strategy.md` exists with goal, success metric and budget ceiling (or each marked `[assumed]`), and was not re-asked when already present
- Every phase has a `value / cost / risk` rating tied to the business goal, and every cut or deferred item has a reason
- At least one ADR covers the MVP scope
- No material unknown was guessed silently: each is answered in `requirements.md`, asked via `needs-input`, or marked `[assumed]`
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
