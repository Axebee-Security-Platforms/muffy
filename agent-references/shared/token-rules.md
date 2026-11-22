# Token rules (every agent)

The one paragraph below is copied word for word into every agent definition (`agents/*.md`, after "Write refused"), so no agent has to open this file: `npm test` fails when a definition drifts from it. Change the rule here and in all the definitions in the same commit.

**Token rules (every agent):** call independent tools in one turn (read the files you need together, not one per turn); read part of a large file with `offset` and `limit`; write each document no longer than the next reader needs: only the sections its output format names, no restating of the task or the prompt, no probe or option that changed nothing you concluded. A role's own rules may set a stricter cap for its document.

## Why these two

Measured on real fix-lane tasks (one line changed each) and priced in dollars by `task-usage.mjs`:

- A debugger spawn of 14 requests re-read a context of about 28k on every turn, and its output (14k tokens) was the largest part of its cost; its tool results were small (about 22k characters in all). One tool call per turn is the expensive way to read 6 reference files, and a long document is expensive to write because output is priced several times an input token and is then re-read on every later turn.
- In dollars the effect is small where the agent runs on `haiku` (the debugger: about a cent a task) and larger on the dearer models (the `opus` auditor: about $0.15). The rules are cheap hygiene that keeps that from growing; they are not where most of a task's money goes.
- The Orchestrator was about two thirds of a task's cost (its context is re-read on every request). Its rules are in `skills/muffy/references/token-discipline.md`.

## What this does not say

- Not "write less" without limit: the output format of each role still lists the sections it must have, and the evidence a severity needs ([fix-profile.md](../../skills/muffy/references/fix-profile.md)) is not optional.
- Not a rule for the harness's own base context or for the Orchestrator's turns.
