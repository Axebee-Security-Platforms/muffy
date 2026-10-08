---
name: muffy
description: >
  Run a hub-and-spoke software development subagent team (main session = Orchestrator)
  from research to deploy. Use when building a feature end to end with parallel agents.
  Do not use for small fixes, single-file changes, or sequential iteration.
---

# Muffy — Feature Development Team

## Purpose

Orchestrate the subagents in `.claude/agents/` from research to deploy for one feature. The main session is the **Orchestrator**. Subagents never talk to each other — everything goes through the Orchestrator, and work is handed off as files in `.team/<task>/`.

## Inputs

- Feature request (+ minimum research level, if specified)
- `<task>` name (kebab-case)
- `<vault>`: env `SECOND_BRAIN_VAULT` (set in `.claude/settings.local.json`; ask with `AskUserQuestion` if missing)

## Workflow

1. **Setup** — create working folders and task note: [references/setup.md](references/setup.md)
2. **Run profile** — pick which steps to skip, never skip review/QA/staging/Human gate: [references/run-profile.md](references/run-profile.md)
3. **Steps 1–12** — agent, input and output per step: [references/steps.md](references/steps.md)
4. **Loops** — reject/fail handling, max 3 loops: [references/loops.md](references/loops.md)
5. **Token discipline** — prompt template, fix rounds, diffs: [references/token-discipline.md](references/token-discipline.md)
6. **Memory model** — repo vs `.team/` vs vault layout: [references/memory-model.md](references/memory-model.md)
7. **Closing** — final checks and message to the user: [references/closing.md](references/closing.md)

## Output Format

- `.team/<task>/`: `brief.md`, `ac.md`, `design.md`, `contract.md`, `deploy.md`, `review-<n>.md`, `qa-report.md`, `release-notes.md`
- Repo: `docs/plan/<task>.md`, `docs/adr/NNNN-*.md`, `docs/design-system/` (if changed), merged `feature/<task>`
- Vault: `tasks/<task>.md`, consolidated `project.md`
- Final message to the user: see `references/closing.md` step 5

## Rules and Guardrails

Critical rules — enforce with hooks: [references/hooks-enforcement.md](references/hooks-enforcement.md)

- Only the Orchestrator merges branches and saves reviews as `review-<n>.md`
- Run only the phases the plan marks for this run
- FE/BE report a temporary stack → stop, send to architect (+ ADR) before coding continues
- An agent writes outside its vault folder → revert it and resend its rule; an agent can't find `<brain>` → `AskUserQuestion`
- Never deploy to production without passing the Human gate

## Quality Checks

Verify after every step: [references/quality-checks.md](references/quality-checks.md)

---

**Not for:** small fixes, single-file edits, research-only or review-only requests, step-by-step iteration in main session
