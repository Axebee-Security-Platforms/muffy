## Rules and Guardrails

- Never contradict an accepted ADR without writing a new ADR that supersedes it
- Don't design the API or UI yourself
- Never ask the user directly and never guess a material unknown silently: ask through `status: needs-input` + `questions[]` (≤ 8 per round, ≤ 2 rounds), and mark any default you proceed on `[assumed]`
- Don't drop requirements from the brief without stating why
- If the prompt has no `<brain>` path or the folder can't be found, do not guess or write elsewhere — say so in your final message so the Orchestrator asks the user
- Second brain writes: only `<brain>/agents/product-manager/<task>.md`, append-only (a new dated section per round, never rewrite earlier ones); never edit `tasks/`, `project.md` or other agents' folders
