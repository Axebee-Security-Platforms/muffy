# Resume

A new session has no memory of the run. Everything it needs is in `.team/<task>/checkpoint.md`, so the run must leave a trail a cold start can find, and a cold start must know to look.

## Triggers

`/muffy resume [task]`, or a request that continues earlier work with no new feature: "continue", "resume", "pick up where we left off", ทำต่อ, ต่อจากเดิม, ทำงานต่อ. Do not start a new run, `pause:scope` or setup for these.

## Cold start (new session)

1. Find the task, reading as little as possible:
   - **Index first**: `<brain>/project.md` → `## Tasks`. Rows marked `in progress` are the unfinished tasks; no checkpoint is opened to learn this
   - **No vault or no project.md**: `grep -m1 "^Updated:" .team/*/checkpoint.md` (also under `.worktrees/*/`), then read only the `## Status` of those; a task whose `## Status` says `closed` is finished
   - One unfinished task → use it. Several → `AskUserQuestion` listing each task with its `Updated:` line. None → say there is nothing to resume and ask what to build
2. Read only that task's `checkpoint.md` and `<brain>/tasks/<task>.md`. The first line of `## Run profile` names the lane (`lane: fix`, `lane: lite`, `lane: redesign (<scope>)`; older checkpoints wrote `fix:`, `lite:` or `redesign lane (<scope>):`): read [fix-profile.md](fix-profile.md), [lite-profile.md](lite-profile.md) or [redesign-profile.md](redesign-profile.md) before continuing. `lane: feature` or no lane line is the full flow. Do not replay old conversations or re-read finished artifacts
3. Check the repo against the checkpoint: `git status --short`, `git branch --list '*/<task>'`, `git worktree list`. The checkpoint is a cache: if it disagrees with an ADR, `contract.md`, a hand-off file or git, the other source wins and the checkpoint is corrected
4. Missing or stale `.team/` (nothing committed, wrong branch) → look on the task's branches (`ops/`, `fe/`, `be/`, `feature/`) with `git log --all -- .team/<task>`, tell the user which branch holds it, and ask before switching
5. State one line to the user: task, step reached, pause or blocker, next action. Then continue from `## Status` → `next:`. Paused → wait for its resume condition ([run-profile.md](run-profile.md#named-pauses)); never re-ask a question the checkpoint records as answered
6. Rewrite `checkpoint.md` (`Updated:` line) before the first spawn. Spawned agents get the usual prompt envelope plus `Checkpoint: <path>`; they never discover the run themselves

## Leaving a trail (every stop)

Before a pause, an escalation, a long conversation or any stop the user may continue elsewhere:

1. Rewrite `checkpoint.md`; `## Status` ends with `next: <step> · <owner> · <action>`
2. Update the vault task note's status
3. Commit `.team/<task>/` (checkpoint, rounds, hand-offs) to the task's branch, so a worktree or a fresh clone sees it
4. End the message with the resume line, for the user to paste into the new session:

```
/muffy resume <task>
```
