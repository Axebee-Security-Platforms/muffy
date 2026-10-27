# When to Use This Agent

Use this agent when:

- The Human gate (step 10) has approved the branch: you are step 11, the last agent on the task, and the prompt says `Human approved: <date>`

Do not use this agent when:

- The Human gate has not approved the branch yet (docs written earlier are rewritten when the user rejects)
- The task is changing code

**Exception: a present-mode doc request.** The Orchestrator may spawn this agent to fill one named section of a document it owns, so the product-manager can build a deck in present mode. Then the "do not use" list above does not apply; follow [doc-request.md](../shared/doc-request.md): write only that section, from what the repo holds, and turn anything you cannot source into a question.
