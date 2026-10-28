#!/usr/bin/env node
// The Orchestrator's deterministic rules in one place: loop budget and fallback ladder (references/loops.md),
// effort tiers (references/token-discipline.md), smoke triggers (references/run-profile.md), fix and lite triage
// (references/fix-profile.md, lite-profile.md). The offline evals import these exports, so a rule changed here
// is a rule changed for both the running skill and `npm test`. Change the doc in the same commit.
//
// Usage:
//   node next-action.mjs loop <handoff.json | handoff dir>... [--profile fix|lite|redesign [--scope <scope>]] [--skip 3d] [--smoke <signal,...>] [--task <task>] [--escalation-out <file>]
//        hand-offs in the order they came back; a directory is read in file-time order
//   node next-action.mjs effort --role <role> [--mode production|prototype] [--high-impact] [--assumed] [--exact-fix] [--stalled <n>]
//   node next-action.mjs smoke [--runtime-changed] [--devops-files-changed] [--no-passing-smoke]
//   node next-action.mjs triage fix|lite '<signals json>'
//   node next-action.mjs baseline --lane <lane> [--repo .] [--no-code]      (setup step 3: continue | refresh:silent | ask:*)
//   node next-action.mjs plan-card <lane> [--scope s] [--until step] [--skip 3d] [--lang th|en]   (route.md: the plan shown before spawning)
// Prints one verdict line (`next=<action> ...`), then detail lines. Exit 0 = proceed, 1 = escalate / blocked / invalid, 2 = usage error.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { validate } from './schema.mjs';
import { LANES, NEVER_SKIP, skipsOf, neverSkipOf, planCard } from './lanes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const schema = (kind) => JSON.parse(readFileSync(join(here, '..', 'schemas', `${kind}.schema.json`), 'utf8'));
const handoffSchema = schema('handoff');
const escalationSchema = schema('escalation');

/* ---------- smoke triggers (run-profile.md) ---------- */

// 3d (devops mode 2) runs only if one trigger is true.
export const SMOKE_TRIGGERS = {
  runtime_or_dependency_changed: 'contract adds or bumps a runtime, lockfile dependency, native/binary package or datastore',
  devops_files_changed: 'devops-owned files change (Dockerfile, base image, .nvmrc, compose)',
  no_passing_smoke_on_record: 'no passing smoke recorded for this stack (first feature, onboarding, last smoke failed)',
};

export function smokeRequired(signals = {}) {
  const reasons = Object.keys(SMOKE_TRIGGERS).filter((k) => signals[k] === true);
  return { required: reasons.length > 0, reasons };
}

/* ---------- loop budget and fallback ladder (loops.md) ---------- */

export const LOOP_LIMIT = 3; // fix loops allowed per loop point; the 4th rejection escalates
export const REPEAT_LIMIT = 3; // same blocker id open in this many consecutive rejections = fix is not converging
export const GATED_STEPS = ['3c', '3d']; // must pass before step 4; 3c passes only after the user approves the design (pause:design-review)
export { NEVER_SKIP };
export const FIX_NEVER_SKIP = LANES.fix.neverSkip; // fix lane (references/fix-profile.md): diagnose, then audit the cause, before any code
export const SEVERITIES = ['low', 'medium', 'high', 'critical']; // impact of the bug; the auditor's evidence bar rises with it (agents/references/auditor/rules-and-guardrails.md)
export const EVIDENCE_LEVELS = ['none', ...SEVERITIES]; // the highest severity tier whose minimum evidence a diagnosis meets
export const AUDIT_ROUNDS = 1; // need-validation rounds allowed before the auditor's verdict counts as reject
export const FIX_MAX_FILES = LANES.fix.maxFiles; // source files (tests and .team/ excluded) before a fix is promoted to the full flow
export const LITE_MAX_FILES = LANES.lite.maxFiles; // same count for the lite lane (references/lite-profile.md)
const isSource = (p) => !/(^|[\\/])\.team[\\/]/.test(p) && !/(^|[\\/])(tests?|__tests__)[\\/]|\.(test|spec)\.[a-z]+$/i.test(p);

