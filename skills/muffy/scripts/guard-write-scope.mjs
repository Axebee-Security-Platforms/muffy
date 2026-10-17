#!/usr/bin/env node
// PreToolUse guard (Write|Edit): who may write which shared repo files (references/hooks-enforcement.md §12).
//   docs/strategy.md                         product-manager only (every cost record lives there)
//   docs/architecture/baseline.md            researcher only
//   docs/architecture/{overview,data-model}.html and docs/architecture/flows/*.html   architect only
//   any other file under docs/architecture/ no subagent
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the agent), 0 = allow.
// Only subagent calls are guarded (the payload names the subagent in `agent_type`); a call with no `agent_type` is the
// Orchestrator's own session or the user and is never blocked. Bash writes are not seen (known limit).
import { readFileSync } from 'node:fs';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const RULES = [
  { re: /(^|\/)docs\/strategy\.md$/, owner: 'product-manager', what: 'docs/strategy.md (the product-manager records all cost: send it the figures through the Orchestrator)' },
  { re: /(^|\/)docs\/architecture\/baseline\.md$/, owner: 'researcher', what: 'docs/architecture/baseline.md (the researcher writes it in onboard mode)' },
  { re: /(^|\/)docs\/architecture\/(overview|data-model)\.html$/, owner: 'architect', what: 'an architecture diagram (the architect draws it when a trigger fires)' },
  { re: /(^|\/)docs\/architecture\/flows\/[^/]+\.html$/, owner: 'architect', what: 'a flow diagram (the architect draws it when a trigger fires)' },
  { re: /(^|\/)docs\/architecture\//, owner: null, what: 'a file under docs/architecture/ that no rule names' },
];

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // cannot tell who is calling: nothing to guard
}

if (!WRITE_TOOLS.has(input.tool_name ?? '')) process.exit(0);
const role = String(input.agent_type ?? '').split(':').pop(); // "muffy:architect" or "architect"
if (!role) process.exit(0);
const path = String(input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '').replace(/\\/g, '/');

for (const rule of RULES) {
  if (!rule.re.test(path)) continue;
  if (rule.owner === role) process.exit(0);
  console.error(`[muffy] blocked: ${role} may not write ${rule.what}${rule.owner ? `; only ${rule.owner} may` : ''}. Report what you found in your hand-off and the Orchestrator routes it (references/hooks-enforcement.md §12).`);
  process.exit(2);
}
process.exit(0);
