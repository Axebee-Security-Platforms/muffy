// Deterministic model of the Orchestrator rules in skills/muffy/references/loops.md.
// Feed it the hand-offs a scenario scripts; it returns the actions the Orchestrator must take.
// If you change a rule in loops.md, change it here and in evals/mock-scenarios/*.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validate } from '../../skills/muffy/scripts/schema.mjs';
import { smokeRequired } from './smoke-sim.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const handoffSchema = JSON.parse(readFileSync(join(root, 'skills/muffy/schemas/handoff.schema.json'), 'utf8'));
const escalationSchema = JSON.parse(readFileSync(join(root, 'skills/muffy/schemas/escalation.schema.json'), 'utf8'));

export const LOOP_LIMIT = 3; // fix loops allowed per loop point; the 4th rejection escalates
export const REPEAT_LIMIT = 3; // same blocker id open in this many consecutive rejections = fix is not converging
export const GATED_STEPS = ['3c', '3d']; // must pass before step 4; 3c passes only after the user approves the design (pause:design-review)
export const NEVER_SKIP = ['6', '7', '9', '10'];
export const FIX_NEVER_SKIP = ['4a']; // fix lane (references/fix-profile.md): diagnose before any code
export const FIX_MAX_FILES = 5; // source files (tests and .team/ excluded) before a fix is promoted to the full flow
export const LITE_MAX_FILES = 15; // same count for the lite lane (references/lite-profile.md)
const isSource = (p) => !/(^|[\\/])\.team[\\/]/.test(p) && !/(^|[\\/])(tests?|__tests__)[\\/]|\.(test|spec)\.[a-z]+$/i.test(p);

const REJECTING = new Set(['Reject', 'Fail']);

export function simulate(scenario) {
  const actions = [];
  const loops = {}; // point -> rejections so far
  const streak = {}; // point -> { blocker id -> consecutive rejections it has been open }
  const retries = {}; // point -> invalid / not-ready retries used this round
  const passed = new Set();
  const skipped = new Set(scenario.skip ?? []);
  let outcome = 'in-progress';
  let trigger = null;
  let escalation = null;
  const fix = scenario.profile === 'fix';

  const violations = NEVER_SKIP.filter((s) => skipped.has(s)).map((s) => `never-skip step ${s} was skipped`);
  if (fix) violations.push(...FIX_NEVER_SKIP.filter((s) => skipped.has(s)).map((s) => `fix lane: step ${s} was skipped`));
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
    if (fix && String(h.step) === '4') {
      const files = h.paths_written.filter(isSource).length;
      if (files > FIX_MAX_FILES || h.blockers.some((b) => b.owner === 'Architect')) {
        actions.push('promote:full-flow');
        outcome = 'promoted';
        trigger = files > FIX_MAX_FILES ? 'too-many-files' : 'architect-blocker';
        break;
      }
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
