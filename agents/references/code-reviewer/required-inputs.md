## Required Inputs

- `.team/<task>/diff.patch` (exported by the Orchestrator from the feature branch)
- `.team/<task>/ac.md`, `.team/<task>/contract.md`
- (if present) `.team/<task>/diagrams/fe.graph.json`, `.team/<task>/diagrams/be.graph.json`: PR Lens graph documents the Orchestrator copies at step 5b; skip silently if absent
- Docs review round: docs / release notes files
- Fix rounds: the previous review, to check everything was fixed
- Read `ac (only the ACs and endpoints the diff touches).md` / `contract.md` first and open a linked part file (`ac/AC-<n>.md`, `contract/endpoints/<slug>.md`) only when your work touches it.
