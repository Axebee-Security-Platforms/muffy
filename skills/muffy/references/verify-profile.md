# Verify profile: review, test and accept a branch someone already wrote

For a branch the requester (or someone else) wrote by hand: "ตรวจ branch นี้ให้ครบก่อน merge", "review and test this before I merge". The code exists, so research, product, design and the build are skipped; `code-reviewer`, `qa-tester` on docker local, the Human gate and `docs-writer` run on it. "Just review it" (no tests) is the `review` route, and "just test it" the `qa` route ([route.md](route.md)); verify is all of them in order, with the gate.

**The requester's branch is never edited or merged.** The run works on a copy, `verify/<task>`, cut from it. Muffy merges nothing into the requester's branch; the requester merges the copy (or not) themselves.

## Setup-lite (replaces [setup.md](setup.md))

1. Name the task `verify-<slug>` and run the common setup, [setup.md](setup.md) steps 1-4, with `next-action.mjs baseline --lane verify` (a quick baseline is enough)
2. Find the branch and its base: the branch the request names (ask once if it names none), and its base (`main`, or the branch it was cut from). Read the PR description or the request for what the change should do
3. `pause:scope`, one `AskUserQuestion` call: **Plan** (the card from `next-action.mjs plan-card verify`, go / bigger), **AC** (the AC list drafted from the PR description or the request: what the change should do and what must stay as it was; Confirm / Change it), **Branch and base** (confirm both)
4. Create the copy as the task's worktree: `git worktree add .worktrees/feature-<task> -b verify/<task> <their branch>`, then `.team/<task>/`, `handoff/` and `rounds/` inside it. Write `.team/<task>/ac.md` there (the internal-scope format of [change-profile.md](change-profile.md#acmd), with `Scope:` replaced by `Lane: verify` and a `## Unchanged` list when the request names one) and commit it to `verify/<task>`
5. Write `checkpoint.md`, then its lane line with `node "<muffy>/scripts/checkpoint.mjs" profile .team/<task> verify`

## Steps

| # | Agent | Notes |
|---|---|---|
| 3d | `devops` mode 1 then 2 | Only on a smoke trigger ([run-profile.md](run-profile.md)): the branch bumps a dependency, a runtime or devops-owned files. In an `ops/<task>` worktree cut from `verify/<task>`; otherwise `--skip 3d` on the lane line |
| 6 | `code-reviewer` | The diff `<base>...verify/<task>` against `ac.md`; there is no `contract.md`, so the reviewer judges against the AC and the codebase's own conventions (`baseline.md`) |
| 7 | `qa-tester` | On docker local, worktree cut from `verify/<task>` at step 7: `git worktree add .worktrees/qa-<task> -b qa/<task> verify/<task>`. Level **L3** on the paths the diff touched (map them as [change-profile.md](change-profile.md#steps-by-scope) says for a visible change); offer `pause:full-regression` when the diff touches a shared module |
| 10 | Human gate | The review verdict and `qa-report.md`. Approve means "this branch is ready to merge", not "deploy"; the requester merges their own branch. On Approve, remove the role worktrees as [step-details.md](step-details.md#step-10) says |
| 11 | `docs-writer`, after the gate approves | Changelog or release notes for the diff and a Deploy hand-off, only when the diff changes something a user sees, a migration or config; otherwise `docs skipped: <reason>` |
| 12 | Orchestrator | [closing.md](closing.md) in full |

## A reject or a QA fail

The loop does not send it to a dev on its own (`next-action.mjs` answers `ask:verify-fix`). The Orchestrator reports the findings (the review's blockers, the failing AC) and asks once, in one `AskUserQuestion`:

- **Fix on the copy (recommended when the fixes are small)**: the owners the blockers name (`frontend-dev`, `backend-dev`) fix on worktrees cut from `verify/<task>`, the Orchestrator merges them into `verify/<task>`, then review and QA run again under the usual loop limits ([loops.md](loops.md)). The requester's branch stays as it was; they can merge `verify/<task>` or take the commits
- **Report only**: close with the findings per [closing.md](closing.md#stopped-at-a-stop-point) (outcome `reported`, checkpoint `closed · reported`); the requester fixes their branch and runs verify again

The answer is recorded in checkpoint `## Status` as `verify fix: on copy` or `verify fix: report`, and it holds for the rest of the task: a later reject goes straight to the owners after "on copy".

## Model and effort

`code-reviewer` is never downgraded. `qa-tester` re-running existing tests only may use `haiku`.

## Prompt differences

No `Profile:` or `Scope:` header. `Read:` lists `ac.md`, the diff and `baseline.md`; there is no `brief.md`, `design.md` or `contract.md`.