const REJECTING = new Set(['Reject', 'Fail']);

// scenario: { task, profile, skip, smoke_signals, events: [{ handoff, step?, role? }] }
// Returns every action the Orchestrator must take, in order; the last one is what to do now.
export function simulate(scenario) {
  const actions = [];
  const loops = {}; // point -> rejections so far
  const streak = {}; // point -> { blocker id -> consecutive rejections it has been open }
  const vstreak = {}; // point -> { needs_validation id -> consecutive reviews it has been open }
  const audits = {}; // point -> need-validation rounds used (fix lane step 4b)
  let diagSeverity = null; // severity of the latest known diagnosis
  let pendingAsk = false; // a reject is waiting for the user's answer
  let moreInfoUsed = false; // the user already gave more information once
  let auditRetries = 0; // confirms sent back for evidence below the severity (not reset by the generic retry counter)
  const retries = {}; // point -> invalid / not-ready retries used this round
  const passed = new Set(scenario.passed ?? []); // gates already passed outside the hand-offs (3c is a user approval, read from the checkpoint)
  const skipped = new Set(scenario.skip ?? []);
  let outcome = 'in-progress';
  let trigger = null;
  let escalation = null;
  const fix = scenario.profile === 'fix';

  const violations = NEVER_SKIP.filter((s) => skipped.has(s)).map((s) => `never-skip step ${s} was skipped`);
  if (LANES[scenario.profile]) violations.push(...neverSkipOf(scenario.profile).filter((s) => !NEVER_SKIP.includes(s) && skipped.has(s)).map((s) => `${scenario.profile} lane: step ${s} was skipped`));
  if (skipped.has('3d')) {
    const { required, reasons } = smokeRequired(scenario.smoke_signals);
    if (required) violations.push(`3d skipped although a smoke trigger is true: ${reasons.join(', ')}`);
  }
  if (violations.length) return { actions, loops, outcome: 'invalid-profile', trigger: null, violations, escalation };

  const escalate = (point, why, blockers, owner) => {
    outcome = 'escalated';
    trigger = why;
    escalation = {
      task: scenario.task ?? 'mock-task',
      step: point.split(':')[0],
      trigger: why,
      loops_used: Math.max(1, loops[point] ?? 1),
      loop_limit: LOOP_LIMIT,
      owner: owner ?? 'unknown',
      open_blockers: (blockers.length ? blockers : [{ id: 'B-0', problem: 'unspecified' }]).map((b) => ({ id: b.id, problem: b.problem, rounds_open: Math.max(1, loops[point] ?? 1) })),
      attempts: [`${loops[point] ?? 0} rejected round(s); see handoff/ files`],
      options: ['extend-loops', 'change-approach', 'reduce-scope', 'abort-task'],
    };
    actions.push(`escalate:${why}`);
  };

  for (const ev of scenario.events) {
    if (outcome === 'escalated') break;
    if (ev.answer) {
      // the user's answer to an audit reject (fix-profile.md): more-info | accept-risk | cancel
      if (!pendingAsk) { actions.push('ignore:answer-without-question'); continue; }
      pendingAsk = false;
      if (ev.answer === 'more-info') {
        moreInfoUsed = true;
        audits['4b:auditor'] = 0;
        actions.push('rediagnose:debugger');
      } else if (ev.answer === 'accept-risk') {
        passed.add('4b');
        actions.push('proceed:risk-accepted');
      } else {
        outcome = 'cancelled';
        actions.push('close:cancelled');
        break;
      }
      continue;
    }
    const h = ev.handoff;
    const point = `${h?.step ?? ev.step ?? '?'}:${h?.role ?? ev.role ?? '?'}`;

    if (GATED_STEPS.length && String(h?.step ?? ev.step).match(/^4/) && GATED_STEPS.some((g) => !passed.has(g) && !skipped.has(g))) {
      actions.push('block:gate-not-passed');
      outcome = 'blocked';
      break;
    }

    if (fix && String(h?.step ?? ev.step) === '4' && !passed.has('4a')) {
      actions.push('block:no-diagnosis');
      outcome = 'blocked';
      break;
    }
    if (fix && String(h?.step ?? ev.step) === '4' && !passed.has('4b')) {
      actions.push('block:no-audit');
      outcome = 'blocked';
      break;
    }

    // 1. structure: invalid hand-off -> one retry with the error list, then escalate
    const errs = h ? validate(handoffSchema, h) : ['no handoff block in final message'];
    if (errs.length) {
      retries[point] = (retries[point] ?? 0) + 1;
      if (retries[point] === 1) { actions.push('retry:invalid-handoff'); continue; }
      escalate(point, 'invalid-handoff', [], h?.role);
      continue;
    }

    // 2. self-reported quality failure: one retry, then escalate
    if (!h.quality_checks.passed) {
      retries[point] = (retries[point] ?? 0) + 1;
      if (retries[point] === 1) { actions.push('retry:quality-check-failed'); continue; }
      escalate(point, 'quality-check-failed-twice', h.blockers, h.role);
      continue;
    }
    retries[point] = 0;

    // 2a. fix lane: the auditor's verdict on the diagnosis (fix-profile.md). Silent: the debugger only ever sees `missing` through the hand-off file
    if (h.audit) {
      const { verdict, evidence_level: level } = h.audit;
      if (verdict === 'confirm' && diagSeverity && EVIDENCE_LEVELS.indexOf(level) < EVIDENCE_LEVELS.indexOf(diagSeverity)) {
        auditRetries += 1;
        if (auditRetries === 1) { actions.push('retry:audit-below-severity'); continue; }
        escalate(point, 'invalid-handoff', [], h.role);
        continue;
      }
      auditRetries = 0;
      if (verdict === 'confirm') { passed.add('4b'); actions.push('accept'); continue; }
      if (verdict === 'need-validation') audits[point] = (audits[point] ?? 0) + 1;
      const unresolved = verdict === 'reject' || audits[point] > AUDIT_ROUNDS;
      if (!unresolved) { actions.push('revalidate:debugger'); continue; }
      if (moreInfoUsed) { loops[point] = (loops[point] ?? 0) + 1; escalate(point, 'loop-limit', [], h.role); continue; }
      pendingAsk = true;
      actions.push('ask:reject-options');
      continue;
    }

    // 2b. fix lane: route on the diagnosis (fix-profile.md)
    if (h.diagnosis?.status === 'needs-full-flow') {
      actions.push('promote:full-flow');
      outcome = 'promoted';
      trigger = 'needs-full-flow';
      break;
    }
    if (h.diagnosis?.status === 'unknown') {
      loops[point] = (loops[point] ?? 0) + 1;
      if (loops[point] >= 2) escalate(point, 'loop-limit', h.blockers, h.role);
      else actions.push('ask:more-evidence');
      continue;
    }
    if (h.diagnosis?.status === 'known') diagSeverity = h.diagnosis.severity ?? null;
    if (fix && String(h.step) === '4') {
      const files = h.paths_written.filter(isSource).length;
      if (files > FIX_MAX_FILES || h.blockers.some((b) => b.owner === 'Architect')) {
        actions.push('promote:full-flow');
        outcome = 'promoted';
        trigger = files > FIX_MAX_FILES ? 'too-many-files' : 'architect-blocker';
        break;
      }
    }

    // 2c. a reviewer's needs_validation item (V-n) open in REPEAT_LIMIT consecutive reviews, Approve or Reject, escalates like a repeated blocker
    const vOpen = new Map((h.needs_validation ?? []).map((v) => [v.id, v]));
    const vStreaks = (vstreak[point] ??= {});
    for (const id of Object.keys(vStreaks)) if (!vOpen.has(id)) delete vStreaks[id];
    for (const id of vOpen.keys()) vStreaks[id] = (vStreaks[id] ?? 0) + 1;
    const vRepeated = [...vOpen.values()].filter((v) => vStreaks[v.id] >= REPEAT_LIMIT);
    if (vRepeated.length) {
      escalate(point, 'repeated-blocker', vRepeated.map((v) => ({ id: v.id, problem: v.question })), vRepeated[0].owner);
      continue;
    }

    // 3. verdict handling
    if (REJECTING.has(h.verdict)) {
      loops[point] = (loops[point] ?? 0) + 1;
      const ids = new Set(h.blockers.map((b) => b.id));
      const streaks = (streak[point] ??= {});
      for (const id of Object.keys(streaks)) if (!ids.has(id)) delete streaks[id];
      for (const id of ids) streaks[id] = (streaks[id] ?? 0) + 1;
      const repeated = [...ids].filter((id) => streaks[id] >= REPEAT_LIMIT);
      if (repeated.length) {
        escalate(point, 'repeated-blocker', h.blockers.filter((b) => repeated.includes(b.id)), h.blockers[0].owner);
      } else if (loops[point] > LOOP_LIMIT) {
        escalate(point, 'loop-limit', h.blockers, h.blockers[0].owner);
      } else {
        actions.push(`fix:${[...new Set(h.blockers.map((b) => b.owner))].sort().join('+')}`);
      }
      continue;
    }

    passed.add(h.step);
    actions.push('accept');
  }

  if (outcome === 'in-progress') outcome = 'completed';
  if (escalation) {
    const e = validate(escalationSchema, escalation);
    if (e.length) violations.push(...e.map((x) => `escalation report invalid: ${x}`));
  }
  return { actions, loops, outcome, trigger, violations, escalation };
}

