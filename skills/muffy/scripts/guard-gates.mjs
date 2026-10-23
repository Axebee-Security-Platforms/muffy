#!/usr/bin/env node
// PreToolUse guard on Agent|Task: no subagent starts before the human gates of its step are answered
// (references/hooks-enforcement.md §14; gates in references/step-details.md 2b and 3c).
// The Orchestrator's spawn carries the prompt envelope, whose first header is `Task: <task>` (make-envelope.mjs).
// A spawn with no `Task:` header is not a muffy spawn and is never blocked.
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the Orchestrator), 0 = allow.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { missingGates, PAUSE_OF } from './gate-rules.mjs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // cannot tell what is being spawned: nothing to guard
}

if (!['Agent', 'Task'].includes(input.tool_name ?? '')) process.exit(0);
const spawn = input.tool_input ?? {};
const role = String(spawn.subagent_type ?? '').split(':').pop();
const prompt = String(spawn.prompt ?? '');
const task = prompt.match(/^Task:[ \t]*(\S+)[ \t]*$/m)?.[1];
if (!role || !task) process.exit(0);

const cwd = input.cwd ?? process.cwd();
const dir = [join(cwd, '.worktrees', `feature-${task}`, '.team', task), join(cwd, '.team', task)]
  .find((d) => existsSync(join(d, 'checkpoint.md')));
const cp = dir ? readFileSync(join(dir, 'checkpoint.md'), 'utf8') : null;

const missing = missingGates(cp, role, prompt);
if (!missing.length) process.exit(0);

const ask = missing.map((g) => `${g} (pause:${PAUSE_OF[g]})`).join(', ');
const why = cp === null
  ? `checkpoint.md for "${task}" does not exist, so no gate can be passed. Setup writes it before any spawn past product-manager (references/setup.md)`
  : `gate ${missing.join(', ')} not passed for "${task}"`;
console.error(`[muffy] blocked: ${role} may not start: ${why}. Ask the user ${ask} first: save the pause with checkpoint.mjs pause, build the question with gate-summary.mjs, then record the answer with checkpoint.mjs gate (references/hooks-enforcement.md §14).`);
process.exit(2);
