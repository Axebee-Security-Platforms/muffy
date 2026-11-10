---
name: setup
description: Set up the current repo for the muffy plugin. Writes .claude/settings.local.json (vault path, guard switch), the .gitignore lines and the onboarding scan, and removes an older copied install of muffy. Copies no scripts.
argument-hint: "[--vault <absolute path>] [--with-guard] [--keep-copy] [--no-scan] [--dry-run]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/install.mjs" *)
---

# muffy setup

## Purpose

The muffy plugin keeps its skill, agents and scripts in the plugin folder, so nothing is copied into the repo. This sets up only the files each project needs: `.claude/settings.local.json`, the muffy lines in `.gitignore`, and `.team/onboard/scan.json`.

If the repo still has muffy from the older copied install, setup removes it by default:
- `.claude/skills/muffy/`
- muffy's agent files in `.claude/agents/` (as listed in its `MANIFEST.json`)
- `.claude/agents/references/` and `.claude/agent-references/`
- the hooks in `.claude/settings.local.json` that run `.claude/skills/muffy/scripts/*`

With both installs, two `/muffy` skills and two sets of agents would load, and once the scripts are gone those hooks would fail on every tool call. Other agents and hooks are left alone.

## Inputs

The user's arguments, all optional:
- `--vault <absolute path>`: the Obsidian vault for the second brain. It is written to `SECOND_BRAIN_VAULT` only when `.claude/settings.local.json` is created. Without a vault, notes live in `.team/brain/`
- `--with-guard`: turns on the plugin's guards for this repo (env `MUFFY_GUARD=1`). The guards cover `.env` reads, the doc agents' Bash allowlist, the test level, the write scope, git and the gates. They are off until this is set
- `--keep-copy`: leave the copied install in place
- `--no-scan`: skip the repo scan
- `--dry-run`: show what would change and write nothing

## Workflow

1. Run this once from the repo root, with the user's arguments:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/install.mjs" . --plugin $ARGUMENTS
   ```

2. Report what the installer printed (next section).

## Output Format

A few lines covering the files written, what was removed from a copied install (if any), every `warning:` line as printed, and the installer's remaining steps. End with: start work with `/muffy:muffy <what you want>`.

## Rules and Guardrails

- Run only the command above. Add no other flags and edit no file by hand
- An existing `.claude/settings.local.json` is never overwritten; `--with-guard` adds only `MUFFY_GUARD`. If a vault was given and the file already existed, tell the user to set `SECOND_BRAIN_VAULT` there themselves
- When the installer removed a copied install, list what it removed (its `remove:` lines, grouped: agent files, folders, hooks) and say that committed files can be restored from git. Delete nothing else yourself
- A `warning:` about `.claude/settings.json` means team-shared hooks still call the removed scripts. That file is the team's: tell the user which hooks to remove, and do not edit it

## Quality Checks

- [ ] The installer exited 0, or its error is reported word for word
- [ ] Every `warning:` line is in the reply