/* ---------- effort tiers (token-discipline.md) ---------- */

export const LEVELS = ['low', 'medium', 'high'];
export const PROTECTED_ROLES = ['code-reviewer', 'architect', 'devops', 'auditor']; // never below their default in production mode
export const STALLED_AFTER = 2; // same blocker id open in this many consecutive rejections counts as stalled

// Agent definitions sit at <root>/agents/ in this repo and at .claude/agents/ once installed: three levels up either way.
export const defaultEffort = (role) =>
  readFileSync(join(here, '..', '..', '..', 'agents', `${role}.md`), 'utf8').match(/^effort:\s*(\S+)/m)?.[1];

// signals: { highImpact, assumedAc, exactFix, stalledRounds }  (all optional)
//   highImpact    contract.md touches auth, payments, data migrations or secrets
//   assumedAc     ac.md / requirements.md carries [assumed] items
//   exactFix      every open bug names file + line + expected fix (read from handoff blockers)
//   stalledRounds consecutive rejections the same blocker id has been open (checkpoint ## Open blockers)
export function chooseEffort({ role, mode = 'production', signals = {} }) {
  const base = defaultEffort(role);
  const idx = LEVELS.indexOf(base);
  if (idx < 0) throw new Error(`no valid effort in agents/${role}.md`);
  const protectedRole = mode === 'production' && PROTECTED_ROLES.includes(role);

  if (signals.highImpact) return { effort: 'high', base, reason: 'high-impact' };

  const up = (signals.assumedAc ? 1 : 0) + ((signals.stalledRounds ?? 0) >= STALLED_AFTER ? 1 : 0);
  const down = signals.exactFix ? 1 : 0;
  let net = Math.max(-1, Math.min(1, up - down)); // net move is at most one level
  if (protectedRole && net < 0) net = 0;
  const effort = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx + net))];
  return { effort, base, reason: net === 0 ? 'default' : net > 0 ? 'raised' : 'lowered' };
}

