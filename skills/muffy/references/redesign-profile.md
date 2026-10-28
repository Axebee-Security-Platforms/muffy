# Redesign profile: change an existing screen, UX/UI or business-logic flow

A lane for work that changes something the product already has: a screen, a UX flow, or the rules behind a flow. It is not a new capability (that is the full flow) and not a bug (that is the fix lane). It skips research and runs only the agents the chosen scope needs. Start it with `/muffy redesign <request>`, or when the route picks it ([route.md](route.md)). Everything not listed here follows the normal flow.

## Triage (Orchestrator, no agent)

It is a **redesign** only if all hold; otherwise say which fails in one line and take the route that fits:

1. The screen, flow or rule already exists in this repo (check with Grep/Read; do not ask when the repo answers)
2. Not a bug: nothing that worked is broken (a symptom goes to the fix lane)
3. Not a new capability: the system already offers this to its users (a capability it lacks goes to the full flow)
4. A user or caller can see the change (invisible internal work goes to the lite lane)

A prompt that fits two routes is asked, not guessed ([route.md](route.md) decision order 7).

## Scope question (`pause:scope`, always asked, never defaulted)

Two calls, since the plan card depends on the scope: the **Scope** question alone, then one call with the plan card's question ([route.md](route.md#say-the-plan)), **Base** and **Announcement**:

- **Scope**, worded for the requester: **เปลี่ยนแค่หน้าตา / the look only** (`ui-only`: screens and UX, no backend change) / **เปลี่ยนทั้งหน้าตาและกฎ / the look and the rules** (`ui+logic`: screens and the rules or API behind them) / **เปลี่ยนแค่กฎเบื้องหลัง / the rules only** (`logic-only`: backend rules, no screen change). Recommend the look only when the prompt names no rule, permission, calculation or state
- **Base** (only when `main` and the current branch differ): recorded as `base:` in checkpoint `## Status`
- **Announcement** (user-facing change only; off by default): yes puts `announcement: yes` in the docs-writer prompt

## Setup-lite (replaces [setup.md](setup.md))

1. Name the task `redesign-<slug>` and run the common setup, [setup.md](setup.md) steps 1-4: brain and task note, the baseline check with `next-action.mjs baseline --lane redesign`, then `project.md` Lessons and Open issues. Write the held `baseline` value into `## Status` with the checkpoint
2. Create the feature worktree from `<base>`: `git worktree add .worktrees/feature-<task> -b feature/<task> <base>` (a baseline committed at the common setup on another branch is cherry-picked onto it first, [setup.md](setup.md) step 7), then `.team/<task>/`, `handoff/` and `rounds/` inside it
3. Write `checkpoint.md`, then its lane line with `node .claude/skills/muffy/scripts/checkpoint.mjs profile .team/<task> redesign --scope <scope>`, where `<scope>` is `ui-only`, `ui+logic` or `logic-only`; it adds the steps the table below skips for that scope (`--skip 3d` adds a run's own). `gate-rules.mjs` reads this line
4. No `brief.md`: the prompt and the existing code are the brief

## Steps by scope

| # | Agent | ui-only | ui+logic | logic-only |
|---|---|---|---|---|
| 1 | `researcher` | skipped | skipped | skipped |
| 2 | `product-manager` | `ac.md` from the current screens and the request | same | `ac.md` from the current rules and the request |
| 2b | Human gate `pause:plan-review` | **skipped**: `checkpoint.mjs gate 2b skip --reason "combined with the design gate"`; the AC are shown at 3c | asked | asked |
| 3 | `designer` ∥ `architect` ∥ `devops` mode 1 | `designer` only | `designer` ∥ `architect`; devops mode 1 only for a migration or when there is no `deploy.md` | `architect`; devops mode 1 as left |
| 3b, 3e | publish canvas, diagrams | as the full flow | as the full flow | skipped (no canvas) |
| 3c | Human gate `pause:design-review` | design + AC together | design + contract | **contract gate**: the contract and the AC ([gate-summary.mjs](../scripts/gate-summary.mjs) shows them when `design.md` is absent) |
| 3d | `devops` mode 2 | only on a smoke trigger ([run-profile.md](run-profile.md)) | same | same |
| 4 | dev | `frontend-dev` | `frontend-dev` ∥ `backend-dev` | `backend-dev` |
| 5, 6 | merge, `code-reviewer` | as the full flow | as the full flow | as the full flow |
| 7 | `qa-tester` | L3, limited to the pages the diff touched | L3, pages and endpoints the diff touched | L3 with no UI e2e, endpoints and flows the diff touched |
| 10 | Human gate | accept the branch | accept the branch | accept the branch |
| 11 | `docs-writer`, after the gate approves | changelog and user docs of the changed pages | those plus API docs and the changed business rules | API docs and the changed business rules |
| 12 | Orchestrator | [closing.md](closing.md) in full | same | same |

Rules for the table:

- **`ac.md` for a redesign** lists each change as an `AC-<n>` and adds `## Unchanged`: the behaviours of the touched screens or rules that must stay as they are. QA covers both. No plan phases and no product ADR unless a product decision is made
- **The designer** reads the current screens (running page URL, screenshots or the component files) and `docs/design-system/`; `design.md` shows before and after for each screen. Tokens come from the design system; a new component or colour is a design-system change that the gate lists
- **The architect** writes a contract for the changed rules only and reads the current code; it does not redesign what the request leaves alone
- **QA scope is by path.** The Orchestrator maps `git diff --name-only <base>...<branch>` to pages, routes and endpoints and writes them into the qa-tester `Read:` line with the `## Unchanged` rows for them. `test-level` is `L3`. A touched shared component or module that other pages use is a trigger to offer `pause:full-regression` ([test-levels.md](test-levels.md)); QA never widens on its own
- **`docs-writer` always runs in this lane** (no skip rule). It follows step 11 of [steps.md](steps.md): after the Human gate, only what the diff touched, a Deploy hand-off, a self-check instead of a review
- **Never skipped:** 2, 6, 7, 10, 11, and 3c whenever a designer or architect ran

## When a UI-only run needs logic

A designer or frontend-dev who finds the design needs a field, endpoint or rule the backend lacks does not invent it and does not edit the backend. It returns a `blocker` with `owner: Architect` and a `problem` that starts `needs-logic:` followed by what is missing.

1. Orchestrator saves `pause:scope-upgrade` and asks one `AskUserQuestion`: **add the logic** (becomes `ui+logic`) or **cut that part from the design** (stays `ui-only`)
2. Add: keep the work done, record the new scope with `checkpoint.mjs profile .team/<task> redesign --scope ui+logic`, run `product-manager` to revise `ac.md`, ask gate 2b (it is no longer skipped), spawn `architect` for the contract, then `backend-dev` after the gate. Nothing is redone
3. If the missing piece is a whole new capability (several endpoints or a new data model), say so in the question and offer the full flow as a third option
4. At most once per task. A second `needs-logic:` stops the run and the user decides in chat

## Model and effort

Defaults from [token-discipline.md](token-discipline.md); never downgrade `code-reviewer`, `architect` or `devops`. `qa-tester` re-running existing tests only may use `haiku`.

## Prompt differences

No `Profile:` header: this lane reads the usual `ac.md`, `design.md` and `contract.md`, minus `brief.md`. Build each prompt with `make-envelope.mjs --scope <scope>`, which puts `Scope: ui-only | ui+logic | logic-only` in the header, so no agent works outside it. `Read:` for `qa-tester` carries the touched paths and the `## Unchanged` rows.
