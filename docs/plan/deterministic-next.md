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
