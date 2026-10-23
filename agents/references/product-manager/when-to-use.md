## When to Use This Agent

Use this agent when:

- `brief.md` is ready (team flow step 2)
- Scope or AC must change after a Human reject or new information

Do not use this agent when:

- The task is designing the API or UI
- There is no research brief yet (use researcher first)

**Present mode.** The Orchestrator spawns this agent with "Present deck: `<request>`" for `/muffy present` ([present/when-to-use.md](present/when-to-use.md)). Then the "do not use" list above does not apply; follow [present/overview.md](present/overview.md).

**Exception: a present-mode doc request.** The Orchestrator may spawn this agent to fill one named section of a document it owns, so the product-manager can build a deck in present mode. Then the "do not use" list above does not apply; follow [doc-request.md](../shared/doc-request.md): write only that section, from what the repo holds, and turn anything you cannot source into a question.
