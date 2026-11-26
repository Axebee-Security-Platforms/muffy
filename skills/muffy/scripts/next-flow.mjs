// The change, verify, upgrade and full-flow lanes for next.mjs: the same one-step-at-a-time contract as the fix lane, over the
// lane table in lanes.mjs. This file decides what comes next from the task's files (hand-offs, checkpoint, git); it never copies a
// rule, it calls next-action.mjs (loop rules), gate-rules.mjs (gate state), checkpoint.mjs (gates, pauses, spawn log), gate-summary.mjs,
// test-gate.mjs, check-ownership.mjs and the other scripts. A step that needs the model or an outside tool (publishing a canvas, the UX
// review, an interview of the user) is an `action=do` with a check the script makes itself: it never marks one done on its own.
// Helpers shared with the fix lane live in next.mjs (imported as a namespace: the two files import each other and only call at run time).
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validate } from './schema.mjs';
import { simulate, triageChange, baselineAction, LOOP_LIMIT, GATED_STEPS } from './next-action.mjs';
import { planCard, parseRunProfile, formatRunProfile, laneSpec } from './lanes.mjs';
import { headlessOf } from './headless.mjs';
import { gateState } from './gate-rules.mjs';
import { parseOwnership } from './ownership.mjs';
import * as N from './next.mjs';

const SCHEMAS = new URL('../schemas/', import.meta.url);
const handoffSchema = JSON.parse(readFileSync(new URL('handoff.schema.json', SCHEMAS), 'utf8'));

const say = (k, v) => N.say(k, v);
const push = (...l) => N.out.push(...l);
const flush = (code = 0) => N.flush(code);
const slash = (p) => N.slash(p);
const read = (p, d = '') => N.read(p, d);
const lines = (s) => N.lines(s);
const node = (script, args, o) => N.node(script, args, o);
const git = (cwd, ...a) => N.git(cwd, ...a);
const gitOk = (cwd, ...a) => N.gitOk(cwd, ...a);

const LANES = ['change', 'verify', 'upgrade', 'feature'];
// a lane is switched on when its offline scenarios pass (scripts/lib/next-flow-evals.mjs); the others keep the reference-driven flow
const ENABLED = ['verify', 'change', 'upgrade', 'feature'];
const VISIBLE = ['ui-only', 'ui+logic', 'logic-only'];
const PIPELINE = ['1', '2', '2b', '3', '3b', '3e', '3c', '4', '5', '6', '7', '10', '11'];
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- start: the setup every lane does before its first agent ---------- */

const acTable = (acs) => `| id | result | check |\n|---|---|---|\n${acs.map((a) => `| ${a.split('|').map((x) => x.trim()).join(' | ')} |`).join('\n')}`;

// ac.md, written by the script for the lanes that have no product-manager (change internal, verify, upgrade)
const acMd = (o, scope) => `# AC: ${o.task}
${o.lane === 'change' ? `Scope: ${scope}    Kind: ${o.kind}    Owner: ${o.owner}` : `Lane: ${o.lane}`}
## Goal
${o.request}
## AC
${acTable(o.ac ?? [])}
${o.lane === 'verify' ? `## Unchanged\n${o.unchanged || 'Everything the request does not name.'}\n` : ''}${o.lane === 'upgrade' ? '## Traceability\n| brief item | AC |\n|---|---|\n| the package builds and boots on the new version | AC-1 |\n' : ''}## Out of scope
${o['out-of-scope'] || 'Anything the request does not name.'}
`;

const ownerOf = (o, scope) => (o.lane === 'change' && scope === 'ui-only' ? 'FE' : o.lane === 'change' && scope === 'logic-only' ? 'BE' : o.lane === 'change' && scope === 'ui+logic' ? 'both' : o.owner ?? (o.lane === 'feature' ? 'both' : 'BE'));

const checkpointMd = ({ task, request, base, baseline, owner, lane, extra }) => `# Checkpoint: ${task}
Updated: step setup · round 0

## Goal
${request}

## Run profile
${lane}

## Status
base: ${base}
route: ${extra.route}
${baseline ? `baseline: ${baseline}\n` : ''}owner: ${owner}
${extra.lines.join('\n')}${extra.lines.length ? '\n' : ''}next: setup done · Orchestrator · run next.mjs step

## Decisions in force
none

## Loop counters
none

## Open blockers
none

