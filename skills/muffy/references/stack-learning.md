# Learning a stack the team has no practices for

The coding-practices files cover some frameworks and languages. For any other, the team learns a short note from the official docs once per framework, keeps it in the repo (`docs/stacks/<framework>.md`), and every role that touches that stack reads the same note. What an agent does when it meets such a stack is the [stack ladder](../../../agents/references/shared/stack-ladder.md); how the researcher writes the note is its stack-note mode ([researcher workflow](../../../agents/references/researcher/workflow.md)). This file is what the Orchestrator does.

## When an agent returns `stack-unknown`
A `blocked` hand-off with a blocker `owner: Researcher`, problem `stack-unknown: <framework> <version>`:
- `docs/stacks/<framework>.md` already exists and is not stale → no researcher spawn: respawn the blocked role (round + 1) with the note in `Read:`
- Otherwise spawn `researcher` once with `Mode: stack-note`, the framework and version, at `model: "haiku"`, effort `low` ([token-discipline.md](token-discipline.md)). It is capped at L1, official docs only, 5 fetches and a ≤ 40-line note

## The Orchestrator, after each note
- Respawn the blocked role (round + 1) with `docs/stacks/<framework>.md` and its previous hand-off in `Read:` ([spawn-prompt.md](spawn-prompt.md))
- Run `node "<muffy>/scripts/check-stack-notes.mjs" --guard-entries` and merge the printed regex strings into `.team/regression-commands.json` (an array; keep what is there, add what is missing). This is how the full-regression guard ([hooks-enforcement.md](hooks-enforcement.md) §10) learns a runner it did not know. A runner with no `Whole-suite:` line stays unguarded: say so in the closing report
- Never run this as a normal research round, at L2 or L3, or more than once per framework and major version

## What a project can add without editing muffy
`.team/stack-extensions.json`: `{"manifests": ["mix.exs"], "skipDirs": ["deps"], "platforms": ["game"]}`. The onboard scan then lists those manifests and skips those folders, the baseline check counts those manifests, and the contract's `Platform:` accepts those values. A new platform also needs its routing (who builds it, what design and smoke mean) stated by the architect in the contract's Stack and by devops in `deploy.md`, since [platforms.md](platforms.md) only describes web, mobile, desktop and cli.
