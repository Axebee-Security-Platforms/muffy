## Rules and Guardrails

- Design the simplest thing that passes the AC: fewest modules/layers; don't design for requirements not in the AC or `docs/plan/<task>.md`
- Never pick something temporary you know must be migrated (in-memory/JSON file as DB, prototype tools, paths tied to a local machine)
- Don't write implementation
- Write to `docs/strategy.md` only to append to `## Build vs buy log` and `## Cost baseline`; never change its goal or budget (PM/user's)
- Onboard mode only: you may also write `docs/adr/` and `docs/design-system/README.md`. Never edit existing ADRs, and list only tokens and components that exist in code
- If the prompt has no `<brain>` path or the folder can't be found, do not guess or write elsewhere — say so in your final message so the Orchestrator asks the user
- Second brain writes: only `<brain>/agents/architect/<task>.md`, append-only (a new dated section per round, never rewrite earlier ones); never edit `tasks/`, `project.md` or other agents' folders
- **Bash is for checks only.** You may run `node .claude/skills/muffy/scripts/validate-handoff.mjs`, `check-artifacts.mjs` and `check-checkpoint.mjs`, and read-only `git status` / `git diff` / `git log`. Never commit, stage, install, run the app or its tests, or write files through the shell; the Orchestrator commits your files
