// Human gates the Orchestrator may not skip (references/step-details.md 2b and 3c, references/run-profile.md).
// One rule set for three callers, so they cannot drift:
//   guard-gates.mjs   PreToolUse on Agent|Task: blocks a spawn whose step is past an open gate
//   check-all.mjs     after a step: a hand-off past an open gate is an error
//   checkpoint.mjs gate   records the user's answer (the only writer of the gate lines in ## Status)
// A gate is passed when ## Status has `gate <id> passed`, or skipped when it has `gate <id> skipped`. Other lines
// that name the gate (`not passed`, `rejected`) do not count. Which lanes are gated, and which gates a step needs, come from lanes.mjs.
import { GATES, STEP_NEEDS, STEP_ORDER, laneSpec, skipsOf, parseRunProfile } from './lanes.mjs';

export { GATES };
export const PAUSE_OF = { '2b': 'plan-review', '3c': 'design-review' };

// the subagents muffy spawns (agents/*.md); guard-gates.mjs fails closed for these when a prompt has no Task header
export const MUFFY_ROLES = new Set(['architect', 'auditor', 'backend-dev', 'code-reviewer', 'debugger', 'designer', 'devops', 'diagrammer', 'docs-writer', 'frontend-dev', 'product-manager', 'qa-tester', 'researcher']);
// roles that run before any gate (steps 0-2)
const BEFORE_GATES = new Set(['product-manager', 'researcher', 'presenter']);
// roles that run only after the design gate (step 4 on, and the code review of step 6)
const AFTER_DESIGN = new Set(['backend-dev', 'frontend-dev', 'code-reviewer', 'qa-tester', 'docs-writer']);
const gated = (lane, scope) => laneSpec(lane, scope)?.gated === true;

const norm = (text) => String(text ?? '').replace(/\r\n/g, '\n');
export const section = (text, name) => norm(text).match(new RegExp(`^## ${name}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))?.[1] ?? null;

// feature unless the Run profile names the fix or change lane (lanes.mjs parseRunProfile; lite and redesign read as change)
export const laneOf = (cpText) => parseRunProfile(cpText).lane;

// the change lane's scope the user picked at pause:scope (internal | ui-only | ui+logic | logic-only), or null
export const changeScope = (cpText) => {
  const { lane, scope } = parseRunProfile(cpText);
  return lane === 'change' ? scope : null;
};
// a visible change scope (ui-only | ui+logic | logic-only), or null: the scopes the redesign lane had
export const redesignScope = (cpText) => {
  const scope = changeScope(cpText);
  return scope === 'internal' ? null : scope;
};

export function gateState(cpText, gate) {
  const status = section(cpText, 'Status') ?? '';
  // the latest line about the gate decides: a rejection, then a later approval, is passed. A line recorded for another gate
  // (`gate 2b skipped · … approved at 3c`) is that gate's, whatever its free text names
  const own = (l) => { const id = l.match(/\bgate\s+(2b|3c)\b/i)?.[1]; return !id || id.toLowerCase() === gate; };
  const lines = norm(status).split('\n').filter((l) => new RegExp(`\\b${gate}\\b`).test(l) && own(l)).reverse();
  for (const l of lines) {
    if (/\bnot passed\b|\brejected\b/i.test(l)) return 'open';
    if (/\bpassed\b/i.test(l)) return 'passed';
    if (/\bskipped\b/i.test(l)) return 'skipped';
  }
  return 'open';
}

// the gates a spawn of `role` needs before it may start (prompt tells devops mode 2 from mode 1)
export function gatesForSpawn(role, prompt = '', lane = 'feature', scope = null) {
  if (!gated(lane, scope) || BEFORE_GATES.has(role)) return [];
  const needs = ['2b'];
  if (AFTER_DESIGN.has(role) || (role === 'devops' && /\bmode\s*2\b/i.test(prompt))) needs.push('3c');
  return needs;
}

// fix lane: step 4 (a dev's fix) needs the auditor's `confirm` at 4b, or the user's accepted risk recorded in ## Status.
// A cosmetic fix (`lane: fix (cosmetic)`) skips 4b while its 4a diagnosis says severity low; above that it is a bug and needs the audit.
// The step comes from the hand-off path in the prompt's Write: line (make-envelope.mjs adds handoff/<step>-<role>-r<round>.json).
// `handoffs` is the task's hand-offs as parsed JSON, in any order; returns the reason a spawn is refused, or null.
const DEV_STEP4 = /handoff[\\/]4-(?:frontend|backend)-dev-r\d+\.json/;
export function auditMissing(cpText, role, prompt = '', handoffs = []) {
  if (!['frontend-dev', 'backend-dev'].includes(role) || !DEV_STEP4.test(prompt)) return null;
  if (cpText === null) return null;
  const run = parseRunProfile(cpText);
  if (run.until && STEP_ORDER.indexOf('4') > STEP_ORDER.indexOf(run.until)) return `this run stops at step ${run.until} (lane line \`until ${run.until}\`): close it per closing.md "Stopped at a stop point", or switch the lane with checkpoint.mjs profile to go on`;
  if (run.lane !== 'fix') return null;
  if (/\baudit 4b\b[^\n]*\brisk accepted\b/i.test(section(cpText, 'Status') ?? '')) return null;
  const byRound = (step) => handoffs.filter((h) => h?.step === step).sort((a, b) => (a.round ?? 0) - (b.round ?? 0)).at(-1);
  const severity = byRound('4a')?.diagnosis?.severity;
  const cosmetic = skipsOf(run.lane, run.scope).includes('4b');
  if (cosmetic && (!severity || severity === 'low')) return null;
  if (byRound('4b')?.audit?.verdict === 'confirm') return null;
  if (cosmetic) return `a cosmetic fix skips the 4b audit only on a low-severity diagnosis; 4a says ${severity}, so it is a bug: switch with \`checkpoint.mjs profile <dir> fix --scope bug\` and run the auditor`;
  return `the fix lane needs the auditor's \`confirm\` at step 4b before step 4 (latest audit: ${byRound('4b')?.audit?.verdict ?? 'none'}); on a reject the user may accept the risk, recorded as \`audit 4b: risk accepted\` in checkpoint ## Status`;
}

// gates still open for this spawn; a null checkpoint means setup has not written one, so every gate is open
export function missingGates(cpText, role, prompt = '') {
  const run = cpText === null ? { lane: 'feature', scope: null } : parseRunProfile(cpText);
  return gatesForSpawn(role, prompt, run.lane, run.scope).filter((g) => cpText === null || gateState(cpText, g) === 'open');
}

// post-hoc: the steps of the hand-offs so far against the gates in the checkpoint
export function gateErrors(cpText, steps, { designExists = false, lane, scope } = {}) {
  const run = cpText === null ? { lane: 'feature', scope: null } : parseRunProfile(cpText);
  if (!gated(lane ?? run.lane, scope ?? run.scope)) return [];
  const errs = [];
  for (const step of [...new Set(steps.map(String))]) {
    for (const g of STEP_NEEDS[step] ?? []) {
      if (cpText === null || gateState(cpText, g) === 'open') {
        errs.push(`gate ${g} not passed: step ${step} has a hand-off (the user answers pause:${PAUSE_OF[g]} first; checkpoint.mjs gate records it)`);
      }
    }
  }
  if (designExists && cpText !== null && gateState(cpText, '3c') === 'skipped') {
    errs.push('gate 3c is recorded as skipped but design.md exists: the design gate cannot be skipped once a designer ran');
  }
  return errs;
}