/* ---------- model and effort for one spawn, read from the task's files (token-discipline.md) ---------- */

export const MODELS = ['haiku', 'sonnet']; // never opus or fable ...
export const OPUS_ROLES = ['auditor']; // ... except the auditor, which runs on a different model from the debugger it audits (token-discipline.md)
export const ROLE_OWNER = { 'frontend-dev': 'FE', 'backend-dev': 'BE', 'docs-writer': 'Docs', devops: 'Devops', architect: 'Architect', designer: 'Designer', 'product-manager': 'PM', researcher: 'Researcher' };
export const HIGH_IMPACT = /\b(auth\w*|login|password|oauth|jwt|payments?|billing|stripe|migrations?|secrets?|api[ _-]?keys?|credentials?)\b/i;
const defaultModel = (role) =>
  readFileSync(join(here, '..', '..', '..', 'agents', `${role}.md`), 'utf8').match(/^model:\s*(\S+)/m)?.[1];
const readIf = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const section = (md, name) => md.replace(/\r\n/g, '\n').split(/^## /m).find((s) => s.startsWith(`${name}\n`))?.slice(name.length + 1) ?? '';

// Reads only files the run already keeps; every signal can be forced with `force` (true/false) when the files say too little.
//   teamDir  .team/<task> (in the feature worktree)   brain  <brain> folder (for project.md ## Lessons)
//   flags    { rerunOnly, minimalResearch, lineKnown } — the haiku cases that no file records
export function spawnProfile({ role, step, round = 1, teamDir, brain, mode = 'production', flags = {}, force = {} }) {
  const contract = [readIf(join(teamDir, 'contract.md')), ...listMd(join(teamDir, 'contract'))].join('\n');
  const ac = readIf(join(teamDir, 'ac.md')) + readIf(join(teamDir, 'requirements.md'));
  const checkpoint = readIf(join(teamDir, 'checkpoint.md'));
  const owner = ROLE_OWNER[role];

  // stalled: the open blocker id that the most ## History lines name
  const open = [...section(checkpoint, 'Open blockers').matchAll(/\b([BV]-\d+)\b/g)].map((m) => m[1]);
  const history = section(checkpoint, 'History').split('\n');
  const stalledRounds = Math.max(0, ...open.map((id) => history.filter((l) => new RegExp(`\\b${id}\\b`).test(l)).length));

  // exact fix: round 2+, and every blocker the latest review/QA hand-off gives this role names file:line
  let exactFix = false;
  if (Number(round) > 1 && owner) {
    const latest = listJson(join(teamDir, 'handoff'))
      .filter((h) => ['6', '7'].includes(String(h.step)) && Array.isArray(h.blockers))
      .sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || Number(a.step) - Number(b.step)).at(-1);
    const mine = latest?.blockers.filter((b) => b.owner === owner) ?? [];
    exactFix = mine.length > 0 && mine.every((b) => /:\d+/.test(b.file ?? '') && (b.problem ?? '').trim().length > 0);
  }
  if (role === 'qa-tester' && flags.rerunOnly) exactFix = true;

  const signals = {
    highImpact: force.highImpact ?? HIGH_IMPACT.test(contract),
    assumedAc: force.assumedAc ?? /\[assumed\]/i.test(ac),
    exactFix: force.exactFix ?? exactFix,
    stalledRounds: force.stalledRounds ?? stalledRounds,
  };
  const { effort, base, reason } = chooseEffort({ role, mode, signals });

  // model: the frontmatter default, moved down to haiku only in the listed cases, and never if project.md records haiku failing for this role
  const baseModel = defaultModel(role);
  const fe_be = role === 'frontend-dev' || role === 'backend-dev';
  const debugger4a = role === 'debugger';
  const haikuCase =
    (fe_be && signals.exactFix && Number(round) > 1) ? 'exact fix round'
    : (debugger4a && String(step) === '4a' && flags.lineKnown) ? 'diagnose with file and line known'
    : (role === 'qa-tester' && flags.rerunOnly) ? 're-running existing tests'
    : (role === 'researcher' && flags.minimalResearch) ? 'codebase-only research'
    : null;
  const lessons = brain ? section(readIf(join(brain, 'project.md')), 'Lessons') : '';
  const haikuFailed = lessons.split('\n').some((l) => l.includes(role) && /haiku/i.test(l) && /fail|rerun|re-run|retry|wrong|miss/i.test(l));
  const protectedRole = mode === 'production' && PROTECTED_ROLES.includes(role);
  let model = MODELS.includes(baseModel) || (OPUS_ROLES.includes(role) && baseModel === 'opus') ? baseModel : 'sonnet';
  let modelReason = 'default';
  if (haikuCase && !protectedRole) {
    if (haikuFailed) modelReason = `kept ${model}: project.md Lessons records haiku failing for ${role}`;
    else { model = 'haiku'; modelReason = haikuCase; }
  }

  const used = Object.entries(signals).filter(([k, v]) => (k === 'stalledRounds' ? v >= STALLED_AFTER : v)).map(([k, v]) => (k === 'stalledRounds' ? `stalled ${v}` : k));
  const runProfileLine = reason === 'default' && modelReason === 'default' ? null : `${step}:${role} r${round} · effort ${effort} (${reason}${used.length ? `: ${used.join(', ')}` : ''}) · model ${model}${modelReason === 'default' ? '' : ` (${modelReason})`}`;
  return { model, effort, base: { model: baseModel, effort: base }, signals, reason, modelReason, runProfileLine };
}

