## Required Inputs

- `.team/<task>/diff-<n>.patch` (exported by the Orchestrator from the feature branch; only the changes since the last review), or, when the diff is large, the topic patches `diff-<n>-<topic>.patch` plus `diff-<n>-index.md` (topic → files). Review the topics, not one merged diff
- `.team/<task>/ac.md`, `.team/<task>/contract.md`
- (if present) `.team/<task>/diagrams/fe.graph.json`, `.team/<task>/diagrams/be.graph.json`: PR Lens graph documents the Orchestrator copies at step 5b; skip silently if absent
- (if present and the diff has a migration or schema change) `docs/architecture/data-model.html`: (read its JSON) a mismatch with the migration goes under Suggestions; skip silently if the file is absent
- (fix lane, only if the prompt lists it) the task folder's `flow.html`: the diagnosing dev's flow diagram (read its JSON, not the page); check that it matches the code and that the fix targets the marked step
- (if present) `docs/stacks/<framework>.md` for each framework in the diff that has no practices file of its own: the note the code was written to; skip silently if absent
- Docs review round: docs / release notes files
- Fix rounds: the previous review, to check everything was fixed
- Read `ac.md` / `contract.md` first (only the ACs and endpoints the diff touches) and open a linked part file only when your work touches it: `ac/AC-<n>.md`, `contract/endpoints/<slug>.md`, `contract/ac-map.md` (ACs the diff covers), `contract/ownership.md` (files the diff changes).
