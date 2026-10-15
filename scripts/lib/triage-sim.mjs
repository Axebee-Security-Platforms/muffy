// Deterministic model of the fix-lane triage in skills/muffy/references/fix-profile.md.
// A request is a fix only if every condition holds; otherwise it runs the full flow.
// If you change the triage rules there, change them here and in evals/triage-scenarios.json.
import { FIX_MAX_FILES } from './loop-sim.mjs';

export function triage(s = {}) {
  const reasons = [];
  if (s.trivial_one_line === true) return { lane: 'none', reasons: ['trivial one-line edit with no behaviour risk: main session'] };
  if (s.has_symptom !== true || (s.has_location !== true && s.has_repro !== true)) return { lane: 'ask', reasons: ['no symptom, or no location and no repro: ask before triage'] };
  if (s.changes_contract === true) reasons.push('changes API shape, schema, auth, a dependency, the stack or devops-owned files');
  if (s.adds_new_ui === true) reasons.push('adds a new screen, flow or component');
  if ((s.expected_source_files ?? 1) > FIX_MAX_FILES) reasons.push(`expected to touch more than ${FIX_MAX_FILES} source files`);
  return reasons.length ? { lane: 'full', reasons } : { lane: 'fix', reasons: [] };
}