function listMd(dir) { try { return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => readIf(join(dir, f))); } catch { return []; } }
function listJson(dir) {
  try { return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => { try { return JSON.parse(readIf(join(dir, f))); } catch { return null; } }).filter(Boolean); } catch { return []; }
}

/* ---------- fix and lite triage (fix-profile.md, lite-profile.md) ---------- */

// A request is a fix only if every condition holds; otherwise it runs the full flow.
export function triage(s = {}) {
  const reasons = [];
  if (s.trivial_one_line === true) return { lane: 'none', reasons: ['trivial one-line edit with no behaviour risk: main session'] };
  if (s.has_symptom !== true || (s.has_location !== true && s.has_repro !== true)) return { lane: 'ask', reasons: ['no symptom, or no location and no repro: ask before triage'] };
  if (s.changes_contract === true) reasons.push('changes API shape, schema, auth, a dependency, the stack or devops-owned files');
  if (s.adds_new_ui === true) reasons.push('adds a new screen, flow or component');
  if ((s.expected_source_files ?? 1) > FIX_MAX_FILES) reasons.push(`expected to touch more than ${FIX_MAX_FILES} source files`);
  return reasons.length ? { lane: 'full', reasons } : { lane: 'fix', reasons: [] };
}

// Internal work that is not a bug fix.
export function triageLite(s = {}) {
  if (s.has_goal !== true || s.has_area !== true) return { lane: 'ask', reasons: ['no goal or no named area: ask before triage'] };
  if (s.kind === 'perf' && s.has_measurement !== true) return { lane: 'ask', reasons: ['performance work with no measured before-number: ask first'] };
  const reasons = [];
  if (s.user_visible === true) reasons.push('changes what a user sees or does');
  if (s.outside_consumers === true) reasons.push('changes an API with consumers outside this repo');
  if (s.adds_dependency === true) reasons.push('adds a dependency, provider, runtime or stack change, or touches devops-owned files');
  if (s.changes_auth === true) reasons.push('changes auth, permissions or personal data');
  if (s.irreversible_migration === true) reasons.push('a migration that drops data or has no down path');
  if ((s.expected_source_files ?? 1) > LITE_MAX_FILES) reasons.push(`expected to touch more than ${LITE_MAX_FILES} source files`);
  return reasons.length ? { lane: 'full', reasons } : { lane: 'lite', reasons: [] };
}

