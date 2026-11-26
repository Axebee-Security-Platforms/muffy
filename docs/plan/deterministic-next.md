# Plan: `next` drives the flow (muffy 2.0.0)

Agreed 2026-11-26. Goal: lower cost and less run-to-run variation.

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Goal | Lower cost and less variation |
| 2 | Depth | A `next` script gives the Orchestrator one step at a time. The Orchestrator stays an LLM |
| 3 | Scope | Every lane ships together |
| 4 | Uncommitted agent refactor | Committed first, on its own |
| 5 | Success | Offline scenarios show a fixed result for every lane; fix-lane requests measured before and after |
| 6 | Task state | Derived from `checkpoint.md`, `handoff/`, `spawns.tsv` and git. No `state.json`. A missing fact becomes a `## Status` line written by `checkpoint.mjs` |
| 7 | Side effects | `next` does bounded local file and git work. Never push, never touch `<base>`, no `--force`, no `reset`, no deploy. It stops on a conflict, a dirty or colliding worktree, a repeated invalid hand-off and every human gate. `--dry-run` writes nothing |
| 8 | Routing | The LLM reads the request into typed signals; a script picks the route or returns the question |
| 9 | References | Cut what `next` does; keep only judgment content; shrink `SKILL.md`. Scripts are the source of the rules |
| 10 | Semi-judgment | Typed `failure_kind: work \| environment` in the hand-off (default `work`); a fixed `model-fail: <role> haiku` line written by `checkpoint.mjs spawn` |
| 11 | Spawn prompt | `next` writes the envelope to a file; the Agent prompt is the `Task:` header and the path. Guards read the file and fail closed |
| 12 | Delivery | Phases on one branch, one merge, release 2.0.0 |

## Defaults (changeable)

- **Measurement:** one fixture repo at a fixed commit with 3 known bugs, run headless (`MUFFY_HEADLESS=1`) in phases 0, 1 and 5, same harness and model each time. Primary metric: Orchestrator requests per task. Secondary: dollars (`task-usage.mjs`).
- **Phase 1 go/no-go:** mean requests fall at least 30% from the phase 0 baseline. Otherwise stop and discuss.
- **`next`** is a new `skills/muffy/scripts/next.mjs` that imports the rules from `next-action.mjs`.
- **Git:** the refactor on `refactor/agent-core`, this work on `feat/deterministic-next` cut from it. No merge into `main` and no push without an explicit request.

## Phases

Each phase ends with `npm test` passing and its own commit.

0. Commit the pending refactor; measure the fix-lane baseline (3 tasks).
1. `next` core (state, `--dry-run`, git prohibitions with tests) and the whole fix lane with scenarios; one real run; go/no-go.
2. change, verify, upgrade and the full flow.
3. Routing from signals, `failure_kind`, `model-fail`.
4. Envelope files and guard changes.
5. Cut references, update the evals that compare them with the scripts, measure again, release 2.0.0.

## Open risks

- Which guards read fields from the spawn prompt is not yet checked; the Bash allowlist must permit the `next` call.
- Git writes made by `next` are invisible to the hooks, so its prohibitions need their own tests.
- Each measurement round costs real money (about US$3 to 4 for 3 tasks at earlier prices).

## Phase 0 result (2026-11-26)

Bench: `scripts/measure-fix.mjs`, muffy `ed756c8` (tag `bench/phase0`), Claude Code 2.1.330, model sonnet, `--permission-mode auto`, headless, user settings and MCP left out, 3 cases x 1 run.

| Case | What the run did | Requests | Cost |
|---|---|---|---|
| item-count | Ran the fix lane: debugger, auditor, dev, reviewer; stopped at the Human gate in its final message (rule H3 says continue) | 25 | $0.74 |
| max-price | Never started the lane: fixed it in the main session ("one-token change") | 5 | $0.14 |
| last-item | Never started the lane: fixed it in the main session | 4 | $0.13 |

Rerun, 3 runs per case (9 in all; r2 and r3 on `83aff06`, which differs from `ed756c8` only in docs and the bench):

| Case | Lane completed | Requests of those runs | Runs that skipped the lane (requests) |
|---|---|---|---|
| item-count | 2 of 3 | 25, 22 | 1 (4) |
| max-price | 0 of 3 | none | 3 (5, 4, 5) |
| last-item | 0 of 3 | none | 3 (4, 4, 6) |

**Baseline: the lane ran in 2 of 9 runs (22%). Completed runs: 22 and 25 requests, US$0.60 and $0.74, 4 subagents each, both stopped at the Human gate (rule H3 says continue). The 7 other runs fixed the bug in the main session for 4 to 6 requests and about $0.13, with no debugger, auditor or review.** No permission denials in any run.

