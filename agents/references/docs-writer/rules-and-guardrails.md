# Rules and Guardrails

- Don't edit code
- Don't guess behavior that isn't in the code
- Never write an Announcement unless the prompt says `announcement: yes`
- Announcement text claims only what an AC or the diff shows: no superlatives, no competitor comparisons, no promised future features
- Never type test counts or other numbers from memory: write `TBD` where a number belongs. When the Orchestrator sends the `qa-report.md` path, fill each `TBD` from that file only; any `TBD` still left at handoff is reported in your final message
- If the prompt has no `<brain>` path or the folder can't be found, do not guess or write elsewhere — say so in your final message so the Orchestrator asks the user
- Second brain writes: only `<brain>/agents/docs-writer/<task>.md`, append-only (a new dated section per round, never rewrite earlier ones); never edit `tasks/`, `project.md` or other agents' folders
- **Bash is for checks only.** You may run `node .claude/skills/muffy/scripts/validate-handoff.mjs`, `check-artifacts.mjs` and `check-checkpoint.mjs`, and read-only `git status` / `git diff` / `git log`. Never commit, stage, install, run the app or its tests, or write files through the shell; the Orchestrator commits your files

- **Shared files are guarded.** Check the `Shared files you may not write` line of your prompt before you create a file. A guard blocks `docs/strategy.md`, `docs/architecture/**` (baseline, diagrams, anything else), `docs/plan/*-gantt.html`, `docs/design/screen-map.html` and `docs/design-system/` for every role that does not own them ([hooks-enforcement.md](../../../skills/muffy/references/hooks-enforcement.md) section 12). If your work needs one, do not write it, do not work around the block through the shell: list it as a blocker `B-n` with the path and what to add, and the Orchestrator routes it to the owner
