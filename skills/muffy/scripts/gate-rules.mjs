// Human gates the Orchestrator may not skip (references/step-details.md 2b and 3c, references/run-profile.md).
// One rule set for three callers, so they cannot drift:
//   guard-gates.mjs   PreToolUse on Agent|Task: blocks a spawn whose step is past an open gate
//   check-all.mjs     after a step: a hand-off past an open gate is an error
//   checkpoint.mjs gate   records the user's answer (the only writer of the gate lines in ## Status)
// A gate is passed when ## Status has `gate <id> passed`, or skipped when it has `gate <id> skipped`. Other lines
// that name the gate (`not passed`, `rejected`) do not count. The feature and redesign lanes have gates: fix and lite skip them.
export const GATES = ['2b', '3c'];
export const PAUSE_OF = { '2b': 'plan-review', '3c': 'design-review' };

// the subagents muffy spawns (agents/*.md); guard-gates.mjs fails closed for these when a prompt has no Task header
export const MUFFY_ROLES = new Set(['architect', 'auditor', 'backend-dev', 'code-reviewer', 'debugger', 'designer', 'devops', 'diagrammer', 'docs-writer', 'frontend-dev', 'product-manager', 'qa-tester', 'researcher']);
// roles that run before any gate (steps 0-2)
const BEFORE_GATES = new Set(['product-manager', 'researcher', 'presenter']);
// roles that run only after the design gate (step 4 on, and the code review of step 6)
const AFTER_DESIGN = new Set(['backend-dev', 'frontend-dev', 'code-reviewer', 'qa-tester', 'docs-writer']);
// a step's hand-off needs these gates first (step numbers from references/steps.md)
const STEP_NEEDS = {
  '3': ['2b'], '3b': ['2b'], '3e': ['2b'], '3c': ['2b'],
  '3d': ['2b', '3c'], '4': ['2b', '3c'], '4a': ['2b', '3c'], '5': ['2b', '3c'], '5b': ['2b', '3c'],
  '6': ['2b', '3c'], '7': ['2b', '3c'], '8': ['2b', '3c'], '9': ['2b', '3c'], '10': ['2b', '3c'], '11': ['2b', '3c'], '12': ['2b', '3c'],
};

const norm = (text) => String(text ?? '').replace(/\r\n/g, '\n');
export const section = (text, name) => norm(text).match(new RegExp(`^## ${name}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))?.[1] ?? null;

// feature unless the Run profile names the fix, lite or redesign lane
export function laneOf(cpText) {
  const rp = section(cpText, 'Run profile') ?? '';
  if (/\bredesign lane\b|\/muffy redesign\b/i.test(rp)) return 'redesign';
  if (/\bfix lane\b|\/muffy fix\b/i.test(rp)) return 'fix';
  if (/\blite lane\b|\/muffy lite\b/i.test(rp)) return 'lite';
  return 'feature';
}

// redesign lane scope the user picked at pause:scope, written in the Run profile as `redesign lane (ui-only | ui+logic | logic-only)`
export function redesignScope(cpText) {
  return (section(cpText, 'Run profile') ?? '').match(/redesign lane \((ui-only|ui\+logic|logic-only)\)/i)?.[1]?.toLowerCase() ?? null;
}

export function gateState(cpText, gate) {
  const status = section(cpText, 'Status') ?? '';
  // the latest line about the gate decides: a rejection, then a later approval, is passed
  const lines = norm(status).split('\n').filter((l) => new RegExp(`\\b${gate}\\b`).test(l)).reverse();
  for (const l of lines) {
    if (/\bnot passed\b|\brejected\b/i.test(l)) return 'open';
    if (/\bpassed\b/i.test(l)) return 'passed';
    if (/\bskipped\b/i.test(l)) return 'skipped';
  }
  return 'open';
}

// the gates a spawn of `role` needs before it may start (prompt tells devops mode 2 from mode 1)
export function gatesForSpawn(role, prompt = '', lane = 'feature') {
  if (!['feature', 'redesign'].includes(lane) || BEFORE_GATES.has(role)) return [];
  const needs = ['2b'];
  if (AFTER_DESIGN.has(role) || (role === 'devops' && /\bmode\s*2\b/i.test(prompt))) needs.push('3c');
  return needs;
}

// fix lane: step 4 (a dev's fix) needs the auditor's `confirm` at 4b, or the user's accepted risk recorded in ## Status.
// The step comes from the hand-off path in the prompt's Write: line (make-envelope.mjs adds handoff/<step>-<role>-r<round>.json).
// `handoffs` is the task's hand-offs as parsed JSON, in any order; returns the reason a spawn is refused, or null.
const DEV_STEP4 = /handoff[\\/]4-(?:frontend|backend)-dev-r\d+\.json/;
export function auditMissing(cpText, role, prompt = '', handoffs = []) {
  if (!['frontend-dev', 'backend-dev'].includes(role) || !DEV_STEP4.test(prompt)) return null;
  if (cpText === null || laneOf(cpText) !== 'fix') return null;
  if (/\baudit 4b\b[^\n]*\brisk accepted\b/i.test(section(cpText, 'Status') ?? '')) return null;
  const latest = handoffs.filter((h) => h?.step === '4b').sort((a, b) => (a.round ?? 0) - (b.round ?? 0)).at(-1);
  if (latest?.audit?.verdict === 'confirm') return null;
  return `the fix lane needs the auditor's \`confirm\` at step 4b before step 4 (latest audit: ${latest?.audit?.verdict ?? 'none'}); on a reject the user may accept the risk, recorded as \`audit 4b: risk accepted\` in checkpoint ## Status`;
}

// gates still open for this spawn; a null checkpoint means setup has not written one, so every gate is open
export function missingGates(cpText, role, prompt = '') {
  const lane = cpText === null ? 'feature' : laneOf(cpText);
  return gatesForSpawn(role, prompt, lane).filter((g) => cpText === null || gateState(cpText, g) === 'open');
}

// post-hoc: the steps of the hand-offs so far against the gates in the checkpoint
export function gateErrors(cpText, steps, { designExists = false, lane } = {}) {
  const l = lane ?? (cpText === null ? 'feature' : laneOf(cpText));
  if (!['feature', 'redesign'].includes(l)) return [];
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
