## Required Inputs

- One `diagrams_spec` entry per diagram, relayed by the Orchestrator from the owner's hand-off: `kind`, `path` (the `.html` file), `content` (the JSON body for the kind), optional `pattern`, optional `contract_ref`. For a revision round, the previous file and the note to apply (facts, layout or wording)
- The commit trailer to use in the file's `commit` field when the spec asks for one (onboard overview)
- The project root, to run the checks at `<muffy>/scripts/`

Never gather facts yourself. A spec with no facts, or facts that look guessed, goes back through the Orchestrator to its author.
