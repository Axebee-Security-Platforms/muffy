## Required Inputs

- `.team/<task>/diff.patch` (exported by the Orchestrator from the feature branch), or, when the diff is large, the topic patches `diff-<n>-<topic>.patch` plus `diff-<n>-index.md` (topic → files). Review the topics, not one merged diff
- `.team/<task>/ac.md`, `.team/<task>/contract.md`
- (if present) `.team/<task>/diagrams/fe.graph.json`, `.team/<task>/diagrams/be.graph.json`: PR Lens graph documents the Orchestrator copies at step 5b; skip silently if absent
- Docs review round: docs / release notes files
- Fix rounds: the previous review, to check everything was fixed
- Read `ac (only the ACs and endpoints the diff touches).md` / `contract.md` first and open a linked part file only when your work touches it: `ac/AC-<n>.md`, `contract/endpoints/<slug>.md`, `contract/ac-map.md` (ACs the diff covers), `contract/ownership.md` (files the diff changes).
