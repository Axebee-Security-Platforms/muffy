---
name: muffy
description: >
  Run a hub-and-spoke software development subagent team (main session = Orchestrator)
  from research to deploy. Use when building a feature end to end with parallel agents,
  or `/muffy fix` for a small bug or cosmetic fix (diagnose, fix, review, QA, staging). Also use when
  the user reports a bug or asks for a fix with a symptom, error or broken behaviour in a codebase
  ("found a bug", "it errors", "this is broken", "fix this", เจอบั๊ก, แก้ไขให้หน่อย, พัง, error): the
  Orchestrator triages it into the fix lane or asks one question first.
  Do not use for one-line edits, research-only or review-only requests, or sequential iteration.
---

# Muffy — Feature Development Team

## Purpose

Orchestrate the subagents in `.claude/agents/` from research to deploy for one feature. The main session is the **Orchestrator**. Subagents never talk to each other — everything goes through the Orchestrator, and work is handed off as files in `.team/<task>/`.

## Inputs

- Feature request (+ minimum research level, if specified)
- `<task>` name (kebab-case)
- `<vault>`: env `SECOND_BRAIN_VAULT` (set in `.claude/settings.local.json`; ask with `AskUserQuestion` if missing)

## Workflow

Load lazily: open each reference only at the step that needs it, never all up front. Subagents do the same via the "Load on demand" table in their own definitions.

0. **Onboard** — existing codebase, first run only (`/muffy onboard`): baseline doc + ADR + human check: [references/onboard.md](references/onboard.md)
1. **Setup** — create working folders and task note: [references/setup.md](references/setup.md)
2. **Run profile** — pick which steps to skip, never skip review/QA/staging/Human gate: [references/run-profile.md](references/run-profile.md). Small bug or cosmetic fix (`/muffy fix`, or a request that passes the triage): use the fix lane instead of steps 1–2 and the full step list: [references/fix-profile.md](references/fix-profile.md)
3. **Steps 1–12** — agent, input and output per step: [references/steps.md](references/steps.md)
3b. **Requirements interview** — researcher/PM return `needs-input`; relay their questions to the user: [references/requirements.md](references/requirements.md)
4. **Loops** — read only when a reject/fail happens: fix loops (max 3), fallback ladder, escalation: [references/loops.md](references/loops.md)
5. **Token discipline** — read once at setup: prompt template, hand-off block, fix rounds, diffs: [references/token-discipline.md](references/token-discipline.md)
6. **Memory model** — read once at setup: repo vs `.team/` vs vault layout, `checkpoint.md`: [references/memory-model.md](references/memory-model.md)
6b. **Test levels** — read before step 7 (and in the fix lane, before step 4): which tests run for which change, L0 cosmetic to L4 whole-system: [references/test-levels.md](references/test-levels.md)
7. **Closing** — step 12 only: final checks and message to the user: [references/closing.md](references/closing.md)

## Output Format

- `.team/<task>/`: `brief.md`, `ac.md`, `design.md`, `contract.md`, `deploy.md`, `review-<n>.md`, `qa-report.md`, `release-notes.md`, `checkpoint.md`, `rounds/<step>-r<n>.md`, part files `ac/`, `brief/` (only when a main file passes 60 lines), `contract/` (always: `contract.md` is an index), `handoff/<step>-<role>-r<round>.json`, `escalation-<n>.json` (only if a loop was cut off)
- Repo: `docs/plan/<task>.md`, `docs/adr/NNNN-*.md`, `docs/design-system/` (if changed), merged `feature/<task>`
- Vault: `tasks/<task>.md`, consolidated `project.md`
- Final message to the user: see `references/closing.md` step 5

## Rules and Guardrails

Critical rules — enforce with hooks: [references/hooks-enforcement.md](references/hooks-enforcement.md)

- Every agent ends with a JSON hand-off block; validate it ([schemas/](schemas/handoff.schema.json), `scripts/validate-handoff.mjs`) before acting on it; invalid twice → escalate, never guess
- A loop point that is rejected 4 times, or keeps the same blocker id open for 3 consecutive rejects, stops and asks the user: [references/loops.md](references/loops.md)
- Only the Orchestrator merges branches and saves reviews as `review-<n>.md`
- Run only the phases the plan marks for this run. In the fix lane, step 4a (diagnose) is never skipped, and a fix that outgrows the lane is promoted to the full flow, never patched on
- FE/BE report a temporary stack → stop, send to architect (+ ADR) before coding continues
- An agent writes outside its vault folder → revert it and resend its rule; an agent can't find `<brain>` → `AskUserQuestion`
- Never deploy to production without passing the Human gate
- Never Read, grep or print `.env*` files in full; check that a variable exists and its prefix is right, by name only ([hooks-enforcement.md](references/hooks-enforcement.md) §6). A key shown or pasted in chat → rotate it; log the rotation in checkpoint `## Open blockers`
- Every commit by every agent ends with the run's `Commit trailer`, passed in the prompt envelope. The Orchestrator copies it verbatim from the attribution line its harness provides; no model name is hard-coded in this skill. If the harness gives none, ask once at setup
- Pauses are named (`pause:<id>`) and only the ones in [run-profile.md](references/run-profile.md); each records its resume condition in checkpoint `## Status`
- Worktrees are created by the Orchestrator, never on the fly: ops at setup; fe/be from `ops/<task>` right after 3d passes; qa at step 7 ([setup.md](references/setup.md))

## Quality Checks

Verify after every step: [references/quality-checks.md](references/quality-checks.md)

---

**Not for:** one-line edits with no behaviour risk, research-only or review-only requests, step-by-step iteration in main session
