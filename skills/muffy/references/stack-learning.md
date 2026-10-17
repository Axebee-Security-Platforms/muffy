# Learning a stack the team has no practices for

The coding-practices files cover some frameworks and languages. For any other, the team learns a short note from the official docs once per framework, keeps it in the repo, and every role that touches that stack reads the same note. Nothing is filled from memory.

## The ladder (any agent that writes or runs code for a stack with no file of its own)
Stop at the first step that gives enough to do the work correctly.
1. **A note exists:** `docs/stacks/<framework>.md`. Run `node .claude/skills/muffy/scripts/check-stack-notes.mjs <framework>`. `fresh` or `unchecked` → read it and use it as the stack file. `stale` (the note is for another major version than the manifest uses) → treat it as missing
2. **Local sources only, no web:** the version in the lockfile, the package's README and types in its installed folder, the repo's existing code and `docs/architecture/baseline.md`. If the repo already has working examples of the idiom you need, follow them and say which stack you assumed
3. **Still unsure** about what changes correctness (data flow, error handling, concurrency, routing, build and test commands): do not guess. Return `status: blocked` with a blocker `owner: Researcher`, problem `stack-unknown: <framework> <version>` (add `(note is for <old>)` when stale). The Orchestrator gets a note written and resumes you

Who uses it: `frontend-dev` and `backend-dev` to write code; `architect` when the chosen stack has no practices file (raise the blocker before the contract is final, so FE and BE do not hit it later); `qa-tester` to learn the scoped and whole-suite test commands before running anything; `devops` for build and run commands in mode 2; `code-reviewer` reads the note for each stack in the diff, so it judges the code by the same rules it was written to.

## The note (researcher, `mode: stack-note`)
Capped: official docs only, at most 5 fetches, at most 40 lines, one H2 title then bullets only. First line `Source: <url>, version <v>, <date>`. One bullet per rule valid for that version, ordered: structure, state or data, errors, performance, tests, then commands as bullets that start `Build:`, `Run:`, `Lint:`, `Test (scoped):` and `Whole-suite:` (the command that runs every test, exactly as the repo runs it). Anything the pages did not confirm is `[verify]`; gaps are listed, not filled. If a note exists for another major version (stale), rewrite it for the new one; if it is fresh or unchecked, do nothing.

## The Orchestrator, after each note
- Resume the blocked agent with `SendMessage`
- Run `node .claude/skills/muffy/scripts/check-stack-notes.mjs --guard-entries` and merge the printed regex strings into `.team/regression-commands.json` (an array; keep what is there, add what is missing). This is how the full-regression guard ([hooks-enforcement.md](hooks-enforcement.md) §10) learns a runner it did not know. A runner with no `Whole-suite:` line stays unguarded: say so in the closing report
- Never run this as a normal research round, at L2 or L3, or more than once per framework and major version

## What a project can add without editing muffy
`.team/stack-extensions.json`: `{"manifests": ["mix.exs"], "skipDirs": ["deps"], "platforms": ["game"]}`. The onboard scan then lists those manifests and skips those folders, the baseline check counts those manifests, and the contract's `Platform:` accepts those values. A new platform also needs its routing (who builds it, what design, smoke and staging mean) stated by the architect in the contract's Stack and by devops in `deploy.md`, since [platforms.md](platforms.md) only describes web, mobile, desktop and cli.
