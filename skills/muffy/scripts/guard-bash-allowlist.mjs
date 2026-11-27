#!/usr/bin/env node
// PreToolUse guard: limits Bash for the doc agents (architect, designer, diagrammer, product-manager, docs-writer, researcher)
// to the muffy validators and checkers and read-only git (references/hooks-enforcement.md §9).
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the agent), 0 = allow.
// Only subagent calls are guarded: the hook payload names the subagent in `agent_type`; a call with no
// `agent_type` is the Orchestrator's own session and is never blocked. Other roles are left to their own rules.
import { readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardOff } from './plugin-gate.mjs';

if (guardOff()) process.exit(0); // plugin install without MUFFY_GUARD=1: the project did not opt in

const GUARDED = new Set(['architect', 'designer', 'diagrammer', 'product-manager', 'docs-writer', 'researcher']);
const CHECKS = new Set(['validate-handoff', 'check-artifacts', 'check-checkpoint', 'check-diagram', 'check-diagram-render', 'check-stack-notes', 'check-presentation', 'check-design']);
// `node <script> <args>`: the script path bare or in quotes. Allowed paths: the relative forms (`.claude/skills/muffy/scripts/`
// in a copied install, `skills/muffy/scripts/` in this repo), or this guard's own folder written out in full (the plugin
// install, where `<muffy>` is an absolute path). Any other folder is refused, so a look-alike script written elsewhere never runs.
const NODE_SCRIPT = /^node\s+(?:"([^"]+)"|'([^']+)'|(\S+))((?:\s+(?:"[^"]*"|'[^']*'|\S+))*)$/;
const RELATIVE = /^(?:\.claude[\\/])?skills[\\/]muffy[\\/]scripts[\\/]([\w-]+)\.mjs$/;
const OWN_DIR = dirname(fileURLToPath(import.meta.url));
const norm = (p) => {
  const n = resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? n.toLowerCase() : n; // Windows paths ignore case; elsewhere a case change is another folder
};
const scriptOf = (cmd) => {
  const m = NODE_SCRIPT.exec(cmd);
  if (!m) return null;
  const path = m[1] ?? m[2] ?? m[3];
  const rel = RELATIVE.exec(path);
  if (rel) return { name: rel[1], args: m[4] };
  if (!isAbsolute(path) || norm(dirname(path)) !== norm(OWN_DIR)) return null;
  return { name: basename(path).replace(/\.mjs$/, ''), args: m[4] };
};
const GIT_READ = /^git\s+(?:status|diff|log|show)(?:\s+\S+)*$/;
const GIT_WRITES = /--output|--ext-diff|--textconv|-c\s|--exec-path|--git-dir|--work-tree/; // flags that write files or run programs
const SHELL_META = /[;&|<>`\n\r]|\$\(|\$\{/; // chaining, redirection, substitution
const TRAVERSAL = /(^|[\\/\s])\.\.([\\/\s]|$)/;

const block = (why) => {
  console.error(
    `[muffy] blocked: ${why}. Bash is for checks only: node "<muffy>/scripts/{validate-handoff,check-artifacts,check-checkpoint,check-diagram,check-diagram-render,diagram-import (no --html),check-stack-notes,check-presentation,check-design}.mjs" <args> (<muffy> exactly as your definition gives it) and read-only git status/diff/log/show, one command at a time (references/hooks-enforcement.md §9). The designer may also run ux-search.mjs.`,
  );
  process.exit(2);
};

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // cannot tell who is calling: nothing to guard
}

const tool = input.tool_name ?? '';
const role = String(input.agent_type ?? '').split(':').pop(); // "muffy:architect" or "architect"
if (tool !== 'Bash' && tool !== 'PowerShell') process.exit(0);
if (!GUARDED.has(role)) process.exit(0);

if (tool === 'PowerShell') block(`${role} has no PowerShell`);
const cmd = String(input.tool_input?.command ?? '').trim();
if (SHELL_META.test(cmd)) block('no chaining, redirection or substitution');
if (TRAVERSAL.test(cmd)) block('no ".." path segments');
// after the meta and traversal checks: no chaining, redirection or ".."
const script = scriptOf(cmd);
if (script?.name === 'ux-search' && role === 'designer') process.exit(0); // designer only: read-only lookup in data/ux/*.csv
if (script && CHECKS.has(script.name)) process.exit(0);
if (script?.name === 'diagram-import' && !/--html/.test(script.args)) process.exit(0); // read-only: prints a digest and a draft; --html would write a file
if (GIT_READ.test(cmd) && !GIT_WRITES.test(cmd)) process.exit(0);
block(`command is not on the ${role} allowlist`);
