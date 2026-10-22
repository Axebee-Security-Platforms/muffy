#!/usr/bin/env node
// PreToolUse guard (Write|Edit): who may write which shared repo files (references/hooks-enforcement.md §12).
//   docs/strategy.md                         product-manager only (every cost record lives there)
//   docs/architecture/baseline.md and docs/architecture/baseline/*.md   researcher only (the index and its section files)
//   docs/architecture/{overview,data-model,deployment}.html, docs/architecture/flows/*.html, docs/architecture/states/*.html, docs/architecture/changes/*.html and docs/architecture/data-models/*.html   diagrammer only (facts spec'd by architect)
//   any other file under docs/architecture/ no subagent
//   docs/plan/<task>-gantt.html, docs/plan/<task>-story-map.html   diagrammer only (facts spec'd by product-manager)
//   docs/design/screen-map.html              diagrammer only (facts spec'd by designer)
//   docs/design-system/                       designer and architect (onboard) only
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the agent), 0 = allow.
// Only subagent calls are guarded (the payload names the subagent in `agent_type`); a call with no `agent_type` is the
// Orchestrator's own session or the user and is never blocked. Bash writes are not seen (known limit).
import { readFileSync } from 'node:fs';
import { blockingRule, roleOf, blockMessage } from './write-scope.mjs';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // cannot tell who is calling: nothing to guard
}

if (!WRITE_TOOLS.has(input.tool_name ?? '')) process.exit(0);
const role = roleOf(input.agent_type);
if (!role) process.exit(0);
const rule = blockingRule(role, input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '', input.cwd ?? process.cwd());
if (rule) {
  console.error(blockMessage(role, rule));
  process.exit(2);
}
process.exit(0);
