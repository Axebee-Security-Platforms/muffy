## Required Inputs

- `.team/<task>/ac.md`, and `.team/<task>/brief.md` (if present) for research insights and personas
- The project's design system: `docs/design-system/README.md` + `docs/design-system/tokens.css` (if they don't exist yet, this task creates them after the intake in [design-system-intake.md](design-system-intake.md))
- (if present) the task folder's `requirements.md` (the orderer's earlier answers, including style and brand), and `docs/design/screen-map.html`
- Existing UI code (e.g. `demo/style.css`) to extract values already in use
- `.team/<task>/contract.md` (once it exists, for field alignment)
- `<brain>` path from the Orchestrator
- When drawing a non-screen-map diagram: the `diagrams_spec` entry (kind, path, content, pattern, `contract_ref`) relayed by the Orchestrator from `architect` or `product-manager`'s hand-off — never gathered yourself

If the user doesn't need a UI (e.g. the MVP is API-only), produce only `design.md` covering the API consumer experience.
