---
name: muffy
display_name: Earl Grey
description: >
  Run a subagent team (main session = Orchestrator) from research to deploy, on the smallest route.
  Use to build a feature end to end (ทำฟีเจอร์, `/muffy feature`); for a bug report
  with a symptom or error ("found a bug", "it errors", "this is broken", เจอบั๊ก, พัง, error) via the fix lane
  (`/muffy fix`); for an internal API, refactor, measured perf fix or migration (`/muffy lite`, ทำให้เร็วขึ้น);
  and for a single-step request: research or compare (วิจัย, เปรียบเทียบ), plan or user stories (วางแผน),
  screens (ออกแบบหน้าจอ), API or schema (ออกแบบ API), a UX/UI review (รีวิวดีไซน์), an architecture or ADR review
  or a new ADR, a code/PR review (รีวิว PR), tests (เขียนเทสต์), docs or README (ทำเอกสาร), deploy or rollback.
  Also: resume (`/muffy resume`, "continue", ทำต่อ), `/muffy pending` for unfinished `.team` tasks, `/muffy onboard`,
  `/muffy present` for a client deck (ทำสไลด์), `/muffy diagram` for a standalone diagram.
  Not for a question about the code, a text-only one-line edit, or step-by-step work in the main session.
---

# Muffy — Feature Development Team

## Purpose

Orchestrate the subagents in `.claude/agents/` from research to deploy for one feature. The main session is the **Orchestrator**. Subagents never talk to each other — everything goes through the Orchestrator, and work is handed off as files in `.team/<task>/`.

## Inputs

- Feature request (+ minimum research level, if specified)
- `<task>` name (kebab-case)
- `<vault>`: env `SECOND_BRAIN_VAULT` (set in `.claude/settings.local.json`). Unset or still a `<...>` placeholder → no vault: `<brain>` is `.team/brain/` in the repo, committed and shared through git ([memory-model.md](references/memory-model.md))

## Workflow

Load lazily: open a reference only at the step that needs it; subagents do the same through the "Load on demand" table in their own definitions. This list is the order of the references, not step numbers: "step N" is a row of [steps.md](references/steps.md). If this file is already in the session (after a compact or a resume too), follow it from where you are; do not invoke `/muffy` again to reload it.

Resume (`/muffy resume`, "continue", ทำต่อ) skips Pending, Onboard, Setup and Run profile: [references/resume.md](references/resume.md).

- **Route** — first, on a free-text request; say the entry in one line before spawning: [route.md](references/route.md). Skip it when the request starts with a mode command (`/muffy pending | onboard | present | diagram | resume | fix | lite | feature`): the command is the route, so say `Route: <mode>` and open that mode's reference instead
- **Pending** (`/muffy pending`) — tasks in `.team` that are not done, read-only: [pending.md](references/pending.md)
- **Onboard** (`/muffy onboard`) — existing codebase, first run: [onboard.md](references/onboard.md)
- **Present** (`/muffy present`) — client deck outside the team flow: [present.md](references/present.md), missing documents: [doc-request.md](references/doc-request.md)
- **Diagram** (`/muffy diagram`, or a standalone "draw a diagram") — route facts to the owning agent, then always `diagrammer`: [diagram.md](references/diagram.md); PNG/SVG only on request: [diagram-export.md](references/diagram-export.md)
- **Setup** — folders and task note: [setup.md](references/setup.md)
- **Run profile** — which steps to skip, never review/QA/staging/Human gate: [run-profile.md](references/run-profile.md). Small bug: fix lane [fix-profile.md](references/fix-profile.md) (`/muffy fix`). Internal API, refactor, measured perf, reversible migration: lite lane [lite-profile.md](references/lite-profile.md) (`/muffy lite`). Forced full flow, no triage: `/muffy feature <request>` runs every step; it skips only the route and the fix/lite triage, never a gate
- **Steps 0–12** — agent, input and output per step: [steps.md](references/steps.md)
- **Platforms** — when the contract's `Platform:` is not `web`, or the request names an app or CLI: [platforms.md](references/platforms.md)
- **Publishing diagrams** (3e): [diagram-publish.md](references/diagram-publish.md) · **Design review** (3c): [design-review.md](references/design-review.md)
- **Requirements interview** (steps 1–2, `needs-input`): [requirements.md](references/requirements.md)
- **Stack learning**: [stack-learning.md](references/stack-learning.md) · **Baseline freshness** (yellow/red only): [baseline-freshness.md](references/baseline-freshness.md) · **ADR ownership**: [adr.md](references/adr.md) · **Budget**: [budget.md](references/budget.md)
- **Loops** — only when a reject/fail happens: [loops.md](references/loops.md)
- **Token discipline** (prompt envelope script, report cap, quiet Bash, turn budget, compact points) and **Memory model** — each once at setup: [token-discipline.md](references/token-discipline.md), [memory-model.md](references/memory-model.md)
- **Test levels** — before step 7 (fix lane: before step 4): [test-levels.md](references/test-levels.md)
- **Closing** — step 12 only: [closing.md](references/closing.md)

## Output Format

- `.team/<task>/`: the hand-off files, `checkpoint.md`, `handoff/`, `spawns.tsv`, `rounds/`, `canvas/`, `diagrams/`; the full list and the split rules are in [memory-model.md](references/memory-model.md)
- Repo: `docs/plan/<task>.md`, `docs/adr/NNNN-*.md`, `docs/design-system/` (if changed), merged `feature/<task>`
- Vault: `tasks/<task>.md`, consolidated `project.md`
- Final message to the user: [closing.md](references/closing.md) step 5

## Rules and Guardrails

Critical rules — Orchestrator rules 1–4 plus the opt-in hooks: [references/hooks-enforcement.md](references/hooks-enforcement.md)

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
- Worktrees are created by the Orchestrator, never on the fly: feature at setup; ops at 3d, cut from the planning commit on `feature/<task>`; fe/be from `ops/<task>` right after 3d passes (from `feature/<task>` when 3d is skipped); qa at step 7 ([setup.md](references/setup.md))

## Quality Checks

Verify after every step: [references/quality-checks.md](references/quality-checks.md)

---

**Not for:** questions about the code, one-line edits with no behaviour risk, step-by-step iteration in main session. Research-only, review-only, design-only and spec-only requests are not refused: they route to the single agent that owns them ([route.md](references/route.md))
