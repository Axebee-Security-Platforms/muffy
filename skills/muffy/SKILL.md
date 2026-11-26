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

Open a reference only when a mode or a rule below needs it; subagents do the same through the "Load on demand" table in their own definitions. If this file is already in the session (after a compact or a resume too), follow it from where you are; do not invoke `/muffy` again to reload it.

**Resume** (`/muffy resume`, "continue", ทำต่อ): [references/resume.md](references/resume.md). **Headless** (env `MUFFY_HEADLESS=1`, a `claude -p` run with no question tool): read [references/headless.md](references/headless.md) before the first question; every question becomes `.team/<task>/gate.json` plus `checkpoint.mjs ask`; never `AskUserQuestion`, never an answer of your own.

**Route.** On a free-text request, read it into signals and run `node "<muffy>/scripts/route.mjs" '<signals json>'` ([route.md](references/route.md)): it prints the route and the lane to start, or the one question to ask. Skip it when the request starts with a mode command (`/muffy onboard | present | diagram | resume <task> | fix | lite | redesign | feature`): the command is the route. A bare `/muffy` or `/muffy todo`: [menu.md](references/menu.md), [todo.md](references/todo.md).

**Lanes** (fix, change, verify, upgrade, the full flow) are run by `next.mjs`, not by you. Read the request into flags and start it: `node "<muffy>/scripts/next.mjs" start --lane fix|change|verify|upgrade|feature --task <slug> --request "<verbatim>" …` (no `--lane` is the fix lane). The flags per lane, the rest is in the script's header:
- fix: `--scope bug|cosmetic --owner FE|BE|both --symptom … --ac "AC-1 | result | check"`
- change: `--scope internal|ui-only|ui+logic|logic-only`; internal also `--kind refactor|perf|internal-api|db --owner … --ac …`
- verify: `--branch <theirs> --base <base> --ac …`; upgrade: `--target "<package from to>"`
- feature: `--skip designer,frontend-dev,3b,3c` for a change with no UI

Then do only what the `action=` line says: `spawn` (copy the prompt between the `---prompt---` lines into one Agent call with the `agent` and `model` it names; several blocks start in one message), `ask` (the `---questions---` JSON to `AskUserQuestion`; headless: follow `then=`), `do` (a step only you can do, such as publishing the canvas or the UX review: do its `instruction=` lines, then run the command in `then=`), `wait` (an agent is still running), `route`, `stop`, `onboard`, `done`. After an agent returns run `next.mjs step <task>`; after the code-reviewer pipe its whole message to `next.mjs review <task>`; the user's answer to a question goes to `next.mjs answer <task> "<label>"` (`Request changes: <what>` sends the roles back). Headless runs stop at every gate with `muffy-status: waiting:<gate>`; the answer line the person leaves lets `step` go on. A request that names a lane is never cut down to a direct edit because the work looks small. `stop` with `outcome=environment` is not a failure of the work: fix the environment, then `next.mjs step <task> --rerun`. Do not open `setup.md`, `steps.md`, `step-details.md`, `closing.md` or a lane's `*-profile.md` to run a lane: the script has done what they describe. Read only the triage section of the profile to fill the flags.

**References for what the lanes do not cover, and for people reading how it works** (open only when needed):
- Modes: [onboard.md](references/onboard.md) (asked once when a task finds no usable baseline, or `/muffy onboard`), [present.md](references/present.md) and [doc-request.md](references/doc-request.md) (`/muffy present`), [diagram.md](references/diagram.md) and [diagram-export.md](references/diagram-export.md) (`/muffy diagram`)
- The lanes as documents: [run-profile.md](references/run-profile.md) (the lane table, skips, pauses), [fix-profile.md](references/fix-profile.md) (`/muffy fix`), [change-profile.md](references/change-profile.md) (`/muffy lite`, `/muffy redesign`), [upgrade-profile.md](references/upgrade-profile.md), [verify-profile.md](references/verify-profile.md); `/muffy feature <request>` runs every step and skips only the route and the fix/change triage, never a gate
- The steps: [setup.md](references/setup.md), [steps.md](references/steps.md), [closing.md](references/closing.md), [platforms.md](references/platforms.md) (a `Platform:` other than `web`), [diagram-publish.md](references/diagram-publish.md), [design-review.md](references/design-review.md), [requirements.md](references/requirements.md), [test-levels.md](references/test-levels.md)
- Rules: [loops.md](references/loops.md), [token-discipline.md](references/token-discipline.md), [memory-model.md](references/memory-model.md), [stack-learning.md](references/stack-learning.md), [baseline-freshness.md](references/baseline-freshness.md), [adr-writing.md](references/adr-writing.md)

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
- Run only the phases the plan marks for this run. A lane is silent (hand-off JSON between agents, no `SendMessage`). A run that outgrows its lane moves up the [promotion ladder](references/run-profile.md#promotion-ladder) to the smallest lane that fits, never patched on
- FE/BE report a temporary stack → stop, send to architect (+ ADR) before coding continues
- An agent writes outside its vault folder → revert it and resend its rule; an agent can't find `<brain>` → `AskUserQuestion`
- No agent deploys, rolls back or touches staging or production: work ends on docker local at the Human gate. The user deploys from the Deploy hand-off
- Never Read, grep or print `.env*` files in full; check that a variable exists and its prefix is right, by name only ([hooks-enforcement.md](references/hooks-enforcement.md) §6). A key shown or pasted in chat → rotate it; log the rotation in checkpoint `## Open blockers`
- Every commit by every agent ends with the run's `Commit trailer`, passed in the prompt envelope. The Orchestrator copies it verbatim from the attribution line its harness provides; no model name is hard-coded in this skill. If the harness gives none, ask once at setup
- Pauses are named (`pause:<id>`) and only the ones in [run-profile.md](references/run-profile.md); each records its resume condition in checkpoint `## Status`
- Worktrees are created and removed only by the Orchestrator (`next.mjs` does it for a lane it runs; [setup.md](references/setup.md)), never on the fly: the role worktrees when the Human gate approves, the feature worktree at closing, with `remove-worktrees.mjs`, never forced; branches stay

## Quality Checks

Verify after every step: run `node "<muffy>/scripts/check-all.mjs" .team/<task> --step <s> --round <n>` and act on its `next=` line, then the judgment checks: [references/quality-checks.md](references/quality-checks.md)

## Scripts

The ones the Orchestrator runs every task (`node "<muffy>/scripts/<name>.mjs" …`); the rest are called from the references.

| Script | Use it |
|---|---|
| `init-config.mjs` | Setup: writes the project's `test_command` into the config file in `.team/`, from its package manifest |
| `checkpoint.mjs` | Write the checkpoint: rounds, pauses, gate answers, the lane line |
| `make-envelope.mjs` | Build each subagent prompt from flags, not by hand |
| `route.mjs` | The route decision order of route.md: signals in, route or the one question out |
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
