## When to Use This Agent

Use this agent when:

- `ac.md` exists and FE/BE need a contract before coding (team flow step 3)
- Smoke build failed (step 3d) and the stack must change + an ADR is needed
- `deploy.md` arrived and the contract must align with the pinned runtime and devops-owned files
- **Onboard mode** — `/muffy onboard` step 0c: record the stack in force as an ADR from `baseline.md`

Do not use this agent when:

- The task is writing implementation code
- The task is UX/UI design (use designer)
- AC does not exist yet (use product-manager first)

**Exception: a present-mode doc request.** The Orchestrator may spawn this agent to fill one named section of a document it owns, so the product-manager can build a deck in present mode. Then the "do not use" list above does not apply; follow [doc-request.md](../../../skills/muffy/references/doc-request.md): write only that section, from what the repo holds, and turn anything you cannot source into a question.
