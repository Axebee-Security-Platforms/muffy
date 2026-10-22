## Fix Profile

Read this only when the prompt has `Profile: fix`. The task has `fix.md` instead of `ac.md`, `contract.md`, `brief.md` and `design.md`; do not look for those.

**Step 4a: diagnose, no code.** Work inside your worktree.

1. Read `fix.md` and only the files it names. Reproduce first: run the failing test or command, or write one that fails. If you cannot reproduce, say so; do not guess
2. Trace the failing path from symptom to cause. State one hypothesis, then check it against a second piece of evidence (a second input, a log line, a `git log -p` of the file). If it does not hold, drop it
3. Write `## Cause` (one line + confidence) and `## Repro` in `fix.md`. Do not edit anything else and do not change source files yet. **Flow diagram, only if needed:** when you cannot find the cause without first understanding a flow that spans three or more participants (client, API, DB, queue, third party) or whose ordering is not obvious, you may write `.team/<task>/flow.html`: one flow diagram (`kind: flow`) of that flow as the code runs it, copied from the template and styled per [diagram-style.md](../shared/diagram-style.md) (at most 12 steps, every step labelled, `fail: true` on the failing step), then run `node .claude/skills/muffy/scripts/check-diagram.mjs` and `check-diagram-render.mjs` on it and fix a layout FAIL before hand-off. Draw it from the code you traced, never from memory; mark anything unconfirmed `verify: true`. Link it from `## Cause` and list it in `paths_written`. No other diagram, none when the cause is already clear, and it is not copied into `docs/`
4. Hand-off: step `4a`, `ac_ids_done: []`, and `diagnosis`:
   - `known`: confidence medium or high, with `cause`, `files`, `repro`
   - `unknown`: `reason` says what evidence is missing (a log, a repro, an environment detail)
   - `needs-full-flow`: the cause is in the contract, a dependency, the stack or a design decision; `reason` says which. Do not work around it

**Step 4: fix.** The Orchestrator continues you with `SendMessage`, so keep what you read. Change only the files in `diagnosis.files` plus tests. Add a regression test that fails before the fix and passes after; run it both ways and say so. Cosmetic: use existing design-system tokens only, no new component, and show the visual check named in the AC. More than 5 source files, or a need to touch the contract, a dependency or the stack: stop, do not work around it, and hand off `status: blocked` with a blocker `owner: Architect` whose `problem` says which limit was hit (`needs-full-flow` exists only in a step-4a `diagnosis`). The Orchestrator promotes the task to the full flow. Hand-off step `4`, `ac_ids_done` from `fix.md`.

Brain note: append at most 5 lines (cause, fix, files, test). Skip the PR diagram.
