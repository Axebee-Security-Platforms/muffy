# Onboard (step 0)

Run once per repo that already has a codebase, before the first feature: `/muffy onboard`. Task name is fixed: `onboard`. It records what the repo already is, so later steps reuse it instead of rediscovering it or guessing a stack.

If the repo has unfinished work (unmerged branches, open tracker items), run [analyze.md](analyze.md) first so it becomes tasks instead of surprises.

Not for a new, empty repo (nothing to record) or when `docs/architecture/baseline.md` exists and is fresh (`check-baseline.mjs` prints green; see [baseline-freshness.md](baseline-freshness.md)). Refresh = run it again; it rewrites the baseline and appends a new ADR only if the stack changed.

## Flow

| # | Who | Does | Output |
|---|---|---|---|
| 0a | Orchestrator | Setup as in [setup.md](setup.md) (skip setup step 3 baseline check, the scope pause and worktrees). Run `node .claude/skills/muffy/scripts/scan-repo.mjs . --out .team/onboard/scan.json` unless `install.mjs --scan` already did | `scan.json`: facts only |
| 0b | `researcher` (onboard mode) | Reads `scan.json`, then the code to confirm and fill it (entrypoints, patterns in use, auth, data access, error handling, naming, test style, build/test/lint commands) | `docs/architecture/baseline.md` |
| 0c | `architect` (onboard mode) | Reads `baseline.md`; records the stack in force; adds `docs/design-system/` only when `scan.json` → `ui.likely`; specs `docs/architecture/overview.html` (only if the repo has no architecture diagram) as a `diagrams_spec` entry — never writes the file itself | `docs/adr/NNNN-existing-stack.md`, `docs/design-system/README.md` (UI only), `diagrams_spec` (0 or 1 entries) |
| 0c' | `designer`, only if 0c's hand-off carries a `diagrams_spec` | Draws `docs/architecture/overview.html` from that spec, per [diagram-style.md](diagram-style.md) | `docs/architecture/overview.html` |
| 0d | **Human gate** `pause:onboard-review` | `AskUserQuestion` with the baseline summary, the overview diagram link if 0c' drew one (published first, [diagram-publish.md](diagram-publish.md)), the ADR, the `[verify]` list, the infrastructure question (what `baseline.md` found under Runtime and deploy, then: "Infrastructure: is there somewhere to deploy? Options: existing (say what), none yet (decide later, the default), none yet (propose one now), or not needed (a library, local tool or client-only app)"; answering that there is none is fine and nothing is proposed), and the proposed agent-context change (see below). Approve / Edit / Reject | approved baseline |
| 0e | Orchestrator | Seed `<brain>/project.md` (Lessons, Open issues) from the baseline's open issues; record the 0d infrastructure answer as `infra: …` in `project.md`; apply the approved agent-context change; commit the docs | `project.md`, `CLAUDE.md` / `AGENTS.md` |

0b then 0c run in sequence (0c reads 0b's output), then 0c' if 0c spec'd a diagram. A Reject at 0d goes back to the owner of the point the user names — the facts owner (`architect`) for a wrong fact, `designer` for a layout-only complaint — under the normal fix-loop limits in [loops.md](loops.md).

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

## Agent context file (CLAUDE.md / AGENTS.md)

`install.mjs` never touches these files; onboard owns them. `scan.json` → `docs.claudeMd` / `docs.agentsMd` says which exist. Show the exact change at 0d and write it only after approval.

- **Neither exists**: create `CLAUDE.md` with only the muffy block below
- **One or both exist**: add the muffy block to each existing file; leave every other line as is
- **Block already present** (between the markers): replace only the text inside the markers

The block is short and points at files instead of copying them:

```
<!-- muffy:begin -->
## muffy
Stack, layout, conventions and commands: `docs/architecture/baseline.md`. Decisions: `docs/adr/`.
Features run through `/muffy <request>`; task state lives in `.team/<task>/`.
<!-- muffy:end -->
```

Do not restate baseline content in the block: it goes stale, the baseline carries a `commit`.

## Rules

- Facts from files only. Unknown = `[verify]`, never a guess. No recommendations and no refactors: this is a record of what is, not a plan
- `.env*` files are never opened. Env variable names come from code references or an example file the repo ships
- Writes allowed, beyond the usual: researcher → `docs/architecture/baseline.md`; architect → `docs/adr/`, `docs/design-system/`; designer → `docs/architecture/overview.html`, only when 0c spec'd it (the repo had no architecture diagram, as defined in [diagrams.md](../../../agents/references/architect/diagrams.md)); orchestrator → the muffy block in `CLAUDE.md` / `AGENTS.md`, after 0d approval. Nothing else in the repo changes
- Existing `docs/adr/` records win: do not renumber, rewrite or contradict them. The new ADR is numbered after the latest and says "accepted: records the stack as found on `<date>`". If the repo already has ADRs covering the stack, link them instead of writing a duplicate
- A design-system README lists tokens and components that exist in code; it invents none
- Hand-off blocks use `"step": "0"` (see [handoff.schema.json](../schemas/handoff.schema.json))

## Done when

- `baseline.md` has every section above and a `commit` that matches HEAD
- Each Commands entry exists in a manifest or CI file
- If the repo had no architecture diagram, `overview.html` shows only components that exist, with `[verify]` on anything unconfirmed; if it had one, there is no new diagram
- The ADR lists the stack, matches `baseline.md`, and has no recommendations
- Every existing `CLAUDE.md` / `AGENTS.md` has the muffy block (or `CLAUDE.md` was created), with nothing outside the markers changed
- The user approved at 0d, and the approval is in `checkpoint.md` → `## Status`

## Later runs

Setup in [setup.md](setup.md) reads `baseline.md` before anything else. `researcher` treats it as L0 knowledge and `architect` reuses its Stack and Conventions instead of exploring from scratch. `check-baseline.mjs` measures how stale it is ([baseline-freshness.md](baseline-freshness.md)). If code contradicts the baseline, the code wins: note the drift in the brief and suggest a refresh.