/* ---------- baseline before a run (setup.md step 3, baseline-freshness.md, onboard.md → Depth) ---------- */

// What setup does about docs/architecture/baseline.md before the lane starts. The user is asked only when there is no usable
// baseline (once, with the depth the lane needs) or when it is red; yellow is refreshed without a question.
//   colour: check-baseline.mjs --json `baseline` (green | yellow | red | missing); depth: its `depth` (quick | full)
export function baselineAction({ colour, depth, hasCode = true, lane = 'feature' } = {}) {
  const need = LANES[lane]?.baseline ?? 'full';
  if (!hasCode) return { next: 'continue', reason: 'no source files: nothing to onboard' };
  if (colour === 'missing') return { next: `ask:onboard-${need}`, reason: `no baseline; the ${lane} lane needs a ${need} one` };
  if (depth === 'quick' && need === 'full') return { next: 'ask:onboard-full', reason: `the baseline is quick; the ${lane} lane needs a full one` };
  if (colour === 'green') return { next: 'continue', reason: 'baseline green' };
  if (colour === 'yellow') return { next: 'refresh:silent', reason: 'baseline yellow: refresh from the delta, no question' };
  if (colour === 'red') return { next: 'ask:red', reason: 'baseline red: refresh now or continue with the code as the only truth' };
  throw new Error(`baselineAction: unknown colour ${colour}`);
}

