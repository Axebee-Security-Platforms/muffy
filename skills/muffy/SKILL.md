---
name: muffy
display_name: Earl Grey
description: Run a subagent team from research to a reviewed, test-gated branch; never deploys. Use for /muffy feature, fix, lite, redesign, upgrade, verify, onboard, present, diagram, resume; ทำฟีเจอร์, เจอบั๊ก/พัง/error, ทำให้เร็วขึ้น, ออกแบบใหม่/ปรับหน้า/แก้ flow, อัปเกรด/bump, ตรวจให้ครบ/รีวิวและเทส, รีวิว PR, วิจัย, วางแผน, ออกแบบหน้าจอ, ทำเอกสาร, ทำสไลด์, งานค้าง/ทำต่อ. Not for a code question or a one-line edit.
allowed-tools: Read, Grep, Glob, Agent, Edit, Write, AskUserQuestion, Bash(git:*), Bash(node:*)
metadata:
  author: kanata-b
  tags: [agents, subagents, orchestration, team, workflow, development]
---

# Muffy: Feature Development Team

## Purpose

Orchestrate muffy's subagents from research to deploy for one feature. The main session is the **Orchestrator**. Subagents never talk to each other. Everything goes through the Orchestrator, and work is handed off as files in `.team/<task>/`.

**Paths.** `<muffy>` in this file and every reference is `${CLAUDE_SKILL_DIR}`, this skill's folder (in the plugin cache for a plugin install, `.claude/skills/muffy` for a copied one). Write it out in full with forward slashes, and in double quotes in a command: `node "<muffy>/scripts/check-all.mjs" …`. The agent definitions are in `<muffy>/../../agents/` and their reference files in `<muffy>/../../agent-references/`. **Agent names:** spawn `muffy:<role>` when the Agent tool lists it (plugin install), otherwise `<role>`; the rest of this skill writes the bare role.

## Inputs

