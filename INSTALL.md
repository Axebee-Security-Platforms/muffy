# Installing muffy

muffy is a hub-and-spoke agent team plus a skill. One command installs both into a repo.

## Requirements

- Node 18+
- A git repo (run from its root)
- An Obsidian vault for the second brain (optional but expected by the flow)

## Install

```bash
node install.mjs /path/to/your-repo --vault "/absolute/path/to/Obsidian Vault"
```

What it does:

| Copies to | From |
|---|---|
| `.claude/agents/` | `agents/` (subagent definitions and references) |
| `.claude/skills/muffy/` | `skills/muffy/` (SKILL.md, references, schemas, scripts) |
| `.claude/settings.local.json` | created only if missing; sets `SECOND_BRAIN_VAULT` |
| `.gitignore` | adds `.claude/settings.local.json`, `.worktrees/`, `.team/**/diff*.patch` if missing |

Existing agents or skill folders are skipped unless you pass `--force`. An existing `settings.local.json` is never touched.

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

1. **Hooks are not installed.** Add the env guard to `.claude/settings.local.json` yourself:

   ```json
   "PreToolUse": [
     { "matcher": "Read|Grep|Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-env.mjs" } ] }
   ]
   ```

   The team-flow rules are in `team-flow-settings-template.json`; merge its `hooks` key by hand.
2. Check `SECOND_BRAIN_VAULT` in `.claude/settings.local.json`.
3. Add the repo's own docs the flow uses: `docs/plan/`, `docs/adr/`, `docs/design-system/`, and `.nvmrc` if devops should check the runtime.
4. Start a feature from the main Claude Code session: `/muffy <feature request>` with a kebab-case task name.

## Not for

Small fixes, single-file edits, research-only or review-only requests.
