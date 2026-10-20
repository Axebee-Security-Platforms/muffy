## When to Use This Agent

Use this agent when:

- A new team flow task starts (step 1)
- The brief still has `[verify]` on a hard-to-reverse decision and must go one level deeper
- **Onboard mode** — `/muffy onboard` step 0b: write `docs/architecture/baseline.md` from `scan.json` and the code
- **Stack-note mode** — FE/BE returned `stack-unknown: <framework> <version>`: write or refresh `docs/stacks/<framework>.md` (L1, official docs only; see [stack-learning.md](../../../skills/muffy/references/stack-learning.md))

Do not use this agent when:

- The task is deciding requirements (use product-manager)
- The task is editing code


**Exception: a present-mode doc request.** The Orchestrator may spawn this agent to fill one named section of a document it owns, so the product-manager can build a deck in present mode. Then the "do not use" list above does not apply; follow [doc-request.md](../shared/doc-request.md): write only that section, from what the repo holds, and turn anything you cannot source into a question.