- Feature request (+ minimum research level, if specified)
- `<task>` name (kebab-case)
- `<vault>`: env `SECOND_BRAIN_VAULT` (set in the project's local Claude settings file, `.claude/` folder). Unset or still a `<...>` placeholder → no vault: `<brain>` is `.team/brain/` in the repo, committed and shared through git ([memory-model.md](references/memory-model.md))

## Workflow

Load lazily: open a reference only at the step that needs it; subagents do the same through the "Load on demand" table in their own definitions. This list is the order of the references, not step numbers: "step N" is a row of [steps.md](references/steps.md). If this file is already in the session (after a compact or a resume too), follow it from where you are; do not invoke `/muffy` again to reload it.

Resume (`/muffy resume`, "continue", ทำต่อ) skips Todo, Onboard, Setup and Run profile: [references/resume.md](references/resume.md).

**Headless** (env `MUFFY_HEADLESS=1`, a `claude -p` run with no question tool): read [references/headless.md](references/headless.md) before the first question. Every question becomes `.team/<task>/gate.json` plus `checkpoint.mjs ask`; never `AskUserQuestion`, never an answer of your own.

- **Menu**: a bare `/muffy` (no request) or `/muffy todo`, and resume when it cannot pick one task: [menu.md](references/menu.md)
- **Route**: first, on a free-text request; show the plan before spawning (`next-action.mjs plan-card`): [route.md](references/route.md). Skip it when the request starts with a mode command (`/muffy onboard | present | diagram | resume <task> | fix | lite | redesign | feature`): the command is the route, so open that mode's reference, and a lane still shows its plan card
- **Fix lane** (`/muffy fix …`, or a request the route table sends to it): the lane is run by `next.mjs`, not by you. Read the request into the flags (`node "<muffy>/scripts/next.mjs" start --task fix-<slug> --scope bug|cosmetic --owner FE|BE|both --request "<verbatim>" --symptom … --ac "AC-1 | result | check"`, the rest is in its header), then do only what its `action=` line says: `spawn` (copy the prompt between the `---prompt---` lines into one Agent call with the `agent` and `model` it names), `ask` (put the `---questions---` JSON to `AskUserQuestion`, or in headless mode follow `then=`), `route`, `stop`, `onboard`, `done`. After an agent returns run `next.mjs step <task>`; after the code-reviewer pipe its whole message to `next.mjs review <task>`; the user's answer to a question goes to `next.mjs answer <task> "<label>"`. A request that names the lane is never cut down to a direct edit because the fix looks small: the diagnosis, the audit, the review and the test gate are the lane. Do not open `fix-profile.md`, `setup.md` or `closing.md` for it
- **The other lanes** (change, verify, upgrade, the full flow) run the same way: `node "<muffy>/scripts/next.mjs" start --lane change --scope internal|ui-only|ui+logic|logic-only --task change-<slug> --request "<verbatim>" [--kind refactor|perf|internal-api|db --owner FE|BE|both --ac "AC-1 | result | check"]`, `--lane verify --task verify-<slug> --branch <theirs> --base <base> --ac …`, `--lane upgrade --task upgrade-<slug> --target "<package from to>" --request …`, `--lane feature --task <slug> --request … [--skip designer,frontend-dev,3b,3c for a change with no UI]`. Two more actions: `wait` (an agent is still running: run `step` when it returns) and `do` (a step only you can do, such as publishing the canvas or the UX review: do what its `instruction=` lines say, then run the command in `then=`). Several `spawn` blocks in one output start in one message. A gate's `ask` is answered with `next.mjs answer <task> "<label>"` (`Request changes: <what>` sends the roles back); an agent's questions come as an `ask` too. Headless runs stop at every gate with `muffy-status: waiting:<gate>`; the answer line the person leaves lets `step` go on
- **Todo**: the menu's list of tasks in `.team` that are not done, read-only: [todo.md](references/todo.md)
- **Onboard**: started by setup step 3 when a task finds no usable baseline (asked once, depth by lane, then the task carries on), or by hand with `/muffy onboard`: [onboard.md](references/onboard.md)
- **Present** (`/muffy present`): client deck outside the team flow: [present.md](references/present.md), missing documents: [doc-request.md](references/doc-request.md)
- **Diagram** (`/muffy diagram`, or a standalone "draw a diagram"): route facts to the owning agent, then always `diagrammer`: [diagram.md](references/diagram.md); PNG/SVG only on request: [diagram-export.md](references/diagram-export.md)
- **Setup**: folders and task note: [setup.md](references/setup.md)
- **Run profile**: which steps to skip, never review/QA/Human gate: [run-profile.md](references/run-profile.md). Small bug: fix lane [fix-profile.md](references/fix-profile.md) (`/muffy fix`). Change to something that exists: change lane [change-profile.md](references/change-profile.md), scope `internal` for an internal API, refactor, measured perf or reversible migration (`/muffy lite`), or a visible scope for a screen, UX/UI or business-logic flow (`/muffy redesign`). A version bump of a dependency or runtime already used: upgrade lane [upgrade-profile.md](references/upgrade-profile.md). Review, test and accept a branch someone wrote: verify lane [verify-profile.md](references/verify-profile.md). Forced full flow, no triage: `/muffy feature <request>` runs every step. It skips only the route and the fix/change triage, never a gate
- **Steps 0 to 12**: agent, input and output per step: [steps.md](references/steps.md)
- **Platforms**: when the contract's `Platform:` is not `web`, or the request names an app or CLI: [platforms.md](references/platforms.md)
- **Publishing diagrams** (3e): [diagram-publish.md](references/diagram-publish.md) · **Design review** (3c): [design-review.md](references/design-review.md)
- **Requirements interview** (steps 1 and 2, `needs-input`): [requirements.md](references/requirements.md)
- **Stack learning**: [stack-learning.md](references/stack-learning.md) · **Baseline freshness** (red only; yellow is refreshed without a question): [baseline-freshness.md](references/baseline-freshness.md) · **ADR ownership**: [adr-writing.md](references/adr-writing.md)
- **Loops**: only when a reject/fail happens: [loops.md](references/loops.md)
- **Token discipline** (prompt envelope script, report cap, quiet Bash, turn budget, compact points) and **Memory model**: each once at setup: [token-discipline.md](references/token-discipline.md), [memory-model.md](references/memory-model.md)
- **Test levels**: before step 7 (fix lane: before step 4): [test-levels.md](references/test-levels.md)
- **Closing**: step 12 only: [closing.md](references/closing.md)

## Output Format

- `.team/<task>/`: the hand-off files, the checkpoint, `handoff/`, the spawn log, `rounds/`, `canvas/`, `diagrams/`; the full list and the split rules are in [memory-model.md](references/memory-model.md)
- Repo: `docs/plan/<task>.md`, `docs/adr/NNNN-*.md`, `docs/design-system/` (if changed), merged `feature/<task>`
- Vault: one note per task under `tasks/`, and the consolidated project note
- Final message to the user: [closing.md](references/closing.md) step 6

## Rules and Guardrails

Critical rules (Orchestrator rules 1 to 4, plus the opt-in hooks): [references/hooks-enforcement.md](references/hooks-enforcement.md)

- Every agent ends with a JSON hand-off block; validate it ([schemas/](schemas/handoff.schema.json), `scripts/validate-handoff.mjs`) before acting on it; invalid twice → escalate, never guess
- An agent's hand-off carries `deferred_writes` (the harness refused its document write): you write those files from its `<<<FILE>>>` blocks, then validate ([token-discipline.md](references/token-discipline.md))
- A loop point that is rejected 4 times, or keeps the same blocker id open for 3 consecutive rejects, stops and asks the user: [references/loops.md](references/loops.md)
- Only the Orchestrator merges branches and saves reviews as `review-<n>.md`
- Run only the phases the plan marks for this run. In the fix lane, step 4a (diagnose) is never skipped, and 4b (audit the cause) is skipped only for a cosmetic fix diagnosed `low` ([fix-profile.md](references/fix-profile.md)). The lane is silent (hand-off JSON between agents, no `SendMessage`). A run that outgrows its lane moves up the [promotion ladder](references/run-profile.md#promotion-ladder) to the smallest lane that fits, never patched on
- FE/BE report a temporary stack → stop, send to architect (+ ADR) before coding continues
- An agent writes outside its vault folder → revert it and resend its rule; an agent can't find `<brain>` → `AskUserQuestion`
- No agent deploys, rolls back or touches staging or production: work ends on docker local at the Human gate. The user deploys from the Deploy hand-off
- Never Read, grep or print `.env*` files in full; check that a variable exists and its prefix is right, by name only ([hooks-enforcement.md](references/hooks-enforcement.md) §6). A key shown or pasted in chat → rotate it; log the rotation in checkpoint `## Open blockers`
- Every commit by every agent ends with the run's `Commit trailer`, passed in the prompt envelope. The Orchestrator copies it verbatim from the attribution line its harness provides; no model name is hard-coded in this skill. If the harness gives none, ask once at setup
- Pauses are named (`pause:<id>`) and only the ones in [run-profile.md](references/run-profile.md); each records its resume condition in checkpoint `## Status`
- Worktrees are created by the Orchestrator, never on the fly: feature at setup; ops at 3d, cut from the planning commit on `feature/<task>`; fe/be from `ops/<task>` right after 3d passes (from `feature/<task>` when 3d is skipped); qa at step 7 ([setup.md](references/setup.md)). Only the Orchestrator removes them, with `remove-worktrees.mjs`: ops, fe, be and qa when the Human gate approves, feature at closing, never forced; branches stay

## Quality Checks

Verify after every step: run `node "<muffy>/scripts/check-all.mjs" .team/<task> --step <s> --round <n>` and act on its `next=` line, then the judgment checks: [references/quality-checks.md](references/quality-checks.md)

## Scripts

The ones the Orchestrator runs every task (`node "<muffy>/scripts/<name>.mjs" …`); the rest are called from the references.

| Script | Use it |
|---|---|
| `init-config.mjs` | Setup: writes the project's `test_command` into the config file in `.team/`, from its package manifest |
| `checkpoint.mjs` | Write the checkpoint: rounds, pauses, gate answers, the lane line |
| `make-envelope.mjs` | Build each subagent prompt from flags, not by hand |
| `next.mjs` | The fix lane, one step at a time: does the setup, git and bookkeeping, prints the next spawn, question or stop |
| `next-action.mjs` | Deterministic rules: loop budget, effort, baseline, smoke and triage |
| `check-all.mjs` | After every step: hand-offs, gates, checkpoint and artifacts in one call |
| `gate-summary.mjs` | Build the question body at a human gate (2b, 3c, 10) |
| `diff-signals.mjs` | Decide from the real diff whether a change still fits its lane |
| `test-gate.mjs` | Step 7: run `test_command`, write the QA report from the exit code |
| `small-fix.mjs` | Fix lane step 11: a small fix gets script-written release notes, a bigger one the docs-writer |
| `task-usage.mjs` | Step 12: what the task cost in dollars (subagents plus Orchestrator), to compare runs; no target |

## Prerequisites

- A git repository and Node 18 or newer; the scripts have no other dependency.
- The muffy agents installed next to this skill ([INSTALL.md](../../INSTALL.md)).
- A `test_command` in the config file in `.team/`, for the test gate; setup writes it from the package manifest.

## Examples

- `/muffy feature "login with email and password"`: the full flow; the user approves the plan and design before any code.
- `/muffy fix "the cart total ignores the discount"`: the fix lane: diagnose, audit the cause, fix, review, test gate.
- `/muffy verify` on a branch someone already wrote: review and the test gate only; the branch is never edited.

## Limitations

- Never deploys and never touches staging or production; the run ends at a branch the user accepts.
- QA is a script (`test-gate.mjs`) that runs the project's test command; devs write unit tests only and regression testing is the human's.
- With no `test_command` in the `.team/` config file, the test gate reports itself skipped, never passed.

## Troubleshooting

- **A spawn is blocked:** a human gate (`pause:plan-review` or `pause:design-review`) has no answer yet; ask the user and record it with `checkpoint.mjs gate` ([hooks-enforcement.md](references/hooks-enforcement.md)).
- **Test gate says skipped:** add `{"test_command": "<your test command>"}` to the config file in `.team/` (the gate's own message names it).
- **A run stopped midway:** `/muffy resume` ([resume.md](references/resume.md)).

---

**Not for:** questions about the code, one-line edits with no behaviour risk (unless the request names a lane, such as `/muffy fix`), step-by-step iteration in main session. Research-only, review-only, design-only and spec-only requests are not refused: they route to the single agent that owns them ([route.md](references/route.md))
