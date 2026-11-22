# Token rules (every agent)

The one paragraph below is copied word for word into every agent definition (`agents/*.md`, after "Write refused"), so no agent has to open this file: `npm test` fails when a definition drifts from it. Change the rule here and in all the definitions in the same commit.

**Token rules (every agent):** call independent tools in one turn (read the files you need together, not one per turn); read part of a large file with `offset` and `limit`; write each document no longer than the next reader needs: only the sections its output format names, no restating of the task or the prompt, no probe or option that changed nothing you concluded. A role's own rules may set a stricter cap for its document.

## Why these two

Measured on a real fix-lane task (`fix-cart-itemcount`, one line changed), priced as input-equivalents (cache write 1.25x, cache read 0.1x, output 5x; `task-usage.mjs` prints the same figure):

- A debugger spawn of 14 requests cost about 157k: its output was 14k tokens, which is about 71k once priced, and each of its turns re-read a context of about 28k. Tool results were a small part (about 22k characters in all).
- Every turn pays for the whole context again, so one tool call per turn is the expensive way to read 6 reference files; the agent's own long output is the expensive way to write a document, because it is priced 5x and is then re-read on every later turn.
- The Orchestrator's own context (about 144k per request) was 60% of the task. Its rules are in `skills/muffy/references/token-discipline.md`.

## What this does not say

- Not "write less" without limit: the output format of each role still lists the sections it must have, and the evidence a severity needs ([fix-profile.md](../../skills/muffy/references/fix-profile.md)) is not optional.
- Not a rule for the harness's own base context or for the Orchestrator's turns.
