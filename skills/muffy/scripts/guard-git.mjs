#!/usr/bin/env node
// PreToolUse guard: no subagent changes git's own setup (references/hooks-enforcement.md §13).
// Every worktree shares the repo's .git/config and hooks, so one agent's `git remote set-url` or
// `core.hooksPath` change reaches every branch and the Orchestrator's own pushes. It blocks, for subagents:
//   Write/Edit/MultiEdit/NotebookEdit on a path inside .git/ (or a worktree's .git file)
//   Bash/PowerShell that writes git config (`git config` without a read flag, `git -c`, `--config-env`),
//   changes a remote (`git remote add|set-url|remove|rename|...`), names core.hooksPath, or writes into .git/
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the agent), 0 = allow.
// Only subagent calls are guarded (the payload names the subagent in `agent_type`); a call with no `agent_type` is the
// Orchestrator's own session or the user and is never blocked.
// Known limits: a write through `node -e`, a script file, or a git alias the patterns don't see.
import { readFileSync } from 'node:fs';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const GIT_PATH = /(^|[\\/])\.git([\\/]|$)/; // .git/ or a worktree's .git file; .github/ and .gitignore do not match
const GIT = /(^|[\s;&|(])git(\.exe)?\s/;
// `git config` is a read only with one of these; anything else (a key and a value, --unset, --add, edit, set) writes
const CONFIG = /(^|[\s;&|(])git(\.exe)?\s+(?:-C\s+\S+\s+)?config(\s|$)/;
const CONFIG_READ = /\s(--get|--get-all|--get-regexp|--get-urlmatch|--list|-l|get|list)(\s|$)/;
const INLINE_CONFIG = /(^|[\s;&|(])git(\.exe)?\s+(?:-C\s+\S+\s+)?(?:-c\s|--config-env)/;
const REMOTE_WRITE = /(^|[\s;&|(])git(\.exe)?\s+(?:-C\s+\S+\s+)?remote\s+(add|set-url|remove|rm|rename|set-head|set-branches)(\s|$)/;
const HOOKS_PATH = /core\.hookspath/i;
const DOT_GIT_ARG = /(^|[\s'"=])(\S*[\\/])?\.git([\\/]\S*)?(?=$|[\s'";|&)])/;
const SHELL_WRITER = /(^|[\s;&|(])(cp|mv|rm|ln|tee|touch|chmod|install|truncate|dd|Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Copy-Item|Move-Item|Rename-Item|sc|ac|ni|ri|del|erase|copy|move|ren)(\s|$)|\bsed\s+(-[A-Za-z]*i|--in-place)/i;
const REDIRECT_INTO_GIT = />>?\s*['"]?(\S*[\\/])?\.git([\\/]|['"\s]|$)/;

const block = (why) => {
  console.error(`[muffy] blocked: ${why}. Git setup (config, remotes, hooks, anything in .git/) belongs to the Orchestrator: report the need in your hand-off (references/hooks-enforcement.md §13).`);
  process.exit(2);
};

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // cannot tell who is calling: nothing to guard
}

const tool = input.tool_name ?? '';
const role = String(input.agent_type ?? '').split(':').pop(); // "muffy:backend-dev" or "backend-dev"
if (!role) process.exit(0);

if (WRITE_TOOLS.has(tool)) {
  const path = String(input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '');
  if (GIT_PATH.test(path)) block(`${role} may not write inside .git/`);
  process.exit(0);
}

if (tool !== 'Bash' && tool !== 'PowerShell') process.exit(0);
const cmd = String(input.tool_input?.command ?? '');
if (HOOKS_PATH.test(cmd)) block('command names core.hooksPath');
if (GIT.test(cmd)) {
  if (CONFIG.test(cmd) && !CONFIG_READ.test(cmd)) block('git config writes are not allowed (read with --get or --list)');
  if (INLINE_CONFIG.test(cmd)) block('git -c / --config-env overrides config for the command');
  if (REMOTE_WRITE.test(cmd)) block('git remote changes are not allowed');
}
if (REDIRECT_INTO_GIT.test(cmd) || (DOT_GIT_ARG.test(cmd) && SHELL_WRITER.test(cmd))) block('command writes inside .git/');
process.exit(0);
