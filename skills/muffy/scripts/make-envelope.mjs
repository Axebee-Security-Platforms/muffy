#!/usr/bin/env node
// Build a subagent prompt from the envelope template in references/token-discipline.md, so the Orchestrator
// passes flags instead of typing the template and the hand-off boilerplate on every spawn. Zero dependencies.
//
//   node make-envelope.mjs --role backend-dev --step 4 --round 1 --task login-flow --brain .team/brain \
//        --goal "Build the login endpoints" --done-when "handoff validates and every AC-n is listed" \
//        --read ac.md,contract.md --write src/auth/ --dont-touch "src/ui/" \
//        --worktree .worktrees/be-login-flow --branch be/login-flow --trailer "Co-Authored-By: ..."
//   node make-envelope.mjs --json envelope.json --role qa-tester --step 7 --round 1     (envelope fields from a file)
//
// Flags: --role --step --round --task --brain --goal --done-when --read --write --dont-touch (comma lists)
//        --vault --mode --worktree --branch --profile fix|lite --test-level L0..L4 --checkpoint --human-approved
//        --trailer --announcement --pr-diagram --full-regression --team-dir <dir>   (booleans take no value)
// A bare file name ending in .md/.json/.csv/.html in --read/--write is placed under --team-dir (default
// .worktrees/feature-<task>/.team/<task>); anything with a slash is used as given. The hand-off file is added to Write
// for every role except code-reviewer, which has no Write tool.
// A Write: path the role may not write (guard-write-scope.mjs rules, shared in write-scope.mjs) is refused with exit 1, and a
// "Shared files you may not write" line is added to the prompt.
// Output: the prompt on stdout. The envelope is validated against schemas/prompt-envelope.schema.json first;
// on error nothing is printed to stdout, the errors go to stderr, exit 1. Exit 2 = bad usage.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './schema.mjs';
import { blockingRule, blockMessage, dontWriteLine } from './write-scope.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BOOL = new Set(['announcement', 'pr-diagram', 'full-regression']);
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { console.error(`unexpected argument: ${a}`); process.exit(2); }
  const k = a.slice(2);
  if (BOOL.has(k)) args[k] = true;
  else if (i + 1 < argv.length) args[k] = argv[++i];
  else { console.error(`--${k} needs a value`); process.exit(2); }
}

let env = {};
if (args.json) env = JSON.parse(readFileSync(args.json, 'utf8'));
const list = (v) => (Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean));
const set = (key, flag, f = (x) => x) => { if (args[flag] !== undefined) env[key] = f(args[flag]); };
set('goal', 'goal'); set('done_when', 'done-when'); set('task', 'task'); set('brain', 'brain'); set('vault', 'vault');
set('mode', 'mode', (m) => (/^[123]$/.test(m) ? Number(m) : m)); set('worktree', 'worktree'); set('branch', 'branch');
set('read', 'read', list); set('write', 'write', list); set('dont_touch', 'dont-touch', list);
set('profile', 'profile'); set('test_level', 'test-level'); set('checkpoint', 'checkpoint');
set('human_approved', 'human-approved'); set('commit_trailer', 'trailer');
if (args.announcement) env.announcement = true;
if (args['pr-diagram']) env.pr_diagram = true;
if (args['full-regression']) env.full_regression = true;
env.dont_touch ??= [];

const role = args.role, step = args.step ?? env.step, round = args.round ?? env.round ?? '1';
if (!role || !step || !env.task) { console.error('need --role, --step and --task (flags or --json)'); process.exit(2); }

const teamDir = (args['team-dir'] ?? `.worktrees/feature-${env.task}/.team/${env.task}`).replace(/\/$/, '');
const place = (p) => (/[\\/]/.test(p) || !/\.(md|json|csv|html)$/.test(p) ? p : `${teamDir}/${p}`);
env.read = (env.read ?? []).map(place);
env.write = (env.write ?? []).map(place);
const reviewerNoWrite = role === 'code-reviewer';
const handoffPath = `${teamDir}/handoff/${step}-${role}-r${round}.json`;
if (!reviewerNoWrite && !env.write.includes(handoffPath)) env.write.push(handoffPath);

// Refuse a Write: path the guard would block, so the agent is never sent to a file it cannot write (hooks-enforcement.md section 12).
const blockedWrites = env.write.map((p) => [p, blockingRule(role, p)]).filter(([, r]) => r).map(([p, r]) => `${p}: ${blockMessage(role, r)}`);
if (blockedWrites.length) { console.error(`Write: not allowed for ${role}:\n- ${blockedWrites.join('\n- ')}`); process.exit(1); }

const errs = validate(JSON.parse(readFileSync(join(here, '..', 'schemas', 'prompt-envelope.schema.json'), 'utf8')), env);
if (errs.length) { console.error(`envelope invalid:\n- ${errs.join('\n- ')}`); process.exit(1); }

const example = JSON.stringify({ role, task: env.task, step: String(step), round: Number(round), status: 'done', paths_written: ['<path>'], blockers: [], quality_checks: { passed: true, failed: [] }, summary: 'one line' });
const header = [`Task: ${env.task}`, `Brain: ${env.brain}`];
if (env.vault) header.push(`Vault: ${env.vault}`);
if (env.mode !== undefined) header.push(`Mode: ${env.mode}`);
if (env.profile) header.push(`Profile: ${env.profile}`);
const out = [`Goal: ${env.goal}`];
if (env.done_when) out.push(`Done when: ${env.done_when}`);
out.push(header.join('  '));
if (env.worktree) out.push(`Worktree: ${env.worktree}${env.branch ? ` · Branch: ${env.branch}` : ''}`);
out.push(`Read: ${env.read.join(', ')}`, `Write: ${env.write.join(', ')}`, `Don't touch: ${env.dont_touch.join(', ') || 'nothing beyond Write'}`);
const dontWrite = dontWriteLine(role);
if (dontWrite && !reviewerNoWrite) out.push(dontWrite);
if (env.announcement) out.push('Announcement: yes');
if (env.pr_diagram) out.push('PR diagram: yes');
if (env.human_approved) out.push(`Human approved: ${env.human_approved}`);
if (env.test_level) out.push(`Test level: ${env.test_level}`);
if (env.full_regression) out.push('Full regression: approved');
if (env.checkpoint) out.push(`Checkpoint: ${env.checkpoint} — read only ## Goal and ## Open blockers`);
if (env.commit_trailer) out.push(`Commit trailer: ${env.commit_trailer}`);
out.push(
  reviewerNoWrite
    ? 'Final message: the review (blockers first, one-line verdict, ≤ 120 lines), then the one-line JSON hand-off block. Do not Read handoff.schema.json; the shape is below.'
    : 'Final message (silent execution): on success (`status: done`, no blockers, checks passed) output ONLY the one-line JSON hand-off block, no prose; results, paths and details go in the JSON (`summary` ≤ 1 line) and the files. Prose (≤ 8 lines, ≤ 1,200 characters) only on an error, `blocked`/`not-ready`, or a decision the Orchestrator or user must make, with blockers `B-n`. Then the one-line JSON hand-off block. Do not Read handoff.schema.json; copy this shape and run validate-handoff.mjs on the file.',
  `Hand-off shape: ${example}`
);
process.stdout.write(out.join('\n') + '\n');
