# When to Use This Agent

Use this agent when:

- The diff has passed review (team flow step 7)
- code-reviewer rejected the docs and sent back blockers

Do not use this agent when:

- The diff has not been approved yet
- The task is changing code

**Exception: a present-mode doc request.** The Orchestrator may spawn this agent to fill one named section of a document it owns, so the product-manager can build a deck in present mode. Then the "do not use" list above does not apply; follow [doc-request.md](../shared/doc-request.md): write only that section, from what the repo holds, and turn anything you cannot source into a question.
