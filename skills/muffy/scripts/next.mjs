#!/usr/bin/env node
// The fix lane, one step at a time. The Orchestrator no longer reads the lane's steps and types their commands: it runs this
// script, does the one thing the last line says (spawn an agent, ask the user, report), and runs it again. The script does the
// file and git work between those things, and the rules it applies are the existing ones (next-action.mjs, lanes.mjs,
// checkpoint.mjs, test-gate.mjs, ...): it calls them, it does not copy them. Zero dependencies, Node 18+.
//
//   node next.mjs start  --task fix-<slug> --scope bug|cosmetic --owner FE|BE|both --request "<verbatim>" --symptom "<one line>"
//                        --ac "AC-1 | observable result | test or visual check" [--ac ...] [--repro "<test, command or log line>"]
//                        [--out-of-scope "<text>"] [--base <branch>] [--signals '<triage json>'] [--line-known] [--trailer "<line>"]
//                        [--lang th|en] [--approved]
//        Setup for the lane: baseline check, scope question (asked, or recorded in headless mode), brain, worktree, fix.md,
//        checkpoint. Prints the first action. Nothing is written before the scope is approved.
//   node next.mjs step   <task>          after an agent returned: read its hand-off, do the bookkeeping, print the next action
//   node next.mjs review <task>          after the code-reviewer returned: its whole final message on stdin
//   node next.mjs answer <task> "<label>"   the user's answer to the Human gate question (interactive runs)
// Every command takes --repo <dir> (default: the current folder; a task worktree resolves to its main checkout).
//
// Output: `action=<name>` first, then `key=value` lines. Actions:
//   spawn      role, step, round, agent, model, then the prompt between `---prompt---` lines. Several spawns: one block each,
//              start them in one message
//   ask        gate, then the AskUserQuestion input between `---questions---` lines; run the command in `then=` with the answer
//   route      the request is not a fix (ask, full flow, no lane): reason lines; nothing was written
//   stop       blocked, escalated or promoted: reason, and `muffy-status=` when headless
//   onboard    the baseline needs onboarding first: depth, then run start again
//   done       the task is closed: final-message facts
// Exit 0 = an action to take, 1 = stop, 2 = usage or input error.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync, rmSync, renameSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { validate } from './schema.mjs';
import { simulate, triage, baselineAction, FIX_MAX_FILES } from './next-action.mjs';
import { planCard, parseRunProfile, STEP_ORDER } from './lanes.mjs';
import { headlessOf } from './headless.mjs';
import { mainCheckout } from './sync-worktree.mjs';
import { checkTask } from './check-checkpoint.mjs';
import { flowStart, flowStep, flowAnswer, flowRecord } from './next-flow.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMAS = join(here, '..', 'schemas');
const handoffSchema = JSON.parse(readFileSync(join(SCHEMAS, 'handoff.schema.json'), 'utf8'));
const DEV = { FE: 'frontend-dev', BE: 'backend-dev' };
const SIDE = { FE: 'fe', BE: 'be' };
const slash = (p) => String(p).replace(/\\/g, '/');
const read = (p, d = '') => { try { return readFileSync(p, 'utf8').replace(/\r\n/g, '\n'); } catch { return d; } };

/* ---------- arguments ---------- */

export function parseArgs(argv, multi = ['ac']) {
  const BOOL = new Set(['approved', 'line-known', 'dry-run', 'lost', 'rerun']);
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if (BOOL.has(k)) { o[k] = true; continue; }
    if (i + 1 >= argv.length) throw new Error(`--${k} needs a value`);
    const v = argv[++i];
    if (multi.includes(k)) (o[k] ??= []).push(v); else o[k] = v;
  }
  return o;
}

/* ---------- the other scripts, called as a person would ---------- */

const node = (script, args, o = {}) => spawnSync(process.execPath, [join(here, script), ...args], { cwd: o.cwd, encoding: 'utf8', input: o.input, env: o.env ?? process.env });
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (cwd, ...a) => { try { git(cwd, ...a); return true; } catch { return false; } };
const lines = (s) => String(s ?? '').split('\n').filter(Boolean);

/* ---------- where a task lives ---------- */

export function locate(repo, task) {
  const main = mainCheckout(resolve(repo));
  const feature = join(main, '.worktrees', `feature-${task}`);
  const team = join(feature, '.team', task);
  return { main, feature, team, brain: brainOf(main), handoffs: join(team, 'handoff'), rel: (p) => slash(p).replace(`${slash(main)}/`, '') };
}

// <vault>/Projects/<repo>/ when SECOND_BRAIN_VAULT names a real folder, else .team/brain (setup.md step 1)
function brainOf(main) {
  const vault = process.env.SECOND_BRAIN_VAULT;
  if (vault && !vault.includes('<') && existsSync(vault)) return join(vault, 'Projects', basename(main));
  return join(main, '.team', 'brain');
}

const trailerOf = (c) => read(join(c.team, 'trailer.txt')).trim();
const statusLine = (c, key) => read(join(c.team, 'checkpoint.md')).match(new RegExp(`^[-*\\s]*${key}:\\s*(.+)$`, 'mi'))?.[1].trim();
const isPlugin = () => existsSync(join(here, '..', '..', '..', '.claude-plugin'));
const agentName = (role) => (isPlugin() ? `muffy:${role}` : role);

// every hand-off of the task, in the order check-all.mjs reads them: by round, then step order (a fix round comes after the review that sent it)
// the file name carries step and round (`<step>-<role>-r<n>.json`), so a hand-off that is invalid, or has no round, still has its place in the order
const keyOf = (x) => Number(x.name.match(/-r(\d+)\.json$/)?.[1] ?? x.handoff?.round ?? 0);
export function handoffsOf(c) {
  if (!existsSync(c.handoffs)) return [];
  return readdirSync(c.handoffs).filter((f) => f.endsWith('.json')).map((f) => {
    const file = join(c.handoffs, f);
    let h = null;
    try { h = JSON.parse(readFileSync(file, 'utf8')); } catch { /* an unreadable file is an invalid hand-off */ }
    return { file, name: f, handoff: h };
  }).sort((a, b) => keyOf(a) - keyOf(b) || STEP_ORDER.indexOf(stepOfFile(a.name)) - STEP_ORDER.indexOf(stepOfFile(b.name)));
}

const log = (c, key, extra = '') => appendFileSync(join(c.team, 'next.log'), `${new Date().toISOString()}\t${key}${extra ? `\t${extra}` : ''}\n`);
// the model and effort a spawn was issued with, for the spawn log when its hand-off comes back
const issuedWith = (c, key) => lines(read(join(c.team, 'next.log'))).map((l) => l.split('\t')).find((p) => p[1] === key && p[2]);
const issued = (c, key) => lines(read(join(c.team, 'next.log'))).filter((l) => l.split('\t')[1] === key).length;

