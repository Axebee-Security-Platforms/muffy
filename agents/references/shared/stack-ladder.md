# Stack ladder — a stack with no practices file

For any agent that writes, runs or judges code for a framework or language with no coding-practices file of its own. The team learns a short note from the official docs once per framework, keeps it in the repo at `docs/stacks/<framework>.md`, and every role that touches that stack reads the same note. Nothing is filled from memory.

Stop at the first step that gives enough to do the work correctly.
1. **A note exists:** `docs/stacks/<framework>.md`. Run `node .claude/skills/muffy/scripts/check-stack-notes.mjs <framework>`. `fresh` or `unchecked` → read it and use it as the stack file. `stale` (the note is for another major version than the manifest uses) → treat it as missing
2. **Local sources only, no web:** the version in the lockfile, the package's README and types in its installed folder, the repo's existing code and `docs/architecture/baseline.md`. If the repo already has working examples of the idiom you need, follow them and say which stack you assumed
3. **Still unsure** about what changes correctness (data flow, error handling, concurrency, routing, build and test commands): do not guess. Return `status: blocked` with a blocker `owner: Researcher`, problem `stack-unknown: <framework> <version>` (add `(note is for <old>)` when stale). The Orchestrator gets a note written and resumes you

What each role takes from it: `frontend-dev` and `backend-dev` the rules to write code by; `architect` raises the blocker before the contract is final when the chosen stack has no practices file, so FE and BE do not hit it later; `qa-tester` the `Test (scoped):` and `Whole-suite:` commands before running anything; `devops` the build and run commands in mode 2; `code-reviewer` the note for each stack in the diff, so it judges the code by the same rules it was written to. The note itself is written by `researcher` in `mode: stack-note` (its workflow).