/* ---------- CLI ---------- */

const SMOKE_FLAGS = {
  '--runtime-changed': 'runtime_or_dependency_changed',
  '--devops-files-changed': 'devops_files_changed',
  '--no-passing-smoke': 'no_passing_smoke_on_record',
};

function usage(msg) {
  if (msg) console.error(msg);
  console.error('usage: next-action.mjs loop <handoff...> | effort --role <role> | smoke [flags] | triage fix|lite <json> | baseline --lane <lane> [--repo .] [--no-code] | plan-card <lane> [--scope s] [--until step] [--skip a,b] [--lang th|en]');
  process.exit(2);
}

// Steps a lane skips by definition (lanes.mjs); --skip adds the run's own skips on top. Redesign skips depend on the scope: skipsOf().
export const LANE_SKIPS = { fix: skipsOf('fix'), lite: skipsOf('lite') };

const opt = (args, name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

function handoffFiles(paths) {
  const files = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) {
      files.push(...readdirSync(p).filter((f) => f.endsWith('.json')).map((f) => join(p, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs));
    } else files.push(p);
  }
  return files;
}

function runLoop(args) {
  const valued = new Set(['--profile', '--scope', '--skip', '--smoke', '--task', '--escalation-out']);
  const paths = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
  if (!paths.length) usage('loop: give at least one hand-off file or directory');
  const events = handoffFiles(paths).map((f) => {
    try { return { handoff: JSON.parse(readFileSync(f, 'utf8')), file: f }; } catch { return { handoff: null, file: f }; }
  });
  const smoke = Object.fromEntries((opt(args, '--smoke') ?? '').split(',').filter(Boolean).map((k) => [k, true]));
  const profile = opt(args, '--profile');
  const out = simulate({
    task: opt(args, '--task'),
    profile,
    skip: [...skipsOf(profile, opt(args, '--scope')), ...(opt(args, '--skip') ?? '').split(',').filter(Boolean)],
    smoke_signals: smoke,
    events,
  });
  const next = out.violations.length && out.outcome === 'invalid-profile' ? 'fix-run-profile' : out.actions.at(-1) ?? 'none';
  console.log(`next=${next} outcome=${out.outcome}${out.trigger ? ` trigger=${out.trigger}` : ''} handoffs=${events.length}`);
  const counters = Object.entries(out.loops).map(([p, n]) => `${p}=${n}/${LOOP_LIMIT}`);
  if (counters.length) console.log(`loop counters: ${counters.join(' ')}`);
  for (const v of out.violations) console.log(`violation: ${v}`);
  const escOut = opt(args, '--escalation-out');
  if (out.escalation && escOut) {
    writeFileSync(resolve(escOut), JSON.stringify(out.escalation, null, 2) + '\n');
    console.log(`escalation draft: ${escOut} (add the recommendation and attempts, then validate)`);
  }
  return ['escalated', 'blocked', 'invalid-profile'].includes(out.outcome) ? 1 : 0;
}

