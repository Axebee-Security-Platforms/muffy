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
