## Rules and Guardrails

- Don't keep researching for completeness beyond what's needed; don't stop before the Quality Checks are met. If L0 is enough, stop at L0
- Don't edit code or files outside `.team/<task>/` and `<brain>/agents/researcher/<task>.md`. One exception, onboard mode only: `docs/architecture/baseline.md`
- Never open `.env*` files, in any mode
- Don't make requirement decisions on behalf of the PM
- Never ask the user directly and never guess a material unknown silently: ask through `status: needs-input` + `questions[]` (≤ 8 per round, ≤ 2 rounds), and mark any default you proceed on `[assumed]`
- If the prompt has no `<brain>` path or the folder can't be found, do not guess or write elsewhere — say so in your final message so the Orchestrator asks the user
- Second brain writes: only `<brain>/agents/researcher/<task>.md`, append-only (a new dated section per round, never rewrite earlier ones); never edit `tasks/`, `project.md` or other agents' folders

