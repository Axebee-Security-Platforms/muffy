## When to Use This Agent

Use this agent when:

- `ac.md` exists and the UI needs designing (team flow step 3)
- `contract.md` is done and the canvas must align fields/names with it (step 3b)
- The design gate (step 3c) sent the work back, or the user requested changes at `pause:design-review`

Do not use this agent when:

- The task is API/schema design (use architect)
- The task is writing production code (use frontend-dev)

**Present mode: designing a deck.** After the requester confirms the product-manager's outline and the product-manager writes `deck.json`, the Orchestrator spawns this agent with "Design deck: `<output folder>`" to build `deck.html` ([presentation.md](presentation.md)). The "do not use" list above does not apply.

**Exception: a present-mode doc request.** The Orchestrator may spawn this agent to fill one named section of a document it owns, so the product-manager can build a deck in present mode. Then the "do not use" list above does not apply; follow [doc-request.md](../shared/doc-request.md): write only that section, from what the repo holds, and turn anything you cannot source into a question.
