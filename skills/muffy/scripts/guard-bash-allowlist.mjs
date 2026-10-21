#!/usr/bin/env node
// PreToolUse guard: limits Bash for the doc agents (architect, designer, diagrammer, product-manager, docs-writer, researcher)
// to the muffy validators and checkers and read-only git (references/hooks-enforcement.md §9).
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the agent), 0 = allow.
// Only subagent calls are guarded: the hook payload names the subagent in `agent_type`; a call with no
// `agent_type` is the Orchestrator's own session and is never blocked. Other roles are left to their own rules.
import { readFileSync } from 'node:fs';

const GUARDED = new Set(['architect', 'designer', 'diagrammer', 'product-manager', 'docs-writer', 'researcher']);
const NODE_CHECK = /^node\s+(?:\.claude[\\/])?skills[\\/]muffy[\\/]scripts[\\/](?:validate-handoff|check-artifacts|check-checkpoint|check-diagram(?:-render)?|check-stack-notes|check-presentation)\.mjs(?:\s+\S+)*$/;
const IMPORT_CHECK = /^node\s+(?:\.claude[\\/])?skills[\\/]muffy[\\/]scripts[\\/]diagram-import\.mjs(?:\s+\S+)*$/; // read-only: prints a digest and a draft; --html would write a file, so it is refused here
const GIT_READ = /^git\s+(?:status|diff|log|show)(?:\s+\S+)*$/;
const GIT_WRITES = /--output|--ext-diff|--textconv|-c\s|--exec-path|--git-dir|--work-tree/; // flags that write files or run programs
const SHELL_META = /[;&|<>`\n\r]|\$\(|\$\{/; // chaining, redirection, substitution
const TRAVERSAL = /(^|[\\/\s])\.\.([\\/\s]|$)/;

const block = (why) => {
  console.error(
    `[muffy] blocked: ${why}. Bash is for checks only: node .claude/skills/muffy/scripts/{validate-handoff,check-artifacts,check-checkpoint,check-diagram,check-diagram-render,diagram-import (no --html),check-stack-notes,check-presentation}.mjs <args> and read-only git status/diff/log/show, one command at a time (references/hooks-enforcement.md §9).`,
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
if (NODE_CHECK.test(cmd) || (IMPORT_CHECK.test(cmd) && !/--html/.test(cmd))) process.exit(0);
if (GIT_READ.test(cmd) && !GIT_WRITES.test(cmd)) process.exit(0);
block(`command is not on the ${role} allowlist`);
