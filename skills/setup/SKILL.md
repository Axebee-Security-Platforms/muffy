---
name: setup
description: Set up the current repo for the muffy plugin. Writes .claude/settings.local.json (vault path, guard switch), the .gitignore lines and the onboarding scan. Copies no scripts.
argument-hint: "[--vault <absolute path>] [--with-guard] [--no-scan] [--dry-run]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/install.mjs" *)
---

# muffy setup

## Purpose

The muffy plugin keeps its skill, agents and scripts in the plugin folder, so nothing is copied into the repo. This sets up only the files each project needs: `.claude/settings.local.json`, the muffy lines in `.gitignore`, and `.team/onboard/scan.json`.

## Inputs

The user's arguments, all optional:
- `--vault <absolute path>`: the Obsidian vault for the second brain. It is written to `SECOND_BRAIN_VAULT` only when `.claude/settings.local.json` is created. Without a vault, notes live in `.team/brain/`
- `--with-guard`: turns on the plugin's guards for this repo (env `MUFFY_GUARD=1`). The guards cover `.env` reads, the doc agents' Bash allowlist, the test level, the write scope, git and the gates. They are off until this is set
- `--no-scan`: skip the repo scan
- `--dry-run`: show what would change and write nothing

## Workflow

1. Run this once from the repo root, with the user's arguments:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/install.mjs" . --plugin $ARGUMENTS
   ```

2. Report what the installer printed (next section).

## Output Format

A few lines covering the files written, every `warning:` line as printed, and the installer's remaining steps. End with: start work with `/muffy:muffy <what you want>`.

## Rules and Guardrails

- Run only the command above. Add no other flags and edit no file by hand
- An existing `.claude/settings.local.json` is never overwritten; `--with-guard` adds only `MUFFY_GUARD`. If a vault was given and the file already existed, tell the user to set `SECOND_BRAIN_VAULT` there themselves
- A warning that `.claude/skills/muffy` exists means an older copied install is still in the repo, so two `/muffy` skills and two sets of agents would load. Tell the user to remove that folder and muffy's files in `.claude/agents/` (`.claude/skills/muffy/MANIFEST.json` lists them). Don't delete them yourself

## Quality Checks

- [ ] The installer exited 0, or its error is reported word for word
- [ ] Every `warning:` line is in the reply
