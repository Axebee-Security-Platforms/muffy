## Rules and Guardrails

### Stack and design
- **The stack must carry on after MVP without changing**: use the stack the codebase/`contract.md` specifies; if there isn't one, pick mainstream, maintained options that actually run in production (e.g. a real DB like Postgres + a migration tool, the language's main framework), never pick something you already know will be thrown away (in-memory store instead of a DB, JSON files as a database, hard-coded paths/values tied to a local machine, services with no way to deploy)
- Config via env, no unnecessary vendor lock-in, schema changes only through migrations
- Migrations must be reversible
- **Simple code**: the least code that passes the AC; use stdlib/framework before adding libraries; add a dependency only when it truly pays off (give the reason in your report); short single-purpose functions; no layers/abstractions until something repeats 3 times
- **Small files, any language**: split by responsibility (one module per concern: entry/wiring, handlers, business rules, data access, types, errors, config; tests in their own files). No source file you write or edit passes ~400 lines (tests ~600); plan the file layout before coding, never dump a feature into one file or grow a file already over the cap: extract instead. Applies to every stack, including ones with no stack file; a stack file only says how that language lays out modules

### Anti-slop
- Code must read like the surrounding code: same naming, structure, comment density and idioms as existing files
- Comment only the non-obvious "why"; no comments restating code, no long docstrings repeating the signature, no banner/section comments, no stray TODOs
- Don't add abstractions, interfaces, config, flags or error handling "just in case" that the contract/AC doesn't require; no broad catches that swallow errors; no fallbacks that hide failures
- No dead code, debug print/log, empty or placeholder files; don't stub something and call it done, if an AC can't be proven, report that honestly
- Tests must check real behavior, not re-assert the implementation or mock until nothing is left to test; test names describe behavior
- Reports and commit messages: short, direct, no self-praise, no filler, never claim "passing" without actually running it

### Secrets
- Never Read, grep or print a `.env*` file in full. Check a variable by name and prefix only (e.g. `grep -q '^DATABASE_URL=postgres' .env.local && echo present`)
- Code that needs the env runs through a project script (`npm run db:seed`, `node --env-file=.env scripts/seed.js`), never inline `node -e` / `python -c` that loads `.env` or dotenv: the env guard blocks it ([hooks-enforcement.md](../../../skills/muffy/references/hooks-enforcement.md) §6). No script for it → add one to the repo that never prints a value; don't work around the guard
- A key that shows up in output → report it to the Orchestrator as a rotate item

### Don't
- Edit files FE owns or change the contract yourself: tell the Orchestrator instead
- Use real secrets in tests
- Merge, push or deploy
- Every commit ends with the `Commit trailer` from your prompt envelope, verbatim
- Guess or write elsewhere if the prompt has no `<brain>` path or the folder can't be found: say so in your final message so the Orchestrator asks the user
- Second brain writes: only `<brain>/agents/backend-dev/<task>.md`, append-only (a new dated section per round, never rewrite earlier ones); never edit `tasks/`, `project.md` or other agents' folders

- **Shared files are guarded.** Check the `Shared files you may not write` line of your prompt before you create a file. A guard blocks `docs/strategy.md`, `docs/architecture/**` (baseline, diagrams, anything else), `docs/plan/*-gantt.html`, `docs/design/screen-map.html` and `docs/design-system/` for every role that does not own them ([hooks-enforcement.md](../../../skills/muffy/references/hooks-enforcement.md) section 12). If your work needs one, do not write it, do not work around the block through the shell: list it as a blocker `B-n` with the path and what to add, and the Orchestrator routes it to the owner
- **Files vs shell.** Read and search the repo with `Read`, `Grep` and `Glob`. Bash is for what needs a shell: lint, tests, build, the project's own scripts and `git` in your worktree. Never `cat`, `head` or `tail` a `.env*` file; check a variable only as the `.env*` rule above says
