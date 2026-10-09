# Onboard (step 0)

Run once per repo that already has a codebase, before the first feature: `/muffy onboard`. Task name is fixed: `onboard`. It records what the repo already is, so later steps reuse it instead of rediscovering it or guessing a stack.

Not for a new, empty repo (nothing to record) or when `docs/architecture/baseline.md` exists and is fresh. Refresh = run it again; it rewrites the baseline and appends a new ADR only if the stack changed.

## Flow

| # | Who | Does | Output |
|---|---|---|---|
| 0a | Orchestrator | Setup as in [setup.md](setup.md) (skip setup step 3 baseline check, the scope pause and worktrees). Run `node .claude/skills/muffy/scripts/scan-repo.mjs . --out .team/onboard/scan.json` unless `install.mjs --scan` already did | `scan.json`: facts only |
| 0b | `researcher` (onboard mode) | Reads `scan.json`, then the code to confirm and fill it (entrypoints, patterns in use, auth, data access, error handling, naming, test style, build/test/lint commands) | `docs/architecture/baseline.md` |
| 0c | `architect` (onboard mode) | Reads `baseline.md`; records the stack in force; adds `docs/design-system/` only when `scan.json` → `ui.likely` | `docs/adr/NNNN-existing-stack.md`, `docs/design-system/README.md` (UI only) |
| 0d | **Human gate** `pause:onboard-review` | `AskUserQuestion` with the baseline summary, the ADR, and the `[verify]` list. Approve / Edit / Reject | approved baseline |
| 0e | Orchestrator | Seed `<brain>/project.md` (Lessons, Open issues) from the baseline's open issues; commit the docs | `project.md` |

0b then 0c run in sequence (0c reads 0b's output). A Reject at 0d goes back to the owner of the point the user names, under the normal fix-loop limits in [loops.md](loops.md).

## baseline.md

Frontmatter: `commit` (HEAD sha it describes), `date`, `scan` (path). Sections, each short and cited as `path:line`:

- **Stack**: languages, frameworks, data stores, with versions from manifests
- **Layout**: where code lives, entrypoints, monorepo boundaries
- **Conventions**: naming, error handling, auth, data access, config; only what the code shows
- **Commands**: install, dev, build, test, lint, typecheck as the repo defines them. Record them; do **not** run them
- **Runtime and deploy**: pinned versions, CI, how it ships (from files, not guesses)
- **Existing docs**: what is already in the repo and where
- **Open issues**: things that look broken or risky, with evidence. These seed `project.md`
- **`[verify]`**: every claim the agent could not confirm from code. The user checks these at 0d

## Rules

- Facts from files only. Unknown = `[verify]`, never a guess. No recommendations and no refactors: this is a record of what is, not a plan
- `.env*` files are never opened. Env variable names come from code references or an example file the repo ships
- Writes allowed, beyond the usual: researcher → `docs/architecture/baseline.md`; architect → `docs/adr/` and `docs/design-system/`. Nothing else in the repo changes
- Existing `docs/adr/` records win: do not renumber, rewrite or contradict them. The new ADR is numbered after the latest and says "accepted: records the stack as found on `<date>`". If the repo already has ADRs covering the stack, link them instead of writing a duplicate
- A design-system README lists tokens and components that exist in code; it invents none
- Hand-off blocks use `"step": "0"` (see [handoff.schema.json](../schemas/handoff.schema.json))

## Done when

- `baseline.md` has every section above and a `commit` that matches HEAD
- Each Commands entry exists in a manifest or CI file
- The ADR lists the stack, matches `baseline.md`, and has no recommendations
- The user approved at 0d, and the approval is in `checkpoint.md` → `## Status`

## Later runs

Setup in [setup.md](setup.md) reads `baseline.md` before anything else. `researcher` treats it as L0 knowledge and `architect` reuses its Stack and Conventions instead of exploring from scratch. If code contradicts the baseline, the code wins: note the drift in the brief and suggest a refresh.
