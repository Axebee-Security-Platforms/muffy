#!/usr/bin/env node
// PreToolUse guard on Agent|Task: no subagent starts before the human gates of its step are answered
// (references/hooks-enforcement.md §14; gates in references/step-details.md 2b and 3c).
// The Orchestrator's spawn carries the prompt envelope, whose first header is `Task: <task>` (make-envelope.mjs).
// Fails closed: a gated muffy role spawned without the header is checked against the task its prompt names
// (`.worktrees/feature-<task>` or `.team/<task>`), and blocked when it names none while a run exists here.
// A spawn of a role outside muffy, or in a repo with no checkpoint, is never blocked.
// Fix lane: a frontend-dev / backend-dev step-4 spawn is also blocked until the auditor's `confirm` (or the accepted risk) is on record.
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the Orchestrator), 0 = allow.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { missingGates, gatesForSpawn, auditMissing, PAUSE_OF, MUFFY_ROLES } from './gate-rules.mjs';
import { guardOff } from './plugin-gate.mjs';

if (guardOff()) process.exit(0); // plugin install without MUFFY_GUARD=1: the project did not opt in

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
if (!role) process.exit(0);

const cwd = input.cwd ?? process.cwd();
const cpDir = (task) => [join(cwd, '.worktrees', `feature-${task}`, '.team', task), join(cwd, '.team', task)]
  .find((d) => existsSync(join(d, 'checkpoint.md')));
const header = prompt.match(/^Task:[ \t]*(\S+)[ \t]*$/m)?.[1];

let task = header;
if (!task) {
  // a role outside muffy, or one that runs before the gates, needs no task to be told apart
  if (!MUFFY_ROLES.has(role) || !gatesForSpawn(role).length) process.exit(0);
  const named = [...prompt.matchAll(/\.worktrees[\\/]feature-([\w.-]+)|\.team[\\/]([\w.-]+)/g)]
    .map((m) => m[1] ?? m[2]).filter((t) => t !== 'brain');
  task = named.find((t) => cpDir(t));
  if (!task) {
    if (!anyRun()) process.exit(0);
    console.error(`[muffy] blocked: ${role} may not start: the prompt has no \`Task: <task>\` header and names no task with a checkpoint. Build the prompt with make-envelope.mjs, so the gates of its task can be checked (references/hooks-enforcement.md §14).`);
    process.exit(2);
  }
}

const dir = cpDir(task);
const cp = dir ? readFileSync(join(dir, 'checkpoint.md'), 'utf8') : null;

const handoffs = [];
if (dir && existsSync(join(dir, 'handoff'))) {
  for (const f of readdirSync(join(dir, 'handoff')).filter((n) => /^4[ab]-.*\.json$/.test(n))) {
    try { handoffs.push(JSON.parse(readFileSync(join(dir, 'handoff', f), 'utf8'))); } catch { /* an unreadable hand-off is no confirm */ }
  }
}
const noAudit = auditMissing(cp, role, prompt, handoffs);
if (noAudit) {
  console.error(`[muffy] blocked: ${role} may not start step 4 for "${task}": ${noAudit} (references/fix-profile.md, hooks-enforcement.md §14).`);
  process.exit(2);
}

const missing = missingGates(cp, role, prompt);
if (!missing.length) process.exit(0);

const ask = missing.map((g) => `${g} (pause:${PAUSE_OF[g]})`).join(', ');
const why = cp === null
  ? `checkpoint.md for "${task}" does not exist, so no gate can be passed. Setup writes it before any spawn past product-manager (references/setup.md)`
  : `gate ${missing.join(', ')} not passed for "${task}"`;
console.error(`[muffy] blocked: ${role} may not start: ${why}. Ask the user ${ask} first: save the pause with checkpoint.mjs pause, build the question with gate-summary.mjs, then record the answer with checkpoint.mjs gate (references/hooks-enforcement.md §14).`);
process.exit(2);

// a muffy run exists here when any task folder, in the repo or a feature worktree, has a checkpoint
function anyRun() {
  const has = (teamDir) => existsSync(teamDir) && readdirSync(teamDir, { withFileTypes: true })
    .some((e) => e.isDirectory() && existsSync(join(teamDir, e.name, 'checkpoint.md')));
  if (has(join(cwd, '.team'))) return true;
  const wt = join(cwd, '.worktrees');
  return existsSync(wt) && readdirSync(wt, { withFileTypes: true })
    .some((e) => e.isDirectory() && e.name.startsWith('feature-') && has(join(wt, e.name, '.team')));
}
