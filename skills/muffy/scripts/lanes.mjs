// The lanes in one table, so the scripts, the evals and the references cannot disagree about which lane a task runs
// or what that lane skips (references/run-profile.md, fix-profile.md, lite-profile.md, redesign-profile.md).
// A task's lane is read back from the first line of its checkpoint `## Run profile`, written by
// `checkpoint.mjs profile` in the form `lane: <id>[ (<scope>)] · skipped <steps>`. Older checkpoints wrote
// `fix: skipped …`, `lite: skipped …`, `redesign lane (<scope>): …` or `fix lane …`; those still parse.
// Change a lane here and in its reference in the same commit: `npm test` compares the two.

// Execution order of the step ids (references/steps.md). 8 and 9 were removed with docs review and staging.
export const STEP_ORDER = ['0', '1', '2', '2b', '3', '3b', '3e', '3c', '3d', '4a', '4b', '4', '5', '5b', '6', '7', '10', '11', '12'];
export const NEVER_SKIP = ['6', '7', '10']; // every lane: review, QA, Human gate
export const GATES = ['2b', '3c']; // human gates; a lane either has both or none
export const SCOPES = ['ui-only', 'ui+logic', 'logic-only']; // redesign only, picked at pause:scope

// skips: step ids the lane skips by definition (a run adds its own, such as 3d with no smoke trigger)
// neverSkip: steps on top of NEVER_SKIP that this lane must run
// gated: 2b and 3c apply (the redesign ui-only scope still skips 2b, recorded with `checkpoint.mjs gate 2b skip`)
// maxFiles: source files (tests and .team/ excluded) before the diff promotes the run to the full flow; null = no limit
// profile: the `Profile:` header the prompt envelope carries (agents load their lane reference on it)
export const LANES = {
  feature: { skips: [], neverSkip: [], gated: true, maxFiles: null, profile: null, ref: 'run-profile.md' },
  fix: { skips: ['1', '2', '2b', '3', '3b', '3c', '3d'], neverSkip: ['4a', '4b'], gated: false, maxFiles: 5, profile: 'fix', ref: 'fix-profile.md' },
  lite: { skips: ['1', '2', '2b', '3b', '3c'], neverSkip: ['3'], gated: false, maxFiles: 15, profile: 'lite', ref: 'lite-profile.md' },
  redesign: {
    skips: ['1'], neverSkip: ['2', '3c', '11'], gated: true, maxFiles: null, profile: null, ref: 'redesign-profile.md',
    scopes: { 'ui-only': { skips: ['1', '2b'] }, 'ui+logic': { skips: ['1'] }, 'logic-only': { skips: ['1', '3b', '3e'] } },
  },
};

const order = (steps) => [...new Set(steps)].sort((a, b) => STEP_ORDER.indexOf(a) - STEP_ORDER.indexOf(b));

// the steps a lane (and scope) skips by definition, in execution order
export function skipsOf(lane, scope) {
  const l = LANES[lane];
  if (!l) return [];
  return order(l.scopes?.[scope]?.skips ?? l.skips);
}

export const neverSkipOf = (lane) => [...NEVER_SKIP, ...(LANES[lane]?.neverSkip ?? [])];

// gates each step's hand-off needs: past 2b needs 2b, past 3c needs 3c too
export const STEP_NEEDS = Object.fromEntries(STEP_ORDER.flatMap((s, i) => {
  const needs = GATES.filter((g) => i > STEP_ORDER.indexOf(g));
  return needs.length ? [[s, needs]] : [];
}));

/* ---------- the Run profile line ---------- */

const norm = (text) => String(text ?? '').replace(/\r\n/g, '\n');
const runProfile = (cpText) => norm(cpText).match(/^## Run profile[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? '';
const scopeOf = (s) => (SCOPES.includes(s?.toLowerCase()) ? s.toLowerCase() : null);

// `lane: fix · skipped 1, 2, 2b, 3, 3b, 3c, 3d` / `lane: redesign (ui-only) · skipped 1, 2b, 3d`
export function formatRunProfile(lane, { scope, skip = [] } = {}) {
  if (!LANES[lane]) throw new Error(`unknown lane: ${lane} (${Object.keys(LANES).join(', ')})`);
  if (lane === 'redesign' && !scopeOf(scope)) throw new Error(`the redesign lane needs a scope (${SCOPES.join(', ')})`);
  if (lane !== 'redesign' && scope) throw new Error(`only the redesign lane takes a scope, not ${lane}`);
  const steps = skip.filter((s) => STEP_ORDER.includes(s));
  const other = skip.filter((s) => !STEP_ORDER.includes(s)); // roles a scope leaves out (designer, architect), kept as written
  const all = [...order([...skipsOf(lane, scopeOf(scope)), ...steps]), ...new Set(other)];
  return `lane: ${lane}${scope ? ` (${scopeOf(scope)})` : ''} · skipped ${all.length ? all.join(', ') : 'none'}`;
}

// lines a lane line may have been written as, newest first; the first match decides
const LEGACY = [
  [/^[-*\s]*redesign lane\s*\(([^)]+)\)/im, 'redesign'],
  [/\bredesign lane\b|\/muffy redesign\b/i, 'redesign'],
  [/^[-*\s]*fix:/im, 'fix'],
  [/^[-*\s]*lite:/im, 'lite'],
  [/\bfix lane\b|\/muffy fix\b/i, 'fix'],
  [/\blite lane\b|\/muffy lite\b/i, 'lite'],
];

// the step ids after `skipped` on the line where a match ends at `end` (roles such as designer are dropped)
const skippedOn = (rp, end) => {
  const line = rp.slice(rp.lastIndexOf('\n', end - 1) + 1).split('\n')[0];
  return (line.match(/\bskipped\b(.*)$/i)?.[1] ?? '').split(/[,\s]+/).filter((s) => STEP_ORDER.includes(s));
};

// { lane, scope, skipped } of a checkpoint; feature when the Run profile names no other lane.
// `skipped` is every step id the lane line lists, so a run's own skip (3d with no smoke trigger) is read back too.
export function parseRunProfile(cpText) {
  const rp = runProfile(cpText);
  const m = rp.match(/^[-*\s]*lane:\s*(\w+)(?:\s*\(([^)]+)\))?/im);
  if (m && LANES[m[1].toLowerCase()]) return { lane: m[1].toLowerCase(), scope: scopeOf(m[2]), skipped: skippedOn(rp, m.index + m[0].length) };
  for (const [re, lane] of LEGACY) {
    const hit = rp.match(re);
    if (hit) return { lane, scope: lane === 'redesign' ? scopeOf(hit[1]) : null, skipped: skippedOn(rp, hit.index + hit[0].length) };
  }
  return { lane: 'feature', scope: null, skipped: [] };
}

// true for a Run profile line that names a lane in any form (checkpoint.mjs profile replaces it)
export const isLaneLine = (line) => /^[-*\s]*lane:\s*\w+/i.test(line) || LEGACY.some(([re]) => re.test(line));
