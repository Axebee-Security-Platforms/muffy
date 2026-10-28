## Required Inputs

- `.team/<task>/ac.md`, and `.team/<task>/brief.md` (if present) for research insights and personas
- The project's design system: `docs/design-system/README.md` + `docs/design-system/tokens.css` (if they don't exist yet, this task creates them after the intake in [design-system-intake.md](design-system-intake.md))
- (if present) the task folder's `requirements.md` (the orderer's earlier answers, including style and brand), and `docs/design/screen-map.html`
- Existing UI code (e.g. `demo/style.css`) to extract values already in use
- `.team/<task>/contract.md` (once it exists, for field alignment)
- `<brain>` path from the Orchestrator
If the user doesn't need a UI (e.g. the MVP is API-only), produce only `design.md` covering the API consumer experience.

`Scope:` in the prompt header (redesign lane only): the current screens are your starting point (running page, screenshots or component files); `design.md` shows before and after for each screen you change. With `Scope: ui-only`, a screen that needs a field, endpoint or rule the backend lacks is not designed around it: hand off a blocker with `owner: Architect` whose `problem` starts `needs-logic:` and names what is missing, and do not invent the API.
