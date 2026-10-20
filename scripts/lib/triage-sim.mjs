// Deterministic model of the fix-lane triage in skills/muffy/references/fix-profile.md.
// A request is a fix only if every condition holds; otherwise it runs the full flow.
// If you change the triage rules there, change them here and in evals/triage-scenarios.json.
import { FIX_MAX_FILES, LITE_MAX_FILES } from './loop-sim.mjs';

// Lite-lane triage (skills/muffy/references/lite-profile.md), for internal work that is not a bug fix.
// Keep it in step with that doc and evals/lite-triage-scenarios.json.
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

export function triage(s = {}) {
  const reasons = [];
  if (s.trivial_one_line === true) return { lane: 'none', reasons: ['trivial one-line edit with no behaviour risk: main session'] };
  if (s.has_symptom !== true || (s.has_location !== true && s.has_repro !== true)) return { lane: 'ask', reasons: ['no symptom, or no location and no repro: ask before triage'] };
  if (s.changes_contract === true) reasons.push('changes API shape, schema, auth, a dependency, the stack or devops-owned files');
  if (s.adds_new_ui === true) reasons.push('adds a new screen, flow or component');
  if ((s.expected_source_files ?? 1) > FIX_MAX_FILES) reasons.push(`expected to touch more than ${FIX_MAX_FILES} source files`);
  return reasons.length ? { lane: 'full', reasons } : { lane: 'fix', reasons: [] };
}