/* ---------- the action a call prints ---------- */

const out = [];
const say = (k, v) => out.push(v === undefined ? k : `${k}=${v}`);
const flush = (code = 0) => { console.log(out.join('\n')); return code; };

const brainArg = (c) => (slash(c.brain).startsWith(`${slash(c.main)}/`) ? slash(c.brain).slice(slash(c.main).length + 1) : slash(c.brain));

function sayPrompt(prompt) { out.push('---prompt---', prompt.trimEnd(), '---prompt---'); }

// Builds the prompt with make-envelope.mjs and tells the Orchestrator to spawn. `spec` = { role, step, round, goal, doneWhen, read, write, dontTouch, worktree, branch, lineKnown }
function spawnAction(c, spec, extra = []) {
  const flags = ['--role', spec.role, '--step', spec.step, '--round', String(spec.round), '--task', spec.task, '--brain', brainArg(c),
    ...(spec.header ?? ['--profile', 'fix']), '--goal', spec.goal, '--done-when', spec.doneWhen, '--read', spec.read.join(','), '--write', spec.write.join(','), '--dont-touch', spec.dontTouch.join(','), ...extra];
  if (spec.worktree) flags.push('--worktree', slash(spec.worktree), '--branch', spec.branch);
  if (spec.round > 1) flags.push('--checkpoint', `${slash(c.team)}/checkpoint.md`);
  if (spec.lineKnown) flags.push('--line-known');
  const trailer = trailerOf(c);
  if (trailer) flags.push('--trailer', trailer);
  // paths: absolute, so the prompt works from any folder and the agent's worktree and the team folder cannot be confused
  const r = node('make-envelope.mjs', ['--team-dir', slash(c.team), ...flags], { cwd: c.main });
  if (r.status !== 0) throw new Error(`make-envelope failed for ${spec.role} ${spec.step}: ${r.stderr.trim()}`);
  const m = r.stderr.match(/Spawn: model=(\S+) effort=(\S+)/);
  const key = `${spec.step}:${spec.role}:r${spec.round}`;
  log(c, key, `${m?.[1] ?? 'default'}\t${m?.[2] ?? 'default'}`);
  // The envelope (goal, files, rules, the hand-off shape: about 1.7 KB) is a file, so the Agent call carries a few lines instead of the
  // whole text, in the Orchestrator's output and in every later request's context. guard-gates.mjs reads the file and blocks a spawn whose
  // envelope is missing, unreadable or for another task or role.
  const envPath = slash(join(c.team, 'envelopes', `${spec.step}-${spec.role}-r${spec.round}.md`));
  mkdirSync(dirname(envPath), { recursive: true });
  writeFileSync(envPath, r.stdout);
  const h = spec.header ?? ['--profile', 'fix'];
  const short = [
    `Task: ${spec.task}`,
    `Brain: ${brainArg(c)}${h.length ? `  ${h[0] === '--profile' ? 'Profile' : 'Scope'}: ${h[1]}` : ''}`,
    `Step: ${spec.step} · Round: ${spec.round} · Role: ${spec.role}`,
    ...(spec.role === 'code-reviewer' ? [] : [`Hand-off: ${slash(c.team)}/handoff/${spec.step}-${spec.role}-r${spec.round}.json`]),
    `Envelope: ${envPath}`,
    'First action: Read the envelope above in full, then follow it exactly: it holds your goal, the files you read and write, your rules and the hand-off shape. Start nothing before reading it.',
  ].join('\n');
  out.push(`action=spawn`);
  say('role', spec.role); say('step', spec.step); say('round', spec.round); say('agent', agentName(spec.role));
  say('model', m?.[1] ?? 'default'); say('description', `${spec.role} ${spec.step} r${spec.round}`.slice(0, 40)); say('envelope', envPath);
  sayPrompt(short);
}

/* ---------- the three state files the lane keeps (checkpoint, fix.md, task note) ---------- */

const fixMd = ({ task, scope, owner, request, symptom, repro, acs, outOfScope }) => `# Fix: ${task}
Kind: ${scope}    Owner: ${owner}
## Goal
${request}
## Symptom
${symptom}
## Cause

## Repro
${repro || ''}
## Evidence

## AC
| id | result | check |
|---|---|---|
${acs.map((a) => `| ${a.split('|').map((x) => x.trim()).join(' | ')} |`).join('\n')}
## Out of scope
${outOfScope || 'Anything the request does not name.'}
`;

const checkpointMd = ({ task, request, base, baseline, owner, lineKnown }) => `# Checkpoint: ${task}
Updated: step setup · round 0

## Goal
${request}

## Run profile
lane: fix · skipped 1, 2, 2b, 3, 3b, 3c, 3d

## Status
base: ${base}
route: fix · intake: 0 asked
${baseline ? `baseline: ${baseline}\n` : ''}${lineKnown ? 'line-known: yes\n' : ''}owner: ${owner}
next: 4a · debugger · diagnose

## Decisions in force
none

## Loop counters
none

## Open blockers
none

## History
none
`;

/* ---------- start ---------- */

function questionsFor(o, plan) {
  const q = [
    { question: `${plan.join('\n')}\n\nเริ่มตามแผนนี้ไหม? / Go with this plan?`, header: 'Plan', multiSelect: false, options: [
      { label: 'go (recommended)', description: 'Run the fix lane as shown' },
      { label: 'bigger', description: 'Move up a route (change or full flow); nothing is spawned' },
    ] },
    { question: `Acceptance criteria:\n${o.ac.map((a) => `- ${a}`).join('\n')}\nOut of scope: ${o['out-of-scope'] || 'anything the request does not name'}`, header: 'AC', multiSelect: false, options: [
      { label: 'Confirm', description: 'Use these AC' },
      { label: 'Change it', description: 'The user edits the AC first' },
    ] },
  ];
  return q;
}