function runEffort(args) {
  const role = opt(args, '--role');
  if (!role) usage('effort: --role is required');
  const out = chooseEffort({
    role,
    mode: opt(args, '--mode') ?? 'production',
    signals: {
      highImpact: args.includes('--high-impact'),
      assumedAc: args.includes('--assumed'),
      exactFix: args.includes('--exact-fix'),
      stalledRounds: Number(opt(args, '--stalled') ?? 0),
    },
  });
  console.log(`next=effort:${out.effort} base=${out.base} reason=${out.reason}`);
  return 0;
}

function runSmoke(args) {
  const signals = Object.fromEntries(Object.entries(SMOKE_FLAGS).map(([f, k]) => [k, args.includes(f)]));
  const out = smokeRequired(signals);
  console.log(out.required ? `next=run-3d reasons=${out.reasons.join(',')}` : 'next=skip-3d reason=no-trigger (record "3d skipped: no trigger" in tasks/<task>.md)');
  return 0;
}

function runBaseline(args) {
  const lane = opt(args, '--lane') ?? 'feature';
  if (!LANES[lane]) usage(`baseline: unknown lane ${lane}`);
  const repo = opt(args, '--repo') ?? '.';
  const r = spawnSync(process.execPath, [join(here, 'check-baseline.mjs'), repo, '--json'], { encoding: 'utf8' });
  let facts;
  try { facts = JSON.parse(r.stdout); } catch { usage(`baseline: check-baseline.mjs gave no JSON: ${r.stderr.trim()}`); }
  const out = baselineAction({ colour: facts.baseline, depth: facts.depth, hasCode: !args.includes('--no-code'), lane });
  console.log(`next=${out.next} baseline=${facts.baseline}${facts.depth ? ` depth=${facts.depth}` : ''} lane=${lane}`);
  console.log(`reason: ${out.reason}`);
  for (const x of facts.reasons ?? []) console.log(`- ${x}`);
  return 0;
}

function runPlanCard(args) {
  const lane = args[0];
  if (!LANES[lane]) usage(`plan-card: give a lane (${Object.keys(LANES).join(', ')})`);
  const lines = planCard(lane, { scope: opt(args, '--scope'), until: opt(args, '--until'), skip: (opt(args, '--skip') ?? '').split(',').filter(Boolean), lang: opt(args, '--lang') ?? 'th' });
  for (const l of lines) console.log(l);
  return 0;
}

function runTriage(args) {
  const [lane, json] = args;
  if (!['fix', 'lite'].includes(lane) || !json) usage('triage: fix|lite and a signals JSON object');
  let s;
  try { s = JSON.parse(json); } catch (e) { usage(`triage: bad JSON: ${e.message}`); }
  const out = lane === 'fix' ? triage(s) : triageLite(s);
  console.log(`next=lane:${out.lane}`);
  for (const r of out.reasons) console.log(`reason: ${r}`);
  return 0;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  const run = { loop: runLoop, effort: runEffort, smoke: runSmoke, triage: runTriage, baseline: runBaseline, 'plan-card': runPlanCard }[cmd];
  if (!run) usage(cmd ? `unknown command: ${cmd}` : undefined);
  try { process.exit(run(args)); } catch (e) { console.error(`next-action: ${e.message}`); process.exit(2); }
}