## History
none
`;

function scopeQuestions(o, scope, plan) {
  const q = [{ question: `${plan.join('\n')}\n\nเริ่มตามแผนนี้ไหม? / Go with this plan?`, header: 'Plan', multiSelect: false, options: [
    { label: 'go (recommended)', description: `Run the ${o.lane} lane as shown` },
    { label: 'bigger or smaller', description: 'Move to another route; nothing is spawned' },
  ] }];
  if (o.ac?.length) q.push({ question: `Acceptance criteria:\n${o.ac.map((a) => `- ${a}`).join('\n')}\nOut of scope: ${o['out-of-scope'] || 'anything the request does not name'}`, header: 'AC', multiSelect: false, options: [{ label: 'Confirm', description: 'Use these AC' }, { label: 'Change it', description: 'The user edits the AC first' }] });
  if (o.lane === 'verify') q.push({ question: `Branch ${o.branch}, base ${o.base ?? 'the current branch'}. The branch is never edited or merged: the run works on a copy, verify/${o.task}.`, header: 'Branch', multiSelect: false, options: [{ label: 'Confirm', description: 'Verify this branch against this base' }, { label: 'Change it', description: 'Name another branch or base' }] });
  if (o.lane === 'upgrade') q.push({ question: `Target: ${o.target}`, header: 'Target', multiSelect: false, options: [{ label: 'Confirm', description: 'Upgrade as named' }, { label: 'Change it', description: 'Name another version' }] });
  if (o.lane === 'change' && VISIBLE.includes(scope)) q.push({ question: `Scope: ${scope}. ui-only = screens and UX, no backend; ui+logic = screens and the rules behind them; logic-only = backend rules, no screen.`, header: 'Scope', multiSelect: false, options: [{ label: scope, description: 'Keep this scope' }, ...VISIBLE.filter((s) => s !== scope).map((s) => ({ label: s, description: `Use ${s}` }))] });
  return q;
}

export function flowStart(o) {
  const lane = o.lane;
  if (!LANES.includes(lane)) throw new Error(`--lane is one of fix, ${LANES.join(', ')}`);
  if (!ENABLED.includes(lane)) throw new Error(`the ${lane} lane is not driven by next.mjs yet: follow its reference (${laneSpec(lane, lane === 'change' ? 'internal' : undefined)?.ref ?? 'run-profile.md'})`);
  const need = ['task', 'request', ...(lane === 'verify' ? ['branch'] : []), ...(lane === 'upgrade' ? ['target'] : []), ...(lane === 'change' ? ['scope'] : [])].filter((k) => !o[k]);
  const internal = lane === 'change' && o.scope === 'internal';
  if (internal) for (const k of ['kind', 'owner']) if (!o[k]) need.push(k);
  if (lane === 'upgrade') o.ac = o.ac?.length ? o.ac : ['AC-1 | the app builds and boots on the new version | the project build and boot', 'AC-2 | the existing tests pass | the test gate'];
  if ((internal || lane === 'verify') && !o.ac?.length) need.push('ac');
  if (need.length) throw new Error(`start --lane ${lane} needs ${need.map((k) => `--${k}`).join(', ')}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.task)) throw new Error(`--task ${o.task}: lower-case words joined by hyphens`);
  if (lane === 'change' && ![...VISIBLE, 'internal'].includes(o.scope)) throw new Error('--scope is internal, ui-only, ui+logic or logic-only');
  if (o.owner && !['FE', 'BE', 'both'].includes(o.owner)) throw new Error('--owner is FE, BE or both');
  const scope = lane === 'change' ? o.scope : null;
  const c = N.locate(o.repo ?? '.', o.task);
  const headless = headlessOf(process.env).headless;

  if (existsSync(join(c.team, 'checkpoint.md'))) { say('note', 'the task already started: continuing'); return flowStep({ ...o, _: [o.task] }); }

  if (internal && o.signals) {
    const t = triageChange(JSON.parse(o.signals));
    if (t.lane !== 'change') { push('action=route'); say('lane', t.lane); t.reasons.forEach((r) => say('reason', r)); say('written', 'nothing'); return flush(1); }
  }

  const repoDir = c.main;
  const need2 = laneSpec(lane, scope)?.baseline ?? 'full';
  let facts = {};
  try { facts = JSON.parse(node('check-baseline.mjs', [repoDir, '--json'], { cwd: repoDir }).stdout); } catch { facts = { baseline: 'missing' }; }
  const hasCode = !node('scan-repo.mjs', [repoDir], { cwd: repoDir }).stdout.includes('"hasCode": false');
  const act = baselineAction({ colour: facts.baseline, depth: facts.depth, hasCode, lane, scope, headless });
  if (act.next !== 'continue') {
    push('action=onboard'); say('depth', act.next.replace(/^(ask:)?onboard-/, '').replace(/^refresh:silent$/, 'refresh').replace(/^ask:red$/, 'refresh')); say('needs', need2); say('reason', act.reason);
    say('then', 'run onboard.md at that depth (or refresh the baseline from the delta), commit it, then run this start command again');
    return flush(0);
  }

  const current = git(repoDir, 'rev-parse', '--abbrev-ref', 'HEAD');
  const base = o.base ?? (lane === 'verify' ? current : current);
  const card = planCard(lane, { scope: scope ?? undefined, lang: o.lang ?? 'th' });
  const questions = scopeQuestions(o, scope, card);

  if (!headless && !o.approved) {
    push('action=ask'); say('gate', 'scope'); say('written', 'nothing');
    push('---questions---', JSON.stringify({ questions }), '---questions---');
    say('then', `run the same start command again with --approved${o.base ? '' : ` (the base is ${base})`}; any other answer: start nothing and re-route or re-draft`);
    return flush(0);
  }
  if (o['dry-run']) { say('dry-run', `would create brain, task note, the ${lane} worktree, request.md${o.ac?.length ? ', ac.md' : ''}, checkpoint.md and commit them`); return flush(0); }

  // the files
  mkdirSync(join(c.brain, 'tasks'), { recursive: true });
  mkdirSync(join(c.brain, 'agents'), { recursive: true });
  const project = join(c.brain, 'project.md');
  if (!existsSync(project)) writeFileSync(project, '# Project\n\n## Tasks\n\n## Lessons\n\n## Open issues\n');
  writeFileSync(join(c.brain, 'tasks', `${o.task}.md`), `---\nproject: ${basename(c.main)}\ntask: ${o.task}\ndate: ${today()}\nstatus: in progress\n---\n# ${o.task}\n\n${o.request}\n`);
  const proj = read(project);
  if (!proj.includes(`${o.task}:`)) writeFileSync(project, proj.replace(/(## Tasks\n)/, `$1- ${o.task}: in progress\n`));
  node('init-config.mjs', ['.'], { cwd: repoDir });

  const branch = lane === 'verify' ? `verify/${o.task}` : `feature/${o.task}`;
  if (!existsSync(c.feature)) git(repoDir, 'worktree', 'add', slash(c.feature), '-b', branch, lane === 'verify' ? o.branch : base);
  mkdirSync(c.handoffs, { recursive: true });
  mkdirSync(join(c.team, 'rounds'), { recursive: true });
  writeFileSync(join(c.team, 'request.md'), `# Request: ${o.task}\n${o.request}\n`);
  if (o.ac?.length) writeFileSync(join(c.team, 'ac.md'), acMd(o, scope));
  const owner = ownerOf(o, scope);
  const profile = formatRunProfile(lane, { scope: scope ?? undefined, skip: String(o.skip ?? '').split(',').filter(Boolean) });
  writeFileSync(join(c.team, 'checkpoint.md'), checkpointMd({ task: o.task, request: o.request, base, baseline: facts.baseline && facts.baseline !== 'missing' ? `${facts.baseline}${facts.depth ? ` (${facts.depth})` : ''}` : '', owner, lane: profile,
    extra: { route: `${lane}${scope ? ` (${scope})` : ''} · intake: 0 asked`, lines: [...(lane === 'verify' ? [`their-branch: ${o.branch}`] : []), ...(lane === 'upgrade' ? [`target: ${o.target}`] : []), ...(o.announcement ? ['announcement: yes'] : [])] } }));
  if (o.trailer) writeFileSync(join(c.team, 'trailer.txt'), `${o.trailer}\n`);
  const p = node('checkpoint.mjs', ['profile', slash(c.team), lane, ...(scope ? ['--scope', scope] : []), ...(o.skip ? ['--skip', o.skip] : [])]);
  if (p.status !== 0) throw new Error(`checkpoint profile failed: ${p.stdout}${p.stderr}`);
  const skip2b = (lane === 'change' && scope === 'ui-only') ? 'combined with the design gate' : lane === 'upgrade' ? 'no plan in an upgrade; the ADR is approved at 3c' : null;
  if (skip2b) { const g = node('checkpoint.mjs', ['gate', slash(c.team), '2b', 'skip', '--reason', skip2b]); if (g.status !== 0) throw new Error(`gate 2b skip failed: ${g.stdout}${g.stderr}`); }
  N.commitTeam(c, `docs(${lane}): setup for ${o.task}`);

  if (headless) {
    writeFileSync(join(c.team, 'gate.json'), JSON.stringify({ questions }, null, 2));
    writeMeta(c, { gate: 'scope' });
    const a = node('checkpoint.mjs', ['ask', slash(c.team), 'scope', ...(o.signals ? ['--triage-passed'] : [])], { cwd: c.main });
    N.commitTeam(c, `docs(${lane}): scope question for ${o.task}`);
    if (!/next=continue/.test(a.stdout)) return N.stopFromAsk(a.stdout, a.stderr);
  }
  return flowStep({ ...o, _: [o.task] });
}

/* ---------- small state helpers ---------- */

const metaFile = (c) => join(c.team, 'ask-meta.json');
const writeMeta = (c, m) => writeFileSync(metaFile(c), JSON.stringify(m));
const readMeta = (c) => { try { return JSON.parse(read(metaFile(c))); } catch { return null; } };

// `key: value` in ## Status, replacing the line when there is one
function setStatus(c, key, value) {
  const f = join(c.team, 'checkpoint.md');
  let t = read(f);
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key}:.*$`, 'm');
  t = re.test(t) ? t.replace(re, line) : t.replace(/^(## Status\n)/m, `$1${line}\n`);
  writeFileSync(f, t);
}

const roundOfName = (n) => Number(n.match(/-r(\d+)\.json$/)?.[1] ?? 0);
const stepOfName = (n) => n.match(/^([0-9a-z]+)-/)?.[1] ?? '';
const roleOfName = (n) => n.replace(/^[0-9a-z]+-/, '').replace(/-r\d+\.json$/, '');

function ctxOf(o) {
  const task = o._[0];
  if (!task) throw new Error('give the task name');
  const c = N.locate(o.repo ?? '.', task);
  if (!existsSync(join(c.team, 'checkpoint.md'))) throw new Error(`no task ${task} at ${c.team}: run start first`);
  const cp = read(join(c.team, 'checkpoint.md'));
  const lane = parseRunProfile(cp);
  const line = cp.match(/^[-*\s]*lane:.*$/m)?.[0] ?? '';
  const tokens = new Set((line.match(/skipped\s+([^·]*)/)?.[1] ?? '').split(/[,\s]+/).filter(Boolean));
  const hs = N.handoffsOf(c);
  const T = slash(c.team);
  const feature = lane.lane === 'verify' ? `verify/${task}` : `feature/${task}`;
  return { o, task, c, cp, lane, tokens, hs, T, W: c.feature, branch: feature, base: N.statusLine(c, 'base') ?? 'main', owner: N.statusLine(c, 'owner') ?? 'BE', headless: headlessOf(process.env).headless, skipped: new Set(lane.skipped) };
}

const doneH = (x, step, role) => x.hs.filter((h) => h.handoff && String(h.handoff.step) === step && (!role || h.handoff.role === role));
const latestOf = (x, step, role) => doneH(x, step, role).at(-1);
const maxRound = (x, step) => Math.max(0, ...x.hs.filter((h) => stepOfName(h.name) === step).map((h) => roundOfName(h.name)));

function devRoles(x) {
  const sides = x.owner === 'both' ? ['FE', 'BE'] : [x.owner];
  return sides.filter((s) => !x.tokens.has(N.DEV[s])).map((s) => N.DEV[s]);
}

const rel = (x, p) => `${slash(x.W)}/${p}`;
const reqFile = (x) => (existsSync(join(x.c.team, 'requirements.md')) ? [`${x.T}/requirements.md`] : []);
const header = (x) => (x.lane.lane === 'change' ? ['--scope', x.lane.scope] : []);

// a spawn through make-envelope: the lane's header, the clarification answers in Read: for every role, the code roles' worktree
function spawn(x, spec, extra = []) {
  const s = { task: x.task, header: header(x), ...spec, read: [...spec.read, ...reqFile(x).filter((f) => !spec.read.includes(f))] };
  N.spawnAction(x.c, s, extra);
}

/* ---------- the loop rules, then the pipeline ---------- */

export function flowStep(o) {
  const x = ctxOf(o);
  if (/^closed\b/m.test(x.cp.split('## Status')[1] ?? '')) { push('action=done'); say('note', 'the task is already closed'); return flush(0); }
  if (x.lane.until) { push('action=stop'); say('reason', `the lane line has a stop point (until ${x.lane.until}): close it as closing.md says, or drop it with checkpoint.mjs profile`); return flush(1); }

  // 0. headless: a gate.json is waiting for the person's answer
  if (existsSync(join(x.c.team, 'gate.json')) && x.headless) {
    const a = node('checkpoint.mjs', ['answer', slash(x.c.team)], { cwd: x.c.main });
    if (/next=stop/.test(a.stdout)) return N.stopFromAsk(a.stdout, a.stderr);
    if (a.status === 2) return N.stopFromAsk(a.stdout, a.stderr);
    const handled = afterAnswer(x, (a.stdout.match(/^answer=(.*)$/m) ?? [])[1] ?? '', a.stdout);
    if (handled !== undefined) return handled;
    return flowStep(o);
  }

  x.hs.forEach((h) => N.consumeHandoff(x.c, h));

  // 1. a hand-off that says it cannot go on
  for (const h of x.hs) {
    if (h.handoff && ['blocked', 'not-ready'].includes(h.handoff.status) && !x.hs.some((g) => g.handoff && g.handoff.role === h.handoff.role && String(g.handoff.step) === String(h.handoff.step) && g.handoff.round > h.handoff.round)) {
      push('action=stop'); say('reason', `${h.handoff.role} ${h.handoff.step} r${h.handoff.round} is ${h.handoff.status}`);
      for (const b of h.handoff.blockers ?? []) say('blocker', `${b.id} · ${b.owner} · ${b.problem}`);
      say('then', 'read the blockers: a blocker owned by an agent this lane skips may promote it (change-profile.md, run-profile.md "Promotion ladder"); otherwise answer it with the owner and run step again');
      if (x.headless) say('muffy-status', 'blocked:handoff');
      return flush(1);
    }
  }

  // 2. an agent asked the user something (needs-input)
  const ask = x.hs.filter((h) => h.handoff?.status === 'needs-input').find((h) => !x.hs.some((g) => g.handoff && g.handoff.role === h.handoff.role && String(g.handoff.step) === String(h.handoff.step) && g.handoff.round > h.handoff.round));
  if (ask) return clarify(x, ask);

  // 3. the loop rules over every hand-off (retries, rejects, escalations), with the gates the checkpoint records
  const passed = GATED_STEPS.filter((g) => gateState(x.cp, g) === 'passed');
  const sim = simulate({ task: x.task, profile: x.lane.lane, scope: x.lane.scope ?? undefined, skip: x.lane.skipped, passed, events: x.hs.map((h) => ({ handoff: h.handoff, file: h.file })) });
  const act = sim.actions.at(-1) ?? 'none';
  if (['escalated', 'blocked', 'promoted', 'invalid-profile', 'cancelled'].includes(sim.outcome) || act.startsWith('promote:')) {
    push('action=stop'); say('outcome', sim.outcome); say('next', act); if (sim.trigger) say('trigger', sim.trigger);
    for (const v of sim.violations) say('violation', v);
    if (sim.escalation) { const f = join(x.c.team, 'escalation.json'); writeFileSync(f, JSON.stringify(sim.escalation, null, 2) + '\n'); say('escalation', slash(f)); say('then', 'add the recommendation and attempts to the escalation, validate it, and tell the user (loops.md)'); }
    if (x.headless) say('muffy-status', `blocked:${sim.trigger ?? sim.outcome}`);
    return flush(1);
  }
  const last = x.hs.at(-1);
  if (act.startsWith('retry:')) return retry(x, last, act);
  if (act === 'ask:verify-fix') return askVerifyFix(x, last);
  if (act.startsWith('fix:')) return devSpawn(x, { round: Math.max(maxRound(x, '4'), maxRound(x, '6')) + 1, only: act.slice(4).split('+').filter((s) => s in N.DEV), review: last });

  return pipeline(x);
}

function retry(x, last, act) {
  const h = last.handoff;
  const role = h?.role ?? roleOfName(last.name);
  const step = String(h?.step ?? stepOfName(last.name));
  const round = (h?.round ?? roundOfName(last.name)) + 1;
  const errs = h ? validate(handoffSchema, h) : ['the file is not valid JSON'];
  const file = `${x.T}/retry-${step}-${role}-r${round}.md`;
  writeFileSync(join(x.c.team, `retry-${step}-${role}-r${round}.md`), `# ${role} ${step}: the last hand-off was sent back (${act})\n\n${[...errs, ...(h?.quality_checks?.failed ?? [])].map((e) => `- ${e}`).join('\n') || '- quality_checks.passed was false'}\n`);
  if (step === '4') return devSpawn(x, { round, only: [Object.keys(N.DEV).find((s) => N.DEV[s] === role)], retry: file });
  if (step === '6') return reviewerSpawn(x, round, file);
  spawnStep(x, step, role, round, file);
  return flush(0);
}

/* ---------- the pipeline: the first step not yet done ---------- */

function pipeline(x) {
  const steps = PIPELINE.filter((s) => !x.skipped.has(s) || (verifyFixes(x) && (s === '4' || s === '5')));
  for (const s of steps) {
    const r = HANDLERS[s]?.(x);
    if (r !== undefined) return r;
  }
  return closeAll(x);
}

const lastOk = (x, step, role) => { const h = latestOf(x, step, role)?.handoff; return h && h.status === 'done' ? h : null; };

// one spawn for the step's role at the round after its last hand-off (clarification and retry rounds land here)
function spawnStep(x, step, role, round, retry) {
  const T = x.T;
  const specs = {
    researcher: { goal: 'Research the request: options and trade-offs, constraints, the must-not-miss items; write brief.md with the level reached.', doneWhen: 'brief.md exists and the hand-off validates', read: [`${T}/request.md`], write: [`${T}/brief.md`, `${T}/brief/`] },
    'product-manager': { goal: 'Turn the request into user stories, testable AC, a phased plan and the product ADR.', doneWhen: 'ac.md and the plan exist and the hand-off validates', read: [`${T}/request.md`, ...(existsSync(join(x.c.team, 'brief.md')) ? [`${T}/brief.md`] : [])], write: [`${T}/ac.md`, rel(x, `docs/plan/${x.task}.md`), rel(x, 'docs/adr/')] },
    designer: { goal: 'Design the screens for every AC from the design system: flow, states, component specs, as a canvas.', doneWhen: 'design.md and the canvas exist and the hand-off validates', read: [`${T}/ac.md`, `${T}/request.md`, ...(existsSync(join(x.c.team, 'brief.md')) ? [`${T}/brief.md`] : [])], write: [`${T}/design.md`, `${T}/canvas/`, rel(x, 'docs/design-system/'), rel(x, 'docs/design/')] },
    architect: { goal: x.lane.lane === 'upgrade' ? 'Write the upgrade ADR (what changes in the code, the order, the rollback) and the contract it implies.' : 'Write the contract and ownership table for the AC, and the technical ADR.', doneWhen: 'contract.md exists and the hand-off validates', read: [`${T}/ac.md`, `${T}/request.md`, ...(existsSync(join(x.c.team, 'brief.md')) ? [`${T}/brief.md`] : []), ...(existsSync(join(x.c.team, 'design.md')) ? [`${T}/design.md`] : [])], write: [`${T}/contract.md`, `${T}/contract/`, rel(x, 'docs/adr/')] },
    'docs-writer': { goal: 'Write the release notes and the docs the diff touched, with a Deploy hand-off.', doneWhen: 'release-notes.md exists and the hand-off validates', read: [`${T}/ac.md`, N.latestDiff(x.c), `${T}/qa-report.md`, ...(existsSync(join(x.c.team, 'contract.md')) ? [`${T}/contract.md`] : [])], write: [`${T}/release-notes.md`, rel(x, 'docs/')] },
    diagrammer: { goal: 'Draw every diagram in diagrams-spec.json as one self-contained HTML file.', doneWhen: 'each spec has its file and the hand-off validates', read: [`${T}/diagrams-spec.json`], write: [`${T}/diagrams/`] },
  };
  const sp = specs[role];
  if (!sp) throw new Error(`no spec for ${role} at step ${step}`);
  spawn(x, { role, step, round, ...sp, read: [...sp.read, ...(retry ? [retry] : [])], dontTouch: ['source files', 'tests'], ...(role === 'docs-writer' ? { worktree: x.W, branch: x.branch } : {}) }, role === 'docs-writer' ? ['--human-approved', today(), ...(N.statusLine(x.c, 'announcement') ? ['--announcement'] : [])] : []);
}

// the highest round of this role's spawns that next.mjs issued: a spawn that has no hand-off yet is still running
// (`step --lost` says it died: the round is then issued again)
function issuedRound(x, step, role) {
  const re = new RegExp(`^${step}:${role}:r(\\d+)$`);
  return Math.max(0, ...lines(read(join(x.c.team, 'next.log'))).map((l) => l.split('\t')[1]?.match(re)?.[1]).filter(Boolean).map(Number));
}
const running = (x, step, role) => !x.o.lost && issuedRound(x, step, role) > (latestOf(x, step, role)?.handoff.round ?? 0);

function waitFor(x, who) {
  push('action=wait'); say('for', who.join(','));
  say('then', `run next.mjs step ${x.task} when ${who.join(' and ')} has returned (an agent that died without a hand-off: next.mjs step ${x.task} --lost)`);
  return flush(0);
}

// the agent roles of a step in this lane, minus the roles the lane line skips
function rolesOf(x, step) {
  const { lane, scope } = x.lane;
  let roles = [];
  if (step === '1') roles = ['researcher'];
  if (step === '2') roles = ['product-manager'];
  if (step === '3') roles = lane === 'change' ? (scope === 'ui-only' ? ['designer'] : scope === 'ui+logic' ? ['designer', 'architect'] : ['architect']) : lane === 'upgrade' ? ['architect'] : ['designer', 'architect'];
  return roles.filter((r) => !x.tokens.has(r));
}

function agentStep(step) {
  return (x) => {
    const roles = rolesOf(x, step);
    const stillRunning = roles.filter((r) => running(x, step, r));
    // a role that came back done at its latest round is finished, unless a later round of it was issued (changes were asked)
    const missing = roles.filter((r) => !lastOk(x, step, r) || running(x, step, r));
    if (!missing.length) return undefined;
    const toStart = missing.filter((r) => !running(x, step, r));
    if (!toStart.length) return waitFor(x, stillRunning);
    // every role of a step starts in one message
    for (const r of toStart) spawnStep(x, step, r, (latestOf(x, step, r)?.handoff.round ?? 0) + 1);
    return flush(0);
  };
}

/* ---------- human gates ---------- */

const GATE_OF = { '2b': { id: 'plan-review', approve: (x) => ['gate', slash(x.c.team), '2b', 'approve', '--plan', `docs/plan/${x.task}.md`] }, '3c': { id: 'design-review', approve: (x) => ['gate', slash(x.c.team), '3c', 'approve'] } };

function humanGate(step) {
  return (x) => {
    const st = gateState(x.cp, step);
    if (st === 'passed' || st === 'skipped') return undefined;
    const g = GATE_OF[step];
    const sum = node('gate-summary.mjs', [slash(x.c.team), step, ...(step === '2b' ? ['--plan', `docs/plan/${x.task}.md`] : [])], { cwd: x.W });
    if (/ready=no/.test(sum.stdout)) {
      push('action=stop'); say('reason', `the ${step} gate summary is not ready`);
      for (const l of lines(sum.stdout).filter((l) => !/^ready=/.test(l)).slice(-8)) say('detail', l);
      say('then', step === '2b' ? 'fix what it lists with the product-manager, then run step again' : 'fix what it lists with the designer or architect, then run step again');
      return flush(1);
    }
    const body = lines(sum.stdout).filter((l) => !/^ready=/.test(l)).join('\n');
    return askGate(x, g.id, body, [{ label: 'Approve', description: 'Accept and continue' }, { label: 'Request changes', description: 'Say what to change after a colon: the roles run again' }, { label: 'Reject', description: 'Stop here; the pause stays' }]);
  };
}

// a human gate: headless writes gate.json and waits; interactive prints the question and saves the pause
function askGate(x, gate, body, options) {
  const q = { questions: [{ question: body.slice(0, 3800), header: gate.slice(0, 12), multiSelect: false, options }] };
  writeMeta(x.c, { gate });
  if (x.headless) {
    writeFileSync(join(x.c.team, 'gate.json'), JSON.stringify(q, null, 2));
    const a = node('checkpoint.mjs', ['ask', slash(x.c.team), gate], { cwd: x.c.main });
    N.commitTeam(x.c, `docs(${x.lane.lane}): ${gate} waiting for ${x.task}`);
    return N.stopFromAsk(a.stdout, a.stderr);
  }
  node('checkpoint.mjs', ['pause', slash(x.c.team), gate, '--until', `the user answers ${gate}`]);
  push('action=ask'); say('gate', gate);
  push('---questions---', JSON.stringify(q), '---questions---');
  say('then', `node next.mjs answer ${x.task} "<the label the user picked>"${gate === 'human-gate' ? '' : ' ("Request changes: <what to change>" sends the roles back)'}`);
  return flush(0);
}

/* ---------- steps that need the model or an outside tool: `do`, checked by the script ---------- */

function doAction(x, name, instructions, then) {
  push('action=do'); say('task', name); instructions.forEach((i) => say('instruction', i)); say('then', then);
  return flush(0);
}

const canvasStep = (x) => {
  if (!lastOk(x, '3', 'designer') || N.statusLine(x.c, 'canvas')) return undefined;
  return doAction(x, 'publish-canvas', [
    `publish ${x.T}/canvas/ on Claude Design as step-details.md "Step 3b" says (the Artifact tool, type Design); an artifact tool that is not available means the canvas cannot be published here`,
    'put the URL in design.md', 'write it back with the command in then=',
  ], `node next.mjs record ${x.task} canvas <url>   (no way to publish: node next.mjs record ${x.task} canvas "not published: <why>")`);
};

const diagramStep = (x) => {
  const specs = x.hs.flatMap((h) => (h.handoff?.diagrams_spec ?? []).map((s) => ({ ...s, from: h.handoff.role })));
  if (!specs.length || N.statusLine(x.c, 'diagrams')) return undefined;
  if (running(x, '3e', 'diagrammer')) return waitFor(x, ['diagrammer']);
  if (!latestOf(x, '3e', 'diagrammer')) {
    writeFileSync(join(x.c.team, 'diagrams-spec.json'), JSON.stringify(specs, null, 2));
    spawnStep(x, '3e', 'diagrammer', 1);
    return flush(0);
  }
  return doAction(x, 'publish-diagrams', [
    'run check-diagram.mjs then check-diagram-render.mjs on every file the diagrammer wrote', 'publish each file as its own Artifact (diagram-publish.md), a failing or unpublishable one is skipped: it never blocks',
  ], `node next.mjs record ${x.task} diagrams "<n> published"   (or "skipped: <why>")`);
};

const designReviewStep = (x) => {
  if (!lastOk(x, '3', 'designer') || x.skipped.has('3c')) return undefined;
  let v = N.statusLine(x.c, 'design-review');
  // sent back at round n: the revised design (a designer hand-off at round n or later) is reviewed again, from a clean slate
  const back = v?.match(/^sent back r(\d+)/i);
  if (back && (latestOf(x, '3', 'designer')?.handoff.round ?? 0) >= Number(back[1])) { setStatus(x.c, 'design-review', 'pending'); v = 'pending'; }
  if (v === 'pending' || (back && v === `sent back r${back[1]}`)) {
    if (v === 'pending') return reviewAction(x);
    return undefined;
  }
  if (v && !/^high/i.test(v)) return undefined;
  if (v && /^high/i.test(v)) {
    const round = (latestOf(x, '3', 'designer')?.handoff.round ?? 1) + 1;
    setStatus(x.c, 'design-review', `sent back r${round}`);
    writeFileSync(join(x.c.team, `design-review-${round - 1}.md`), `# UX/UI review, round ${round - 1}\n\n${v}\n`);
    spawnStep(x, '3', 'designer', round, `${x.T}/design-review-${round - 1}.md`);
    return flush(0);
  }
  return reviewAction(x);
};

const reviewAction = (x) => doAction(x, 'design-review', [
  'open the canvas at its URL (canvas: in checkpoint ## Status) and run the review in design-review.md: the impeccable skill on every AC x state against docs/design-system/',
  'a high finding goes back to the designer before the user is asked; the rest go into the gate question',
], `node next.mjs record ${x.task} design-review "clean"   (or "findings: <the non-blocking ones>", or "high: <what to fix>")`);

/* ---------- code: dev, merge, review, test gate ---------- */

// top-level source files of a small repo (cart.js): what a dev may write when the contract names no folder
const readdirTop = (dir) => execFileSync('git', ['-C', dir, 'ls-files'], { encoding: 'utf8' }).split('\n').filter((f) => f && !f.includes('/') && /\.(m?js|cjs|tsx?|py|go|rs|rb|java|kt|swift|php)$/.test(f));

function devSpawn(x, { round, only, review, retry }) {
  const sides0 = (only ?? devRoles(x).map((r) => Object.keys(N.DEV).find((s) => N.DEV[s] === r) ?? r)).filter((s) => s in N.DEV);
  const sides = sides0.filter((s) => !running(x, '4', N.DEV[s]) || (x.o.lost));
  if (sides0.length && !sides.length) return waitFor(x, sides0.map((s) => N.DEV[s]));
  const src = x.lane.lane === 'verify' ? `verify/${x.task}` : `feature/${x.task}`;
  const own = existsSync(join(x.c.team, 'contract', 'ownership.md')) ? parseOwnership(read(join(x.c.team, 'contract', 'ownership.md'))) : [];
  N.commitTeam(x.c, `docs(${x.lane.lane}): planning files for ${x.task}`);
  for (const s of sides) {
    const wt = join(x.c.main, '.worktrees', `${N.SIDE[s]}-${x.task}`);
    const branch = `${N.SIDE[s]}/${x.task}`;
    if (!existsSync(wt)) {
      git(x.c.main, 'worktree', 'add', slash(wt), '-b', branch, src);
      const sy = node('sync-worktree.mjs', [slash(wt)], { cwd: x.c.main });
      if (/synced [1-9]/.test(sy.stdout)) { git(wt, 'add', '-A'); git(wt, 'commit', '-q', '-m', 'chore(muffy): sync skill scripts'); }
    } else if (round > 1) gitOk(wt, 'merge', '--no-edit', src);
    const role = N.DEV[s];
    const tests = ['test', 'tests', '__tests__', 'spec'].filter((d) => existsSync(join(x.W, d))).map((d) => `${d}/`);
    const mine = own.filter((r) => r.owner === s).map((r) => r.pattern.replace(/\*.*$/, ''));
    const dirs = mine.length ? [...mine, ...tests] : [...['src', 'app', 'lib'].filter((d) => existsSync(join(x.W, d))).map((d) => `${d}/`), ...tests, ...readdirTop(x.W)];
    const read = [`${x.T}/ac.md`, ...['contract.md', 'design.md'].filter((f) => existsSync(join(x.c.team, f))).map((f) => `${x.T}/${f}`), ...(review ? [`${x.T}/review-${roundOfName(review.name)}.md`] : []), ...(existsSync(join(x.c.team, 'qa-report.md')) && round > 1 ? [`${x.T}/qa-report.md`] : []), ...(retry ? [retry] : [])];
    spawn(x, { role, step: '4', round, goal: round > 1 ? 'Fix what the review or the test gate found, on top of your last round.' : 'Build the change for every AC in ac.md and the contract, with a unit test for each AC.', doneWhen: `the hand-off validates, lists every AC id in ac_ids_done, and ac-tests-${N.SIDE[s]}.md maps each AC to its test`,
      read, write: [...new Set(dirs), `ac-tests-${N.SIDE[s]}.md`], dontTouch: ['the other side\'s files', 'package manifests and lockfiles unless the AC names them'], worktree: wt, branch,
      lineKnown: false });
  }
  return flush(0);
}

const devStep = (x) => {
  const roles = devRoles(x);
  if (!roles.length) return undefined;
  const run = roles.filter((r) => running(x, '4', r));
  const need = roles.filter((r) => !running(x, '4', r) && !lastOk(x, '4', r));
  if (!need.length) return run.length ? waitFor(x, run) : undefined;
  return devSpawn(x, { round: Math.max(1, maxRound(x, '4')), only: need.map((r) => Object.keys(N.DEV).find((s) => N.DEV[s] === r)) });
};

// the verify lane skips 4 and 5 until the user says the team may fix on the copy (verify-profile.md)
const verifyFixes = (x) => x.lane.lane === 'verify' && /on copy/.test(N.statusLine(x.c, 'verify fix') ?? '');

const mergeStep = (x) => {
  const round = Math.max(1, maxRound(x, '4'));
  if (!devRoles(x).length) return undefined;
  if (N.issued(x.c, `merged:r${round}`)) return undefined;
  N.commitTeam(x.c, `chore(muffy): log round ${round} for ${x.task}`);
  if (existsSync(join(x.c.team, 'contract', 'ownership.md'))) {
    const co = node('check-ownership.mjs', [slash(x.c.team)], { cwd: x.W });
    if (co.status !== 0) { push('action=stop'); say('reason', 'check-ownership found a file outside its owner'); for (const l of lines(co.stdout + co.stderr).slice(0, 10)) say('detail', l); say('then', 'send each out-of-lane file back to its owner as a fix round (step-details.md "Step 5"), then run step again'); return flush(1); }
  }
  for (const r of devRoles(x)) {
    const s = Object.keys(N.DEV).find((k) => N.DEV[k] === r);
    const wt = join(x.c.main, '.worktrees', `${N.SIDE[s]}-${x.task}`);
    const dirty = existsSync(wt) ? git(wt, 'status', '--short') : '';
    if (dirty) { push('action=stop'); say('reason', `${slash(wt)} has uncommitted files: the dev must commit its work`); say('files', dirty.split('\n').join(' ; ')); return flush(1); }
    const merged = gitOk(x.W, 'merge', '--no-ff', `${N.SIDE[s]}/${x.task}`, '-m', `merge: ${N.SIDE[s]}/${x.task} into feature/${x.task}${N.trailerOf(x.c) ? `\n\n${N.trailerOf(x.c)}` : ''}`);
    if (!merged) { gitOk(x.W, 'merge', '--abort'); push('action=stop'); say('reason', `merging ${N.SIDE[s]}/${x.task} into feature/${x.task} conflicts`); say('then', 'resolve it as a person would, or tell the user'); return flush(1); }
  }
  N.log(x.c, `merged:r${round}`);
  return undefined;
};

function exportDiff(x, round) {
  const patch = join(x.c.team, `diff-${round}.patch`);
  writeFileSync(patch, execFileSync('git', ['-C', x.W, 'diff', `${x.base}...HEAD`, '--', '.', ':!.team'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  N.commitTeam(x.c, `chore(muffy): diff for review ${round} of ${x.task}`);
}

function reviewerSpawn(x, round, retry) {
  if (!existsSync(join(x.c.team, `diff-${round}.patch`))) exportDiff(x, round);
  const T = x.T;
  const read = [`${T}/ac.md`, ...['contract.md', 'design.md'].filter((f) => existsSync(join(x.c.team, f))).map((f) => `${T}/${f}`), `${T}/diff-${round}.patch`, ...x.hs.filter((h) => stepOfName(h.name) === '4' && roundOfName(h.name) === round).map((h) => `${T}/handoff/${h.name}`), ...(retry ? [retry] : [])];
  spawn(x, { role: 'code-reviewer', step: '6', round, goal: x.lane.lane === 'verify' ? 'Review the diff against ac.md and the codebase conventions: correctness, quality and security.' : 'Review the diff against ac.md and contract.md for correctness, quality and security.', doneWhen: 'a verdict line, then the one-line JSON hand-off with verdict Approve or Reject', read, write: [`${T}/review-${round}.md`], dontTouch: ['everything: read-only'], worktree: x.W, branch: x.branch });
  push(`then=when it returns, pipe its whole final message to: node next.mjs review ${x.task}`);
  return flush(0);
}

const reviewStep = (x) => {
  const round = Math.max(1, maxRound(x, '4'));
  const h = latestOf(x, '6', 'code-reviewer')?.handoff;
  if (h && h.round >= round && h.verdict === 'Approve') return undefined;
  if (h && h.round >= round) return undefined; // a Reject at this round was handled by the loop rules above
  return reviewerSpawn(x, round);
};

const testStep = (x) => {
  const round = Math.max(1, maxRound(x, '4'));
  if (N.issued(x.c, `tested:r${round}`)) return undefined;
  let cwd = x.W;
  if (x.lane.lane === 'verify') {
    const qa = join(x.c.main, '.worktrees', `qa-${x.task}`);
    if (!existsSync(qa)) git(x.c.main, 'worktree', 'add', slash(qa), '-b', `qa/${x.task}`, `verify/${x.task}`);
    else gitOk(qa, 'merge', '--ff-only', `verify/${x.task}`);
    cwd = qa;
  }
  const tg = node('test-gate.mjs', [slash(x.c.team), '--cwd', slash(cwd)], { cwd: x.c.main });
  N.commitTeam(x.c, `docs(${x.lane.lane}): test gate round ${round} for ${x.task}`);
  if (tg.status === 1) {
    N.log(x.c, `tested-fail:r${round}`);
    const fails = N.issued(x.c, `tested-fail:r${round}`) + (round > 1 ? round - 1 : 0);
    if (x.lane.lane === 'verify') return askVerifyFix(x, null, 'the test gate failed (qa-report.md lists the failing tests)');
    if (fails >= LOOP_LIMIT) { push('action=stop'); say('outcome', 'escalated'); say('trigger', 'loop-limit'); say('reason', `the test gate failed ${fails} rounds`); say('then', 'escalate as loops.md says'); if (x.headless) say('muffy-status', 'blocked:loop-limit'); return flush(1); }
    return devSpawn(x, { round: round + 1, review: null });
  }
  N.log(x.c, `tested:r${round}`);
  setStatus(x.c, 'test-gate', tg.status === 3 ? 'skipped (no test_command)' : 'passed');
  return undefined;
};

function askVerifyFix(x, last, why) {
  const text = `${why ?? 'The reviewer rejected the branch.'} What now? The requester's branch is never edited: a fix goes on the copy (verify/${x.task}).`;
  const q = { questions: [{ question: text, header: 'verify-fix', multiSelect: false, options: [{ label: 'Fix on the copy', description: 'The owners fix on verify/<task>; review and the test gate run again' }, { label: 'Report only', description: 'Close with the findings; the requester fixes their branch' }] }] };
  writeMeta(x.c, { gate: 'verify-fix' });
  if (x.headless) { writeFileSync(join(x.c.team, 'gate.json'), JSON.stringify(q, null, 2)); const a = node('checkpoint.mjs', ['ask', slash(x.c.team), 'question'], { cwd: x.c.main }); return N.stopFromAsk(a.stdout, a.stderr); }
  push('action=ask'); say('gate', 'verify-fix'); push('---questions---', JSON.stringify(q), '---questions---'); say('then', `node next.mjs answer ${x.task} "<the label the user picked>"`);
  return flush(0);
}

const humanGate10 = (x) => {
  if (/^approved/i.test(N.statusLine(x.c, 'human-gate') ?? '')) return undefined;
  const sum = node('gate-summary.mjs', [slash(x.c.team), '10'], { cwd: x.W });
  const body = lines(sum.stdout).filter((l) => !/^ready=/.test(l)).join('\n');
  return askGate(x, 'human-gate', `${body}\n\nAccept this branch? (Approve means accept, not deploy.)`, [{ label: 'Approve', description: `Accept ${x.branch}` }, { label: 'Reject', description: 'Send it back with the reason' }]);
};

const docsStep = (x) => {
  if (x.skipped.has('11') || lastOk(x, '11', 'docs-writer') || N.statusLine(x.c, 'docs-skipped')) return undefined;
  node('remove-worktrees.mjs', [x.task, '--stage', 'roles', '--cwd', slash(x.c.main)], { cwd: x.c.main });
  const { lane, scope } = x.lane;
  const small = lane === 'verify' || (lane === 'change' && scope === 'internal');
  if (small) {
    const names = git(x.W, 'diff', '--name-only', `${x.base}...HEAD`, '--', '.', ':!.team').split('\n');
    const touches = names.some((n) => /migrat|(^|\/)\.env|config|readme|^docs\//i.test(n));
    if (!touches) { setStatus(x.c, 'docs-skipped', 'the diff changes no migration, config or doc'); return undefined; }
  }
  if (running(x, '11', 'docs-writer')) return waitFor(x, ['docs-writer']);
  spawnStep(x, '11', 'docs-writer', 1);
  return flush(0);
};

// upgrade: once the researcher listed the breaking changes, one AC and one traceability row for each is the Orchestrator's to add (upgrade-profile.md step 3)
const upgradeAcStep = (x) => {
  if (x.lane.lane !== 'upgrade' || N.statusLine(x.c, 'upgrade-ac')) return undefined;
  return doAction(x, 'upgrade-ac', [
    `read the \`## Must-not-miss requirements\` of ${x.T}/brief.md: each breaking change the changelog names, with where this repo is hit`,
    `add one AC-<n> per breaking change to ${x.T}/ac.md and one row per brief item to its \`## Traceability\` table (check-artifacts.mjs holds the two together)`,
  ], `node next.mjs record ${x.task} upgrade-ac "<n> added"   (none named: "none: the changelog lists no breaking change")`);
};

const HANDLERS = { '1': (x) => agentStep('1')(x) ?? upgradeAcStep(x), '2': agentStep('2'), '2b': humanGate('2b'), '3': agentStep('3'), '3b': canvasStep, '3e': diagramStep, '3c': (x) => designReviewStep(x) ?? humanGate('3c')(x), '4': devStep, '5': mergeStep, '6': reviewStep, '7': testStep, '10': humanGate10, '11': docsStep };

function closeAll(x) {
  const done = N.closeTask(x.c, { task: x.task, base: x.base, W: x.W, docs: true, branch: x.branch, lane: x.lane.lane, gateText: '', facts: N.statusLine(x.c, 'test-gate') ? `test gate ${N.statusLine(x.c, 'test-gate')}` : '' });
  return done;
}

/* ---------- needs-input: the interview ---------- */

function clarify(x, h) {
  const { role, step, round } = h.handoff;
  const n = Number(N.statusLine(x.c, `clarify ${role}`)?.match(/(\d)\/2/)?.[1] ?? 0);
  if (n >= 2) { push('action=stop'); say('reason', `${role} asked a third time: at most 2 clarification rounds per agent (requirements.md); every open item must become an assumption`); if (x.headless) say('muffy-status', 'blocked:clarify-limit'); return flush(1); }
  const qs = h.handoff.questions ?? [];
  const q = { questions: qs.slice(0, 4).map((k) => ({ question: `${k.question}\n(${k.why})`, header: k.id, multiSelect: false, options: [k.default, ...k.options.filter((o) => o !== k.default)].slice(0, 4).map((l, i) => ({ label: l, description: i === 0 ? 'recommended' : '' })) })) };
  writeMeta(x.c, { gate: 'clarify', role, step: String(step), round, questions: qs.slice(0, 4).map((k) => ({ id: k.id, question: k.question, default: k.default })) });
  if (x.headless) {
    writeFileSync(join(x.c.team, 'gate.json'), JSON.stringify(q, null, 2));
    const a = node('checkpoint.mjs', ['ask', slash(x.c.team), 'question'], { cwd: x.c.main });
    return N.stopFromAsk(a.stdout, a.stderr);
  }
  push('action=ask'); say('gate', 'clarify'); say('role', role); push('---questions---', JSON.stringify(q), '---questions---');
  say('then', `node next.mjs answer ${x.task} "<the labels the user picked, in order, joined by ' | '>"`);
  return flush(0);
}

/* ---------- answers ---------- */

// the person's answer, in headless mode already consumed by checkpoint.mjs answer; undefined = carry on with step
function afterAnswer(x, answer, raw) {
  const m = readMeta(x.c);
  if (!m) return undefined;
  rmSync(metaFile(x.c), { force: true });
  return applyAnswer(x, m, String(answer ?? '').trim(), raw);
}

function applyAnswer(x, m, label, raw) {
  const reason = label.includes(':') ? label.slice(label.indexOf(':') + 1).trim() : '';
  if (m.gate === 'plan-review' || m.gate === 'design-review') {
    const step = m.gate === 'plan-review' ? '2b' : '3c';
    // headless: checkpoint.mjs answer already recorded the approval (gate 2b / 3c passed); a second `gate approve` is not needed
    if (/^approve/i.test(label) && gateState(read(join(x.c.team, 'checkpoint.md')), step) === 'passed') { N.commitTeam(x.c, `docs(${x.lane.lane}): gate ${step} approved for ${x.task}`); return undefined; }
    if (/^approve/i.test(label)) {
      const g = node('checkpoint.mjs', [...GATE_OF[step].approve(x), '--by', label], { cwd: x.W });
      if (g.status !== 0) { push('action=stop'); say('reason', `checkpoint.mjs gate ${step} approve was refused`); for (const l of lines(g.stdout + g.stderr).slice(0, 6)) say('detail', l); return flush(1); }
      N.commitTeam(x.c, `docs(${x.lane.lane}): gate ${step} approved for ${x.task}`);
      return undefined;
    }
    if (/^reject/i.test(label)) { node('checkpoint.mjs', ['gate', slash(x.c.team), step, 'reject', '--by', label]); push('action=stop'); say('outcome', 'rejected'); say('reason', `the user rejected at ${step}`); return flush(1); }
    writeFileSync(join(x.c.team, `changes-${step}.md`), `# Changes asked at ${step}\n\n${reason || label}\n`);
    node('checkpoint.mjs', ['unpause', slash(x.c.team)]);
    if (step === '3c') setStatus(x.c, 'design-review', `sent back r${(latestOf(x, '3', 'designer')?.handoff.round ?? 0) + 1}`);
    const roles = step === '2b' ? ['product-manager'] : rolesOf(x, '3');
    const stp = step === '2b' ? '2' : '3';
    for (const r of roles) spawnStep(x, stp, r, (latestOf(x, stp, r)?.handoff.round ?? 0) + 1, `${x.T}/changes-${step}.md`);
    return flush(0);
  }
  /* the gates below spawn on their own */
  if (m.gate === 'human-gate') {
    node('checkpoint.mjs', ['unpause', slash(x.c.team)]);
    if (!/^approve/i.test(label)) { push('action=stop'); say('reason', `the user did not approve: ${label}`); say('then', 'ask what to change; a fix round reuses the role worktrees (resume.md)'); return flush(1); }
    setStatus(x.c, 'human-gate', `approved ${today()}`);
    N.commitTeam(x.c, `docs(${x.lane.lane}): human gate approved for ${x.task}`);
    return undefined;
  }
  if (m.gate === 'verify-fix') {
    setStatus(x.c, 'verify fix', /^fix/i.test(label) ? 'on copy' : 'report');
    if (/^fix/i.test(label)) { const last = x.hs.filter((h) => h.handoff?.verdict === 'Reject').at(-1); return devSpawn(x, { round: Math.max(maxRound(x, '4'), maxRound(x, '6')) + 1, only: owners(last), review: last }); }
    push('action=stop'); say('outcome', 'reported'); say('then', 'close with the findings (closing.md "Stopped at a stop point", outcome reported): the review is in review-<n>.md and the test report in qa-report.md'); return flush(1);
  }
  if (m.gate === 'clarify') {
    const labels = label.split('|').map((s) => s.trim());
    const section = `\n## ${today()} · ${m.role} round ${m.round}\n${m.questions.map((k, i) => `- ${k.id} · ${k.question} · ${labels[i] && labels[i] !== k.default ? labels[i] : `assumed: ${k.default}`} · asked by ${m.role}`).join('\n')}\n`;
    const f = join(x.c.team, 'requirements.md');
    writeFileSync(f, (existsSync(f) ? read(f) : '# Requirements\n') + section);
    const n = Number(N.statusLine(x.c, `clarify ${m.role}`)?.match(/(\d)\/2/)?.[1] ?? 0) + 1;
    setStatus(x.c, `clarify ${m.role}`, `${n}/2`);
    N.commitTeam(x.c, `docs(${x.lane.lane}): answers for ${m.role}`);
    spawnStep(x, m.step, m.role, m.round + 1);
    return flush(0);
  }
  if (m.gate === 'scope') return undefined;
  return undefined;
}

const owners = (h) => [...new Set((h?.handoff?.blockers ?? []).map((b) => b.owner))].filter((o) => o in N.DEV);

export function flowAnswer(o) {
  const x = ctxOf({ ...o, _: [o._[0]] });
  const m = readMeta(x.c);
  if (!m) throw new Error(`no question is waiting for ${x.task} (no ask-meta.json)`);
  rmSync(metaFile(x.c), { force: true });
  const r = applyAnswer(x, m, String(o._[1] ?? '').trim(), '');
  if (r !== undefined) return r;
  return flowStep({ ...o, _: [x.task] });
}

export function flowRecord(o) {
  const [task, key, ...val] = o._;
  const x = ctxOf({ ...o, _: [task] });
  if (!['canvas', 'diagrams', 'design-review', 'upgrade-ac'].includes(key)) throw new Error('record: the key is canvas, diagrams, design-review or upgrade-ac');
  if (!val.length) throw new Error(`record ${key} needs a value`);
  setStatus(x.c, key, val.join(' '));
  N.commitTeam(x.c, `docs(${x.lane.lane}): ${key} recorded for ${x.task}`);
  return flowStep({ ...o, _: [task] });
}