export function start(o) {
  if (o.lane && o.lane !== 'fix') return flowStart(o);
  const need = ['task', 'scope', 'owner', 'request', 'symptom'].filter((k) => !o[k]);
  if (need.length || !o.ac?.length) throw new Error(`start needs ${[...need.map((k) => `--${k}`), ...(o.ac?.length ? [] : ['--ac'])].join(', ')}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.task)) throw new Error(`--task ${o.task}: lower-case words joined by hyphens`);
  if (!['bug', 'cosmetic'].includes(o.scope)) throw new Error('--scope is bug or cosmetic');
  if (!['FE', 'BE', 'both'].includes(o.owner)) throw new Error('--owner is FE, BE or both');
  const c = locate(o.repo ?? '.', o.task);
  const headless = headlessOf(process.env).headless;

  // 0. a task that already started continues, so a second `start` never overwrites fix.md
  if (existsSync(join(c.team, 'fix.md'))) { say('note', 'the task already started: continuing'); return step({ ...o, _: [o.task] }); }

  // 1. is this a fix at all (the signals are the Orchestrator's reading of the request; the rule is next-action.mjs triage)
  if (o.signals) {
    const t = triage(JSON.parse(o.signals));
    if (t.lane !== 'fix') { out.push('action=route'); say('lane', t.lane); t.reasons.forEach((r) => say('reason', r)); say('written', 'nothing'); return flush(1); }
  }

  // 2. the baseline the lane needs
  const repoDir = c.main;
  const bl = node('check-baseline.mjs', [repoDir, '--json'], { cwd: repoDir });
  let facts = {};
  try { facts = JSON.parse(bl.stdout); } catch { facts = { baseline: 'missing' }; }
  const hasCode = !(node('scan-repo.mjs', [repoDir], { cwd: repoDir }).stdout.includes('"hasCode": false'));
  const act = baselineAction({ colour: facts.baseline, depth: facts.depth, hasCode, lane: 'fix', scope: o.scope, headless });
  if (act.next !== 'continue') {
    if (act.next.startsWith('onboard') || act.next.startsWith('ask:onboard')) {
      out.push('action=onboard'); say('depth', act.next.replace(/^(ask:)?onboard-/, '')); say('reason', act.reason);
      say('then', 'write .team/onboard/pending-request.md with the request and this command, run onboard.md at that depth, then run this start command again');
      return flush(0);
    }
    if (act.next === 'ask:red') { out.push('action=onboard'); say('depth', 'refresh'); say('reason', act.reason); say('then', 'read baseline-freshness.md and ask as it says'); return flush(0); }
    out.push('action=onboard'); say('depth', 'refresh'); say('reason', act.reason); say('then', 'refresh the baseline from the delta (onboard.md), commit it, then run this start command again'); return flush(0);
  }

  // 3. the base branch (setup.md step 5: never assumed to be main)
  const current = git(repoDir, 'rev-parse', '--abbrev-ref', 'HEAD');
  const base = o.base ?? current;
  const card = planCard('fix', { scope: o.scope, lang: o.lang ?? 'th' });

  // 4. the scope question: asked of a person, recorded in headless mode (headless.md rule H3, after the checkpoint exists)
  if (!headless && !o.approved) {
    out.push('action=ask'); say('gate', 'scope'); say('written', 'nothing');
    out.push('---questions---', JSON.stringify({ questions: questionsFor(o, card) }), '---questions---');
    say('then', `run the same start command again with --approved${o.base ? '' : ` (the base is ${base})`}; "bigger" or "Change it": start nothing and re-route or re-draft`);
    return flush(0);
  }

  // 5. the files
  const dry = !!o['dry-run'];
  if (dry) { say('dry-run', 'would create brain, task note, the feature worktree, fix.md, checkpoint.md and commit them'); return flush(0); }
  mkdirSync(join(c.brain, 'tasks'), { recursive: true });
  mkdirSync(join(c.brain, 'agents'), { recursive: true });
  const project = join(c.brain, 'project.md');
  if (!existsSync(project)) writeFileSync(project, `# Project\n\n## Tasks\n\n## Lessons\n\n## Open issues\n`);
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(join(c.brain, 'tasks', `${o.task}.md`), `---\nproject: ${basename(c.main)}\ntask: ${o.task}\ndate: ${date}\nstatus: in progress\n---\n# ${o.task}\n\n${o.request}\n`);
  const proj = read(project);
  if (!proj.includes(`${o.task}:`)) writeFileSync(project, proj.replace(/(## Tasks\n)/, `$1- ${o.task}: in progress\n`));
  node('init-config.mjs', ['.'], { cwd: repoDir });

  if (!existsSync(c.feature)) git(repoDir, 'worktree', 'add', slash(c.feature), '-b', `feature/${o.task}`, base);
  mkdirSync(c.handoffs, { recursive: true });
  mkdirSync(join(c.team, 'rounds'), { recursive: true });
  writeFileSync(join(c.team, 'fix.md'), fixMd({ task: o.task, scope: o.scope, owner: o.owner, request: o.request, symptom: o.symptom, repro: o.repro, acs: o.ac, outOfScope: o['out-of-scope'] }));
  writeFileSync(join(c.team, 'checkpoint.md'), checkpointMd({ task: o.task, request: o.request, base, baseline: facts.baseline && facts.baseline !== 'missing' ? `${facts.baseline}${facts.depth ? ` (${facts.depth})` : ''}` : '', owner: o.owner, lineKnown: !!o['line-known'] }));
  if (o.trailer) writeFileSync(join(c.team, 'trailer.txt'), `${o.trailer}\n`);
  const p = node('checkpoint.mjs', ['profile', slash(c.team), 'fix', '--scope', o.scope]);
  if (p.status !== 0) throw new Error(`checkpoint profile failed: ${p.stdout}${p.stderr}`);
  commitTeam(c, `docs(fix): fix.md for ${o.task}`);

  // 6. headless: the scope pause is recorded by rule H3 (or stops the run when the answer would be a person's)
  if (headless) {
    const a = node('checkpoint.mjs', ['ask', slash(c.team), 'scope', '--triage-passed', '--ac-from-request'], { cwd: c.main });
    if (!/next=continue/.test(a.stdout)) { return stopFromAsk(a.stdout, a.stderr); }
    commitTeam(c, `docs(fix): scope recorded for ${o.task}`);
  }
  return step({ ...o, _: [o.task] });
}

function commitTeam(c, message) {
  compactCheckpoint(c);
  git(c.feature, 'add', '.team');
  if (!gitOk(c.feature, 'diff', '--cached', '--quiet')) git(c.feature, 'commit', '-q', '-m', `${message}${trailerOf(c) ? `\n\n${trailerOf(c)}` : ''}`);
}

function stopFromAsk(text, errors = '') {
  out.push('action=stop');
  for (const l of lines(text)) say('detail', l);
  for (const l of lines(errors)) say('error', l);
  return flush(1);
}

/* ---------- step ---------- */

const sideOf = (owner) => (owner === 'both' ? ['FE', 'BE'] : [owner]);

// the 4a diagnosis the dev is sent to fix: the latest known one
const lastOf = (hs, step) => hs.filter((x) => x.handoff && String(x.handoff.step) === step).at(-1);

// A haiku spawn that needed a re-run (an invalid hand-off, failed quality checks, a fix round after a reject) is written to the project's
// `## Lessons` as a fixed line, `- model-fail: <role> haiku · <task> · <why>`, once per role. spawnProfile (next-action.mjs) reads exactly that line
// and keeps the agent's default model for the role from then on (token-discipline.md "Learn from this project's spawn history").
export function recordModelFail(c, role, step, round, why) {
  if (issuedWith(c, `${step}:${role}:r${round}`)?.[2] !== 'haiku') return false;
  const f = join(c.brain, 'project.md');
  let t = read(f);
  if (!t || new RegExp(`^- model-fail: ${role} haiku\\b`, 'm').test(t)) return false;
  const line = `- model-fail: ${role} haiku · ${basename(c.team)} · ${String(why).replace(/\s+/g, ' ').slice(0, 100)}`;
  t = /^## Lessons\n/m.test(t) ? t.replace(/^(## Lessons\n)/m, `$1${line}\n`) : `${t.trimEnd()}\n\n## Lessons\n${line}\n`;
  writeFileSync(f, t);
  return true;
}

// A hand-off that failed for the environment (failure_kind: environment) is outside the loop budget: the run stops, says what to fix,
// and `step <task> --rerun` runs the step again at the same round number (the failed hand-off is set aside as <name>.env)
export function envStop(c, hs, task) {
  const bad = hs.filter((x) => x.handoff?.failure_kind === 'environment').at(-1);
  out.push('action=stop'); say('outcome', 'environment');
  say('reason', `${bad?.handoff?.role ?? 'an agent'} ${bad?.handoff?.step ?? ''} r${bad?.handoff?.round ?? ''} failed for the environment, not the work: it does not count toward the loop limit`);
  for (const b of bad?.handoff?.blockers ?? []) say('blocker', `${b.id} · ${b.owner} · ${b.problem}`);
  say('then', `fix the environment (docker, the Node version, a credential, a rate limit), then run: node next.mjs step ${task} --rerun`);
  if (headlessOf(process.env).headless) say('muffy-status', 'blocked:environment');
  return flush(1);
}

export function setAsideEnv(c) {
  for (const x of handoffsOf(c)) if (x.handoff?.failure_kind === 'environment') renameSync(x.file, `${x.file}.env`);
}

export function step(o) {
  const task = o._[0] ?? o._[1];
  if (!task) throw new Error('step needs a task name');
  const c = locate(o.repo ?? '.', task);
  if (!existsSync(join(c.team, 'checkpoint.md'))) throw new Error(`no task ${task} at ${c.team}: run start first`);
  if (o.rerun) { setAsideEnv(c); o.lost = true; }
  const cp = read(join(c.team, 'checkpoint.md'));
  const lane = parseRunProfile(cp);
  if (lane.lane !== 'fix') return flowStep(o);
  const hs = handoffsOf(c);
  const base = statusLine(c, 'base') ?? 'main';
  const owner = statusLine(c, 'owner') ?? 'BE';
  const lineKnown = /^line-known:\s*yes/mi.test(cp);
  const spec = (role, stepId, round, more) => ({ role, step: stepId, round, task, ...more });
  const T = c.team, W = c.feature;
  const fixRel = `${slash(T)}/fix.md`;
  const ho = (name) => `${slash(T)}/handoff/${name}`;
  const common = { dontTouch: ['nothing outside the files you may write'] };

  // a closed task stays closed
  if (/^## Status[\s\S]*?^closed\b/m.test(cp) || /^closed\b/m.test(cp.split('## Status')[1] ?? '')) { out.push('action=done'); say('note', 'the task is already closed'); return flush(0); }

  // 1. nothing back yet: diagnose
  if (!hs.length) {
    spawnAction(c, spec('debugger', '4a', 1, {
      goal: `Diagnose the bug in fix.md: cause, repro, evidence, severity and owner. No code change.`,
      doneWhen: 'fix.md has Cause, Repro and Evidence, and the diagnosis hand-off validates',
      read: [fixRel], write: [fixRel], dontTouch: ['source files', 'tests'], worktree: W, branch: `feature/${task}`, lineKnown,
    }));
    return flush(0);
  }

  // 2. the loop rules the lane already has, over every hand-off so far
  const sim = simulate({ task, profile: 'fix', scope: lane.scope ?? 'bug', until: lane.until ?? undefined, skip: lane.skipped, events: hs.map((x) => ({ handoff: x.handoff, file: x.file })) });
  const act = sim.actions.at(-1) ?? 'none';
  const lastEv = hs.at(-1);
  const lh = lastEv.handoff;

  if (['escalated', 'blocked', 'promoted', 'invalid-profile', 'cancelled'].includes(sim.outcome) || act.startsWith('promote:') || act === 'close:stop-point') {
    out.push('action=stop'); say('outcome', sim.outcome); say('next', act); if (sim.trigger) say('trigger', sim.trigger);
    for (const v of sim.violations) say('violation', v);
    if (sim.escalation) {
      const f = join(T, 'escalation.json'); writeFileSync(f, JSON.stringify(sim.escalation, null, 2) + '\n');
      say('escalation', slash(f)); say('then', 'add the recommendation and attempts to the escalation, validate it, and tell the user (loops.md)');
    } else say('then', act.startsWith('promote:') ? 'the cause outgrows the fix lane: promote as route.md says' : 'tell the user why the lane stopped');
    if (headlessOf(process.env).headless) say('muffy-status', `blocked:${sim.trigger ?? sim.outcome}`);
    return flush(1);
  }

  const consume = (x) => consumeHandoff(c, x);
  const point = lastEv.handoff ? `${lh.step}:${lh.role}` : '?';

  // 3. the retries the rules ask for: the same step again, one round later, with the errors in a file
  if (act === 'env:wait') return envStop(c, hs, task);
  if (act.startsWith('retry:')) {
    const role = lh?.role ?? roleOfFile(lastEv.name);
    const stepId = String(lh?.step ?? stepOfFile(lastEv.name));
    const round = (lh?.round ?? 1) + 1;
    recordModelFail(c, role, stepId, round - 1, act);
    const errs = lh ? validate(handoffSchema, lh) : ['the file is not valid JSON'];
    writeFileSync(join(T, `retry-${stepId}-${role}-r${round}.md`), `# ${role} ${stepId}: the last hand-off was sent back (${act})\n\n${[...errs, ...(lh?.quality_checks?.failed ?? [])].map((e) => `- ${e}`).join('\n') || '- quality_checks.passed was false'}\n`);
    if (stepId === '6') return fixReviewer(c, hs, spec, { fixRel, ho, task, round, retry: `${slash(T)}/retry-6-${role}-r${round}.md` });
    if (stepId === '4') {
      const side = Object.keys(DEV).find((s) => DEV[s] === role);
      return devSpawn(c, hs, lastOf(hs, '4a').handoff, spec, { fixRel, ho, task, W, round, only: [side], retry: `${slash(T)}/retry-4-${role}-r${round}.md` });
    }
    spawnAction(c, spec(role, stepId, round, { ...stepSpec(stepId, { c, fixRel, ho, task, owner, W, lineKnown, hs, round, retry: `${slash(T)}/retry-${stepId}-${role}-r${round}.md` }) }));
    return flush(0);
  }

  hs.forEach(consume);

  // 4. what the loop says to do after this hand-off
  if (act === 'revalidate:debugger' || act === 'rediagnose:debugger' || act === 'ask:more-evidence') {
    if (act === 'ask:more-evidence') return askUser(c, 'question', 'The debugger could not name the cause (status unknown). What more is known about the bug?');
    const round = (lastOf(hs, '4a')?.handoff.round ?? 1) + 1;
    spawnAction(c, spec('debugger', '4a', round, stepSpec('4a', { c, fixRel, ho, task, owner, W, lineKnown, hs, round, auditFile: lastOf(hs, '4b') ? ho(lastOf(hs, '4b').name) : null })));
    return flush(0);
  }
  if (act === 'ask:reject-options') return askAuditReject(c, lastOf(hs, '4b'));

  if (act === 'accept' || act === 'proceed:risk-accepted') {
    const s = String(lh.step);
    if (s === '4a') {
      const sev = lh.diagnosis?.severity;
      const cosmetic = (lane.scope ?? 'bug') === 'cosmetic' && sev === 'low';
      if (!cosmetic) {
        spawnAction(c, spec('auditor', '4b', 1, stepSpec('4b', { c, fixRel, ho, task, owner, W, hs, round: 1 })));
        return flush(0);
      }
      return devSpawn(c, hs, lh, spec, { fixRel, ho, task, W, round: 1 });
    }
    if (s === '4b' || act === 'proceed:risk-accepted') return devSpawn(c, hs, lastOf(hs, '4a').handoff, spec, { fixRel, ho, task, W, round: 1 });
    if (s === '4') return afterDev(c, hs, lastOf(hs, '4a').handoff, spec, { fixRel, ho, task, W, base });
    if (s === '6') return afterReview(c, lh, { task, base, W });
    if (s === '11') return closeTask(c, { task, base, W, docs: true });
  }
  if (act.startsWith('fix:')) {
    const round = (lastOf(hs, '4')?.handoff.round ?? 1) + 1;
    const owners = act.slice(4).split('+').filter((x) => x in DEV);
    for (const o of owners) recordModelFail(c, DEV[o], '4', round - 1, `sent back by the review: ${lh?.summary ?? 'rejected'}`);
    return devSpawn(c, hs, lastOf(hs, '4a').handoff, spec, { fixRel, ho, task, W, round, only: owners.length ? owners : null, review: `${slash(T)}/review-${lh.round}.md` });
  }
  throw new Error(`next: no rule for ${point} → ${act}; the hand-off files are in ${slash(c.handoffs)}`);
}

const roleOfFile = (name) => name.replace(/^[0-9a-z]+-/, '').replace(/-r\d+\.json$/, '');
const stepOfFile = (name) => name.match(/^([0-9a-z]+)-/)?.[1] ?? '4a';

// the spec of a role's step, in one place, so a retry and the first spawn cannot differ
function stepSpec(stepId, { c, fixRel, ho, task, W, round, retry, auditFile, hs }) {
  const T = slash(c.team);
  const read = [fixRel, ...(retry ? [retry] : [])];
  if (stepId === '4a') {
    return {
      goal: round > 1 ? 'Re-diagnose: add the evidence the auditor says is missing, then update Cause, Repro and Evidence in fix.md' : 'Diagnose the bug in fix.md: cause, repro, evidence, severity and owner. No code change.',
      doneWhen: 'fix.md has Cause, Repro and Evidence, and the diagnosis hand-off validates',
      read: [...read, ...(auditFile ? [auditFile] : [])], write: [fixRel], dontTouch: ['source files', 'tests'], worktree: W, branch: `feature/${task}`,
    };
  }
  if (stepId === '4b') {
    const a = lastOf(hs ?? handoffsOf(c), '4a');
    return {
      goal: 'Audit the diagnosis: re-run the repro once, grade the evidence against the severity, then confirm, ask for validation or reject. No code change.',
      doneWhen: 'the audit hand-off validates with a verdict, repro_rerun and evidence_level',
      read: [...read, ho(a.name)], write: [`${T}/handoff/4b-auditor-r${round}.json`], dontTouch: ['source files', 'tests', 'fix.md'], worktree: W, branch: `feature/${task}`,
    };
  }
  throw new Error(`stepSpec: no spec for step ${stepId}`);
}

function devSpawn(c, hs, diag4a, spec, { fixRel, ho, task, W, round, only, review, retry }) {
  const owner = diag4a.diagnosis?.owner ?? 'BE';
  const sides = (only ?? sideOf(owner)).filter((s) => s in DEV);
  const repo = c.main;
  const testDirs = ['test', 'tests', '__tests__', 'spec'].filter((d) => existsSync(join(c.feature, d)));
  const read = [fixRel, ho(lastOf(hs, '4a').name), ...(lastOf(hs, '4b') ? [ho(lastOf(hs, '4b').name)] : []), ...(review ? [review] : []), ...(retry ? [retry] : [])];
  for (const s of sides) {
    const wt = join(repo, '.worktrees', `${SIDE[s]}-${task}`);
    const branch = `${SIDE[s]}/${task}`;
    if (!existsSync(wt)) {
      commitTeam(c, `docs(fix): diagnosis and audit for ${task}`);
      git(repo, 'worktree', 'add', slash(wt), '-b', branch, `feature/${task}`);
      const sy = node('sync-worktree.mjs', [slash(wt)], { cwd: repo });
      if (/synced [1-9]/.test(sy.stdout)) { git(wt, 'add', '-A'); git(wt, 'commit', '-q', '-m', 'chore(muffy): sync skill scripts'); }
    } else if (round > 1 && gitOk(wt, 'rev-parse', '--verify', `feature/${task}`)) {
      gitOk(wt, 'merge', '--no-edit', `feature/${task}`);
    }
    const files = (owner === 'both' ? diag4a.diagnosis?.owner_files?.[s] : null) ?? diag4a.diagnosis?.files ?? [];
    const role = DEV[s];
    spawnAction(c, spec(role, '4', round, {
      goal: `Fix the cause named in fix.md and make every AC pass, with a unit test for each AC (an existing red test counts). No regression suite.`,
      doneWhen: 'the hand-off validates, lists every AC id in ac_ids_done, and ac-tests-' + SIDE[s] + '.md maps each AC to its test',
      read, write: [...files, ...testDirs.map((d) => `${d}/`), `ac-tests-${SIDE[s]}.md`, `${slash(c.team)}/handoff/4-${role}-r${round}.json`], dontTouch: ['anything the cause does not need', 'package manifests', 'lockfiles'],
      worktree: wt, branch,
    }));
  }
  return flush(0);
}

// every dev hand-off of this round is in: merge, export the diff, spawn the reviewer
function afterDev(c, hs, diag4a, spec, { fixRel, ho, task, W, base }) {
  const owner = diag4a.diagnosis?.owner ?? 'BE';
  const round = lastOf(hs, '4').handoff.round;
  const need = sideOf(owner).map((s) => DEV[s]);
  const have = hs.filter((x) => x.handoff && String(x.handoff.step) === '4' && x.handoff.round === round).map((x) => x.handoff.role);
  const waiting = need.filter((r) => !have.includes(r));
  if (waiting.length) {
    out.push('action=wait'); say('for', waiting.join(','));
    say('then', `run next.mjs step ${task} again when ${waiting.join(' and ')} has returned`);
    return flush(0);
  }
  commitTeam(c, `chore(muffy): log round ${round} for ${task}`);
  for (const s of sideOf(owner)) {
    const branch = `${SIDE[s]}/${task}`;
    const wt = join(c.main, '.worktrees', `${SIDE[s]}-${task}`);
    const dirty = existsSync(wt) ? git(wt, 'status', '--short') : '';
    if (dirty) { out.push('action=stop'); say('reason', `${slash(wt)} has uncommitted files: the dev must commit its work`); say('files', dirty.split('\n').join(' ; ')); return flush(1); }
    const merged = gitOk(c.feature, 'merge', '--no-ff', branch, '-m', `merge: ${branch} into feature/${task}${trailerOf(c) ? `\n\n${trailerOf(c)}` : ''}`);
    if (!merged) { gitOk(c.feature, 'merge', '--abort'); out.push('action=stop'); say('reason', `merging ${branch} into feature/${task} conflicts`); say('then', 'resolve it as a person would, or tell the user'); return flush(1); }
  }
  const patch = join(c.team, `diff-${round}.patch`);
  writeFileSync(patch, execFileSync('git', ['-C', c.feature, 'diff', base, '--', '.', ':!.team'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  commitTeam(c, `chore(muffy): diff for review ${round} of ${task}`);
  return fixReviewer(c, hs, spec, { fixRel, ho, task, round });
}

// the code-reviewer of the fix lane; `retry`: a reviewer message with no valid hand-off line starts a fresh reviewer at the next round
function fixReviewer(c, hs, spec, { fixRel, ho, task, round, retry }) {
  const T = slash(c.team);
  const dev = Math.max(0, ...hs.filter((x) => String(x.handoff?.step) === '4').map((x) => x.handoff.round));
  if (!existsSync(join(c.team, `diff-${round}.patch`))) {
    writeFileSync(join(c.team, `diff-${round}.patch`), execFileSync('git', ['-C', c.feature, 'diff', statusLine(c, 'base') ?? 'main', '--', '.', ':!.team'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    commitTeam(c, `chore(muffy): diff for review ${round} of ${task}`);
  }
  spawnAction(c, spec('code-reviewer', '6', round, {
    goal: 'Review the fix diff against fix.md (Cause, Repro, AC) for correctness, quality and security.',
    doneWhen: 'a verdict line, then the one-line JSON hand-off with verdict Approve or Reject',
    read: [fixRel, `${T}/diff-${round}.patch`, ho(lastOf(hs, '4a').name), ...(lastOf(hs, '4b') ? [ho(lastOf(hs, '4b').name)] : []), ...hs.filter((x) => x.handoff && String(x.handoff.step) === '4' && x.handoff.round === dev).map((x) => ho(x.name)), ...(retry ? [retry] : [])],
    write: [`${T}/review-${round}.md`], dontTouch: ['everything: read-only'], worktree: c.feature, branch: `feature/${task}`,
  }));
  say('then', `when it returns, pipe its whole final message to: node next.mjs review ${task}`);
  return flush(0);
}

/* ---------- bookkeeping for a hand-off that came back ---------- */

// A summary is free text from an agent. In checkpoint.md a `[word]` is a link label that needs a definition (check-checkpoint.mjs), so
// brackets from code such as `items[items.length]` become parentheses; one line, at most 120 characters.
const oneLine = (s) => String(s).replace(/\s+/g, ' ').replace(/\[/g, '(').replace(/\]/g, ')').trim().slice(0, 120);

// checkpoint.md stays within 40 lines outside ## Goal (check-checkpoint.mjs). Every hand-off adds a History line and a link definition,
// so a run of ten or more hand-offs overflows it and every later `checkpoint.mjs gate` or `ask` would fail. The two oldest History lines
// become one line that points at rounds/ (memory-model.md: "summarize on a schedule"), their link definitions go with them.
// `spare`: lines to leave free, for the History line and link a coming `checkpoint.mjs round` adds
export function compactCheckpoint(c, spare = 0) {
  const f = join(c.team, 'checkpoint.md');
  const outside = () => { const t = read(f).replace(/\n+$/, ''); return t.split('\n').length - (t.match(/^## Goal[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/m)?.[0].replace(/\n+$/, '').split('\n').length ?? 0); };
  for (let guard = 0; guard < 40; guard++) {
    if (outside() + spare <= 40 && !checkTask(c.team).some((e) => /lines outside/.test(e))) return;
    const t = read(f);
    const h = t.match(/^## History\n([\s\S]*?)(?=^## |^\[[A-Za-z0-9.-]+\]:|(?![\s\S]))/m);
    const items = (h?.[1] ?? '').split('\n').filter((l) => l.startsWith('- ') && !/^- none$/i.test(l));
    if (items.length < 2) return;
    const labels = items.slice(0, 2).map((l) => l.match(/\[([A-Za-z0-9.-]+)\]\s*$/)?.[1]).filter(Boolean);
    const merged = `- earlier rounds, one line each in rounds/: ${items.slice(0, 2).map((l) => l.replace(/^- /, '').replace(/:.*$/, '')).join(' and ')}`;
    let next = t.replace(items[0], merged).replace(`${items[1]}\n`, '');
    for (const l of labels) next = next.replace(new RegExp(`^\\[${l}\\]:.*\\n?`, 'm'), '');
    writeFileSync(f, next);
  }
}

function consumeHandoff(c, x) {
  if (!x.handoff) return;
  const h = x.handoff;
  const key = `consumed:${x.name}`;
  if (issued(c, key)) return;
  // an invalid hand-off (no step or round) is the retry rules' business, not the spawn log's
  if (!h.step || !h.round || !h.role) return;
  compactCheckpoint(c, 3);
  const was = issuedWith(c, `${h.step}:${h.role}:r${h.round}`);
  const model = was?.[2] ?? 'sonnet';
  const effort = was?.[3] ?? 'medium';
  const results = [
    node('checkpoint.mjs', ['spawn', slash(c.team), '--step', String(h.step), '--role', h.role, '--model', model, '--effort', effort, '--round', String(h.round), '--handoff', x.file]),
    // round files are written once per step and round: the second of two agents that ran side by side (designer and architect, FE and BE) has its line in the spawn log only
    issued(c, `rounded:${h.step}:r${h.round}`) ? { status: 0, stdout: '', stderr: '' } : node('checkpoint.mjs', ['round', slash(c.team), '--step', String(h.step), '--round', String(h.round), '--handoff', x.file, '--summary', oneLine(h.summary ?? `${h.role} ${h.status}`)]),
  ];
  log(c, `rounded:${h.step}:r${h.round}`);
  // a bookkeeping script that failed is reported, never ignored: the next gate reads what it should have written
  for (const r of results.filter((r) => r.status !== 0)) say('warning', `${x.name}: ${lines(r.stdout + r.stderr).join(' / ').slice(0, 300)}`);
  compactCheckpoint(c);
  log(c, key);
  commitTeam(c, `chore(muffy): ${h.role} ${h.step} r${h.round} back`);
}

/* ---------- the user's questions ---------- */

function askUser(c, gate, question, options = [{ label: 'Give more information', description: 'The answer goes in evidence-r<n>.md for one more round' }, { label: 'Cancel', description: 'Close the task as aborted' }]) {
  const gateJson = { questions: [{ question, header: gate.slice(0, 12), multiSelect: false, options }] };
  writeFileSync(join(c.team, 'gate.json'), JSON.stringify(gateJson, null, 2));
  if (headlessOf(process.env).headless) {
    const a = node('checkpoint.mjs', ['ask', slash(c.team), gate], { cwd: c.main });
    return stopFromAsk(a.stdout, a.stderr);
  }
  rmSync(join(c.team, 'gate.json'), { force: true });
  out.push('action=ask'); say('gate', gate);
  out.push('---questions---', JSON.stringify(gateJson), '---questions---');
  say('then', `node next.mjs answer ${basename(c.team)} "<the label the user picked>"`);
  return flush(0);
}

function askAuditReject(c, x) {
  const a = x.handoff.audit;
  const text = `The auditor did not confirm the cause (${a.verdict}; evidence ${a.evidence_level}; missing: ${(a.missing ?? []).join('; ') || 'not stated'}). What now?`;
  const options = [
    { label: 'More information', description: 'The user gives evidence; one more debugger round, then the auditor' },
    { label: 'Accept the risk', description: 'Go to the fix without an audited cause; recorded in fix.md' },
    { label: 'Cancel', description: 'Close the task as aborted' },
  ];
  if (headlessOf(process.env).headless) {
    const gateJson = { questions: [{ question: text, header: 'audit', multiSelect: false, options }] };
    writeFileSync(join(c.team, 'gate.json'), JSON.stringify(gateJson, null, 2));
    const r = node('checkpoint.mjs', ['ask', slash(c.team), 'audit', '--verdict', a.verdict === 'reject' ? 'reject' : 'need-validation'], { cwd: c.main });
    return stopFromAsk(r.stdout, r.stderr);
  }
  out.push('action=ask'); say('gate', 'audit');
  out.push('---questions---', JSON.stringify({ questions: [{ question: text, header: 'audit', multiSelect: false, options }] }), '---questions---');
  say('then', `node next.mjs answer ${basename(c.team)} "<the label the user picked>"`);
  return flush(0);
}

/* ---------- review → test gate → Human gate ---------- */

export function review(o, message) {
  const task = o._[0];
  const c = locate(o.repo ?? '.', task);
  const text = String(message ?? '').replace(/\r\n/g, '\n');
  const jsonLine = lines(text).filter((l) => l.trim().startsWith('{') && l.includes('"role"')).at(-1);
  const rounds = handoffsOf(c).filter((x) => x.handoff && String(x.handoff.step) === '6').length;
  const round = rounds + 1;
  // a message with no valid hand-off line is saved as an invalid hand-off: the loop rules then retry the reviewer once with a fresh
  // spawn a round later (the lanes are silent: no SendMessage), and escalate the second time
  let h = {};
  if (jsonLine) { try { h = JSON.parse(jsonLine); } catch { h = {}; } }
  if (h.verdict) h.verdict = String(h.verdict).replace(/^./, (x) => x.toUpperCase()).toLowerCase().replace(/^./, (x) => x.toUpperCase());
  h.role = 'code-reviewer'; h.step = '6'; h.round = round;
  writeFileSync(join(c.team, `review-${round}.md`), `${text.trim()}\n`);
  writeFileSync(join(c.handoffs, `6-code-reviewer-r${round}.json`), JSON.stringify(h));
  return step({ ...o, _: [task] });
}

function afterReview(c, h, { task, base, W }) {
  if (h.verdict !== 'Approve') throw new Error(`afterReview called for a ${h.verdict} verdict`);
  const tg = node('test-gate.mjs', [slash(c.team), '--cwd', slash(c.feature)], { cwd: c.main });
  const sum = node('gate-summary.mjs', [slash(c.team), '10'], { cwd: c.main });
  commitTeam(c, `docs(fix): review and test gate for ${task}`);
  const gateText = sum.stdout.trim();
  const headless = headlessOf(process.env).headless;
  const facts = `The test gate ${tg.status === 0 ? 'passed' : tg.status === 3 ? 'was skipped (no test command)' : 'reported failing tests: only those that already fail on the base branch are out of scope'}.`;
  if (headless) {
    const a = node('checkpoint.mjs', ['ask', slash(c.team), 'human-gate'], { cwd: c.main });
    if (!/next=continue/.test(a.stdout)) return stopFromAsk(a.stdout, a.stderr);
    return closeTask(c, { task, base, W, gateText, facts });
  }
  out.push('action=ask'); say('gate', 'human-gate');
  const q = { questions: [{ question: `${gateText}\n\n${facts}\nAccept this branch? (Approve means accept, not deploy.)`, header: 'Human gate', multiSelect: false, options: [{ label: 'Approve', description: 'Accept feature/' + task }, { label: 'Reject', description: 'Send it back with the reason' }] }] };
  out.push('---questions---', JSON.stringify(q), '---questions---');
  say('then', `node next.mjs answer ${task} "<the label the user picked>"`);
  node('checkpoint.mjs', ['pause', slash(c.team), 'human-gate', '--until', 'the user answers the Human gate']);
  return flush(0);
}

export function answer(o) {
  const task = o._[0];
  const label = String(o._[1] ?? '').trim();
  const c = locate(o.repo ?? '.', task);
  if (parseRunProfile(read(join(c.team, 'checkpoint.md'))).lane !== 'fix') return flowAnswer(o);
  const cp = read(join(c.team, 'checkpoint.md'));
  const gate = cp.match(/paused at pause:([a-z-]+)/)?.[1];
  const base = statusLine(c, 'base') ?? 'main';
  node('checkpoint.mjs', ['unpause', slash(c.team)]);
  if (gate === 'human-gate' || (!gate && /^approve/i.test(label))) {
    if (!/^approve/i.test(label)) { out.push('action=stop'); say('reason', `the user did not approve: ${label}`); say('then', 'ask what to change; a fix round reuses the role worktrees (resume.md)'); return flush(1); }
    return closeTask(c, { task, base, W: c.feature });
  }
  const hs = handoffsOf(c);
  if (/^more/i.test(label)) { out.push('action=ask'); say('gate', 'evidence'); say('then', `write the user's information to ${slash(c.team)}/evidence-r1.md, then node next.mjs step ${task}`); return flush(0); }
  if (/^accept/i.test(label)) {
    appendFileSync(join(c.team, 'fix.md'), '\n## Audit\ncause not audited, risk accepted by the user\n');
    const s = read(join(c.team, 'checkpoint.md'));
    writeFileSync(join(c.team, 'checkpoint.md'), s.replace(/^(## Status\n)/m, '$1audit 4b: risk accepted\n'));
    commitTeam(c, `docs(fix): risk accepted for ${task}`);
    return devSpawn(c, hs, lastOf(hs, '4a').handoff, (role, stepId, round, more) => ({ role, step: stepId, round, task, ...more }), { fixRel: `${slash(c.team)}/fix.md`, ho: (n) => `${slash(c.team)}/handoff/${n}`, task, W: c.feature, round: 1 });
  }
  out.push('action=stop'); say('outcome', 'cancelled'); say('then', 'close the task as aborted (closing.md)');
  return flush(1);
}

/* ---------- closing ---------- */

// the newest diff the reviewer saw: after a reviewer Reject the final diff is `diff-<latest round>`, never `diff-1`
export function latestDiff(c) {
  const rounds = existsSync(c.team) ? readdirSync(c.team).map((f) => f.match(/^diff-(\d+)\.patch$/)?.[1]).filter(Boolean).map(Number) : [];
  return `${slash(c.team)}/diff-${rounds.length ? Math.max(...rounds) : 1}.patch`;
}

// `lane`: what the closing note says about the work (the fix lane names the cause); `branch`: the branch the user takes (verify: the copy)
export function closeTask(c, { task, base, W, gateText, facts, docs, branch = `feature/${task}`, lane = 'fix' }) {
  node('remove-worktrees.mjs', [task, '--stage', 'roles', '--cwd', slash(c.main)], { cwd: c.main });
  if (!docs) {
    const sf = node('small-fix.mjs', [slash(c.team), '--base', base], { cwd: c.main });
    if (/next=spawn-docs-writer/.test(sf.stdout)) {
      const T = slash(c.team);
      spawnAction(c, { role: 'docs-writer', step: '11', round: 1, task, goal: 'Write the release notes and any doc the fix made wrong, with a Deploy hand-off.', doneWhen: 'release-notes.md exists and the hand-off validates',
        read: [`${T}/fix.md`, latestDiff(c), `${T}/qa-report.md`], write: [`${T}/release-notes.md`], dontTouch: ['source files', 'tests'], worktree: c.feature, branch }, ['--human-approved', new Date().toISOString().slice(0, 10)]);
      say('note', sf.stdout.trim().split('\n').join(' ; '));
      return flush(0);
    }
  }
  const usage = node('task-usage.mjs', [slash(c.team), '--cwd', slash(c.main)], { cwd: c.main }).stdout.trim();
  const sp = read(join(c.team, 'spawns.tsv')).trim().split('\n').filter(Boolean);
  const date = new Date().toISOString().slice(0, 10);
  const notes = read(join(c.team, 'release-notes.md'));
  const commit = git(c.feature, 'rev-parse', '--short', 'HEAD');
  const fix = read(join(c.team, 'fix.md'));
  const cause = lane === 'fix' ? fix.match(/## Cause\n([\s\S]*?)\n## /)?.[1].trim() ?? '' : '';
  const notePath = join(c.brain, 'tasks', `${task}.md`);
  writeFileSync(notePath, `---\nproject: ${basename(c.main)}\ntask: ${task}\ndate: ${date}\nstatus: done\n---\n# ${task}\n\nBranch ${branch} at ${commit}, accepted at the Human gate.${cause ? ` Cause: ${cause}` : ''}\n\n## Lessons\n- none recorded: fewer than 3 spawns of any one agent and model\n\n## Open issues\n- none\n\n## Usage\n${usage}\n\n## Spawns\n${sp.map((l) => `- ${l.split('\t').join(' · ')}`).join('\n')}\n`);
  const proj = join(c.brain, 'project.md');
  writeFileSync(proj, read(proj).replace(new RegExp(`^- ${task}:.*$`, 'm'), `- ${task}: done · ${lane} on ${branch} [[tasks/${task}]]`));
  const cpPath = join(c.team, 'checkpoint.md');
  writeFileSync(cpPath, read(cpPath).replace(/^(## Status\n)[\s\S]*?(?=\n## )/m, `$1closed\n`).replace(/^Updated:.*$/m, 'Updated: step 12 · closed'));
  commitTeam(c, `docs(fix): close ${task}`);
  const rm = node('remove-worktrees.mjs', [task, '--stage', 'all', '--cwd', slash(c.main)], { cwd: c.main });
  const chk = node('remove-worktrees.mjs', [task, '--stage', 'all', '--check', '--cwd', slash(c.main)], { cwd: c.main });
  out.push('action=done');
  say('task', task); say('branch', branch); say('commit', commit); say('base', base);
  for (const l of lines(usage)) say('usage', l);
  for (const l of [...lines(rm.stdout), ...lines(chk.stdout)].filter((x) => /kept=|unmerged:|remaining=/.test(x))) say('worktrees', l);
  if (gateText) say('gate-summary', gateText.split('\n').join(' ; '));
  if (facts) say('tests', facts);
  if (notes) say('deploy-handoff', 'in release-notes.md on the branch');
  say('then', 'final message: status, branch and commit, the cause and the fix, test result, the Deploy hand-off (the user deploys), the usage lines, any worktree kept and why; end with `muffy-status: done` when headless');
  return flush(0);
}

/* ---------- CLI ---------- */

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    const o = parseArgs(rest);
    if (cmd === 'start') process.exit(start(o));
    if (cmd === 'step') process.exit(step(o));
    if (cmd === 'review') process.exit(review(o, readFileSync(0, 'utf8')));
    if (cmd === 'answer') process.exit(answer(o));
    if (cmd === 'record') process.exit(flowRecord(o));
    console.error('usage: next.mjs start|step|review|answer|record ... (see the header of this file)');
    process.exit(2);
  } catch (e) {
    console.error(`next: ${e.message}`);
    process.exit(2);
  }
}

// what the other lanes' engine (next-flow.mjs) shares with the fix lane
export { out, say, flush, spawnAction, commitTeam, stopFromAsk, consumeHandoff, issuedWith, issued, log, read, git, gitOk, node, lines, slash, trailerOf, statusLine, DEV, SIDE, oneLine };

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
