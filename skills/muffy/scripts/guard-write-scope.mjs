#!/usr/bin/env node
// PreToolUse guard (Write|Edit): who may write which shared repo files (references/hooks-enforcement.md §12).
//   docs/strategy.md                         product-manager only (every cost record lives there)
//   docs/architecture/baseline.md            researcher only
//   docs/architecture/{overview,data-model,deployment}.html, docs/architecture/flows/*.html and docs/architecture/states/*.html and docs/architecture/changes/*.html   designer only (facts spec'd by architect)
//   any other file under docs/architecture/ no subagent
//   docs/plan/<task>-gantt.html, docs/plan/<task>-story-map.html   designer only (facts spec'd by product-manager)
//   docs/design/screen-map.html              designer only
//   docs/design-system/                       designer and architect (onboard) only
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the agent), 0 = allow.
// Only subagent calls are guarded (the payload names the subagent in `agent_type`); a call with no `agent_type` is the
// Orchestrator's own session or the user and is never blocked. Bash writes are not seen (known limit).
import { readFileSync } from 'node:fs';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const RULES = [
  { re: /(^|\/)docs\/strategy\.md$/, owners: ['product-manager'], what: 'docs/strategy.md (the product-manager records all cost: send it the figures through the Orchestrator)' },
  { re: /(^|\/)docs\/architecture\/baseline\.md$/, owners: ['researcher'], what: 'docs/architecture/baseline.md (the researcher writes it in onboard mode)' },
  { re: /(^|\/)docs\/architecture\/(overview|data-model|deployment)\.html$/, owners: ['designer'], what: 'an architecture diagram (the architect specs the facts when a trigger fires; the designer draws the file)' },
  { re: /(^|\/)docs\/architecture\/(flows|states|changes)\/[^/]+\.html$/, owners: ['designer'], what: 'a flow, state or change diagram (the architect specs the facts when a trigger fires; the designer draws the file)' },
  { re: /(^|\/)docs\/architecture\//, owners: [], what: 'a file under docs/architecture/ that no rule names' },
  { re: /(^|\/)docs\/plan\/[^/]+-(gantt|story-map)\.html$/, owners: ['designer'], what: 'a plan diagram (the product-manager specs the facts when the plan needs one; the designer draws the file)' },
  { re: /(^|\/)docs\/design\/screen-map\.html$/, owners: ['designer'], what: 'the screen map (the designer draws it when the structure or navigation changes)' },
  { re: /(^|\/)docs\/design-system\//, owners: ['designer', 'architect'], what: 'the design system (the designer owns it; the architect records an existing one at onboard)' },
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
// Rules are anchored at the project root, so packages/sdk/docs/architecture/README.md in a monorepo is not the shared docs folder. A path
// outside the project root (or with no root to compare) falls back to matching anywhere in the path. Windows and macOS file systems
// ignore case, so Docs/Strategy.md is the same file there.
const fold = (p) => (process.platform === 'win32' || process.platform === 'darwin' ? p.toLowerCase() : p);
const slash = (p) => p.replace(/\\/g, '/');
const isAbsolute = (p) => /^([a-zA-Z]:)?\//.test(p);
const raw = slash(String(input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? ''));
const root = slash(String(input.cwd ?? process.cwd())).replace(/\/+$/, '');
const inRoot = isAbsolute(raw) ? fold(raw).startsWith(`${fold(root)}/`) : !raw.startsWith('../');
const path = fold(inRoot ? (isAbsolute(raw) ? raw.slice(root.length + 1) : raw.replace(/^\.\//, '')) : raw);
const anchored = (re) => (inRoot ? new RegExp(re.source.replace('(^|\\/)', '^')) : re);

for (const rule of RULES) {
  if (!anchored(rule.re).test(path)) continue;
  if (rule.owners.includes(role)) process.exit(0);
  console.error(`[muffy] blocked: ${role} may not write ${rule.what}${rule.owners.length ? `; only ${rule.owners.join(' or ')} may` : ''}. Report what you found in your hand-off and the Orchestrator routes it (references/hooks-enforcement.md §12).`);
  process.exit(2);
}
process.exit(0);