Reading: with `/muffy fix` named in the request, a one-line bug with a visible cause usually skips the lane. Phase 1 therefore compares two numbers against this table: lane completion (target 9 of 9) and requests per completed run (baseline about 23.5). A cheaper run that skips the lane is not a saving. The 30% bar applies to the second number only.

## Phase 1 result (2026-11-26)

`next.mjs` drives the fix lane; `SKILL.md` sends the lane to it. Same bench, same fixture, same CLI (2.1.330), sonnet, `--permission-mode auto`, headless; muffy `fd3747b` (tag `bench/phase1`), 3 runs per case.

| | Phase 0 (`ed756c8`) | Phase 1 (`fd3747b`) |
|---|---|---|
| Runs that completed the lane | 2 of 9 | **9 of 9** |
| Requests per completed run | 22, 25 (mean 23.5) | 14, 13, 18, 14, 15, 14, 17, 14, 16 (**mean 15.0**, range 13 to 18) |
| Cost per completed run | $0.60, $0.74 | mean $0.59 (range $0.54 to $0.72) |
| Permission denials | 0 | 0 |

Go/no-go bar: lane completion 9 of 9 and mean requests at most 16.5 (30% under 23.5). Both met: 36% fewer requests, and no run skipped the lane. **Go.**

Caveats, stated as they are:
- Two of the nine runs (last-item r1 and r3, 14 requests each) stopped at the Human gate instead of closing. Cause: an agent's summary held `items[items.length]`, and checkpoint.md reads `[word]` as a link label (`check-checkpoint.mjs` failed, so `checkpoint.mjs ask` printed no `next=continue`). Fixed in `5b16720` with a test that fails without the fix. Those two runs miss the closing requests, perhaps 1 to 2 each; counting 2 more for each of them gives a mean of 15.9, still under the bar. Phase 5 measures again on the final version.
- Cost fell less than requests (about 20%): one run's debugger rated severity high, which sends the fix to the docs-writer and the dearer subagents; that is the agents' judgment, not the script's.
- One bench fixture (a small JS library, one-line bugs); the numbers compare versions, not real projects.

## Phase 2 result (2026-11-26)

`next.mjs` now drives every lane: verify, change (internal, ui-only, ui+logic, logic-only), upgrade and the full flow, through `next-flow.mjs` (one engine over `lanes.mjs`, calling the rule scripts that exist). `SKILL.md` routes each lane to it.

Checked offline, on real temp repos with the agents and the user played by `scripts/lib/next-flow-evals.mjs` (about 45 checks; the fix lane's 22 still pass): the same actions on a second run for verify, change (internal), upgrade and the full flow; nothing written before the scope is approved; plan, design and Human gate each ask, and Approve, Request changes and Reject lead where they should; an invalid hand-off is retried once and then stops; a reviewer Reject and a failing test gate go back to the owners, and a third failing test round escalates; an agent's questions go to `requirements.md` with at most 2 rounds; designer and architect start together and a second `step` waits for the running one; headless runs wait at the scope, plan and Human gates and resume from the recorded answer; the requester's branch and the base never move in verify.

An outside review of this phase found five gaps the first evals could not see; all are fixed and tested: a run that printed a `warning=` or `error=` line passed unnoticed (the evals now fail on one: it caught a checkpoint over its 40-line cap after about ten hand-offs, a round file written twice for two agents that ran side by side, and an invalid hand-off logged as a spawn); verify took the current branch as the base (now `--base` is required and may not equal `--branch`); the "nothing pushed" check had no remote (now a bare origin per engine keeps every ref, and a static check bans push, reset, force, branch delete and checkout in the git calls); ui-only and ui+logic had no scenario; a headless interview with two questions read every answer as the default.

What is not covered, stated as it is:
- No live model run of the non-fix lanes. A headless non-fix run stops at the very first gate (the scope question: rule H3 is the fix lane's), so a live check needs an interactive session or answer lines left between runs. The cost target of this plan is the fix lane; a full-flow run costs several times more and cannot finish headless (the canvas needs an artifacts tool, which the bench leaves out). Ask before running any.
- Not driven by `next.mjs`: step 5b PR diagrams, a lane line with a stop point (`until`; the script stops and says so), promotion between lanes (a blocker owned by a skipped agent: the script stops with the blockers and says what the reference says), onboard, present, diagram and todo modes.
- Steps that need the model or an outside tool (publish canvas, publish diagrams, UX review, the breaking-change AC of an upgrade) are `action=do`: the script checks a `## Status` line that `next.mjs record` writes and never marks them done itself.
- The fix lane keeps its own code path in `next.mjs`; both paths share the helpers. Merging them is not needed for the plan.
