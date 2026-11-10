# Installing muffy

muffy is a hub-and-spoke agent team plus a skill. One command installs both into a repo.

## Requirements

- Node 18+
- A git repo (run from its root)
- Optional: an Obsidian vault for the second brain. Without one, notes and lessons live in `.team/brain/` and are shared through git
- Optional: the `impeccable` skill in the main session, for the Orchestrator's UX/UI review of the rendered canvas at the design gate (step 3c). Without it that review is skipped and the gate says so; the designer's own heuristic and a11y checks still run

## Install as a plugin

In Claude Code:

```text
/plugin marketplace add Axebee-Security-Platforms/muffy
/plugin install muffy@muffy
```

Then, in each repo, run once:

```text
/muffy:setup --vault "/absolute/path/to/Obsidian Vault" --with-guard
```

`/muffy:setup` runs `install.mjs <repo> --plugin` from the plugin folder. It copies nothing. It writes:

- `.claude/settings.local.json`, only if missing; with `--with-guard` it adds env `MUFFY_GUARD=1` to an existing file
- the `.gitignore` lines
- `.team/onboard/scan.json`

Without `--vault`, the second brain lives in `.team/brain/`.

How the plugin finds its files:
- The skill and its references write script paths as `<muffy>/scripts/…`. `SKILL.md` defines `<muffy>` as `${CLAUDE_SKILL_DIR}`, and each agent defines it as `${CLAUDE_PLUGIN_ROOT}/skills/muffy`. Claude Code fills both in when it loads the file, so updating the plugin moves every path with it.
- The guards ship in the plugin's `hooks/hooks.json`. A plugin's hooks run in every project that enables it, so muffy's guards do nothing until a project sets `MUFFY_GUARD` to `"1"` in `.claude/settings.local.json` or `.claude/settings.json`. To share the switch with the team, put it in `settings.json`.
- Commands are namespaced: `/muffy:muffy <request>`, `/muffy:setup`, and agents `muffy:<role>`.
- Update with `/plugin marketplace update muffy`, then restart Claude Code.

Moving from a copied install: delete `.claude/skills/muffy/`, `.claude/agent-references/` (or `.claude/agents/references/` before 1.4.0) and muffy's files in `.claude/agents/` (`MANIFEST.json` lists them), plus any muffy entries in `hooks.PreToolUse` of `.claude/settings.local.json`. Then run `/muffy:setup --with-guard`. `/muffy:setup` warns while the copy is still there, because both would load.

## Install by copying

```bash
node install.mjs /path/to/your-repo --vault "/absolute/path/to/Obsidian Vault"
```

What it does:

| Copies to | From |
|---|---|
| `.claude/agents/` | `agents/` (the subagent definitions) |
| `.claude/agent-references/` | `agent-references/` (each agent's reference files) |
| `.claude/skills/muffy/` | `skills/muffy/` (SKILL.md, references, schemas, scripts) |
| `.claude/settings.local.json` | created only if missing; sets `SECOND_BRAIN_VAULT` |
| `.gitignore` | adds `.claude/settings.local.json`, `.worktrees/`, `.team/**/diff*.patch`, `.team/**/logs/` if missing |

Existing agents or skill folders are skipped unless you pass `--force`. An existing `settings.local.json` is never touched. The copied agent files have `${CLAUDE_PLUGIN_ROOT}` rewritten to `.claude`, because Claude Code fills that variable in only for a plugin.

Preview first with `--dry-run`:

```bash
node install.mjs /path/to/your-repo --dry-run
```

## Update an existing install

Each install writes `.claude/skills/muffy/VERSION` and `MANIFEST.json` (the agent files it owns). To update a repo to a newer package:

```bash
node install.mjs /path/to/your-repo --clean --dry-run   # preview removals and copies
node install.mjs /path/to/your-repo --clean
```

`--clean` removes the previous install first: the whole `.claude/skills/muffy/` folder, plus the agent files listed in the old manifest (so files a newer version dropped are removed). It then installs the new version. It only touches muffy's own files, so your other agents in `.claude/agents/` stay.

Caveats:
- Local edits inside `.claude/skills/muffy/` and to muffy agent files are lost. Commit or back them up first.
- `settings.local.json` and hooks are never touched.
- A repo installed before 1.1.0 has no manifest. `--clean` then removes only the files the new package ships, and older leftovers stay. Delete them by hand after checking the diff.
- Without `--clean`, an existing install is left as it is (the installer prints the installed version).

## After install

1. **Hooks are not installed by default.** To add the env guard, re-run the installer with `--with-guard` (or add it by hand):

   ```bash
   node install.mjs /path/to/your-repo --with-guard --dry-run   # shows the JSON to merge
   node install.mjs /path/to/your-repo --with-guard
   ```

   This merges six entries (the env guard, the doc agents' Bash allowlist, the full-regression guard, the test-level guard, the write-scope guard and the git guard) into `hooks.PreToolUse` of `.claude/settings.local.json` and keeps every other key. It is idempotent. If `PreToolUse` already exists, the installer leaves it alone and prints the entry for you to add by hand:

   ```json
   "PreToolUse": [
     { "matcher": "Read|Grep|Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-env.mjs" } ] },
     { "matcher": "Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-bash-allowlist.mjs" } ] },
     { "matcher": "Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-full-regression.mjs" } ] },
     { "matcher": "Bash|PowerShell|Write|Edit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-test-level.mjs" } ] },
     { "matcher": "Write|Edit|MultiEdit|NotebookEdit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-write-scope.mjs" } ] },
     { "matcher": "Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-git.mjs" } ] }
   ]
   ```

   Team-flow rules 1–4 (merge, commit, push, temporary stack) are Orchestrator rules, not hooks: Claude Code has no merge/commit/push hook event. See [hooks-enforcement.md](skills/muffy/references/hooks-enforcement.md).
2. Check `SECOND_BRAIN_VAULT` in `.claude/settings.local.json`.
3. Existing codebase: nothing to run. The installer scans the repo (`--no-scan` skips it), and the first `/muffy` request asks once to look around first, then carries on. See [onboard.md](skills/muffy/references/onboard.md).
4. Add the repo's own docs the flow uses: `docs/plan/`, `docs/adr/`, `docs/design-system/`, and `.nvmrc` if devops should check the runtime.
5. From the main Claude Code session, type `/muffy <what you want>` in your own words: muffy picks the route and shows the plan before it starts. A bare `/muffy` shows the menu (unfinished tasks, project status). Shortcuts such as `/muffy fix <description>` are listed in the [README](README.md#commands).

## Not for

One-line edits with no behaviour risk, research-only or review-only requests. Small bugs and cosmetic fixes use the fix lane, not the full flow.

## Before installing: find unfinished work

`/muffy todo` lists the tasks in `.team/` that are not done. See [todo.md](skills/muffy/references/todo.md). The installer still adds `.team/onboard/pending.json` to `.gitignore` for the parked `scan-pending.mjs` scan.
