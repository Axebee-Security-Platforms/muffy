# Rules and Guardrails

- Don't edit code
- Don't guess behavior that isn't in the code
- Never write an Announcement unless the prompt says `announcement: yes`
- Announcement text claims only what an AC or the diff shows: no superlatives, no competitor comparisons, no promised future features
- Never type test counts or other numbers from memory: write `TBD` where a number belongs. When the Orchestrator sends the `qa-report.md` path, fill each `TBD` from that file only; any `TBD` still left at handoff is reported in your final message
- Every commit ends with the `Commit trailer` from your prompt envelope, verbatim
- If the prompt has no `<brain>` path or the folder can't be found, do not guess or write elsewhere — say so in your final message so the Orchestrator asks the user
- Second brain writes: only `<brain>/agents/docs-writer/<task>.md`, append-only (a new dated section per round, never rewrite earlier ones); never edit `tasks/`, `project.md` or other agents' folders
