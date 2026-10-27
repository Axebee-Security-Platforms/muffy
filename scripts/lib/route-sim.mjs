// Deterministic model of the decision order in skills/muffy/references/route.md.
// Signals are what the Orchestrator reads from the prompt; reading them is the model's job, this file checks
// that the order and the route table agree. If you change the order there, change it here and in
// evals/route-scenarios.json.
import { triage, triageLite } from '../../skills/muffy/scripts/next-action.mjs';

export const MODES = ['todo', 'onboard', 'present', 'diagram'];
// Routes whose outcome is not a code change (decision order steps 4 and 5).
export const NON_CODE_ROUTES = ['research', 'plan', 'design', 'design-review', 'spec', 'arch-review', 'adr', 'review', 'qa', 'docs', 'docs-existing', 'ops'];
// diagram.md "Kinds": the route a diagram of something not designed yet goes to, by kind.
export const NOT_DESIGNED_ROUTE = { architecture: 'spec', deployment: 'spec', erd: 'spec', state: 'spec', flow: 'spec', screenmap: 'design', gantt: 'plan', 'story-map': 'plan' };
export const ROUTES = ['resume', ...MODES, 'diagram-in-task', 'none', ...NON_CODE_ROUTES, 'fix', 'lite', 'redesign', 'full', 'ask'];

// s: { resume, command, mode, kind, open_task, not_designed, question, deploy, stop_point, outcome, ambiguous, missing_intake, text_only, bug, internal, change_existing, new_capability, fix: {...}, lite: {...} }
export function route(s = {}) {
  if (s.resume === true) return { route: 'resume', step: 1 };
  // `/muffy feature <request>`: the requester forced the full flow; only this decision is skipped, intake and gates still run
  if (s.command === 'feature') return { route: 'full', step: 2 };
  // `/muffy redesign <request>`: the lane is forced; its scope question (UI only, UI + logic, logic only) is still asked inside it
  if (s.command === 'redesign') return { route: 'redesign', step: 2 };
  if (s.mode === 'diagram') {
    // diagram.md "Before the scope question": an open task takes it; a subject not designed yet is spec work
    if (s.open_task === true) return { route: 'diagram-in-task', step: 2 };
    if (s.not_designed === true) return { route: s.missing_intake === true || !NOT_DESIGNED_ROUTE[s.kind] ? 'ask' : NOT_DESIGNED_ROUTE[s.kind], step: 2 };
  }
  if (s.mode) return { route: MODES.includes(s.mode) ? s.mode : 'ask', step: 2 };
  if (s.question === true) return { route: 'none', step: 3 };
  // the skill never deploys: a deploy or rollback request is answered with the task's Deploy hand-off
  if (s.deploy === true) return { route: 'none', step: 5 };
  if (s.ambiguous === true) return { route: 'ask', step: 7 };
  const target = s.stop_point ?? s.outcome;
  if (target && target !== 'code') {
    if (!NON_CODE_ROUTES.includes(target)) return { route: 'ask', step: 7 };
    return { route: s.missing_intake === true ? 'ask' : target, step: s.stop_point ? 4 : 5 };
  }
  if (s.text_only === true) return { route: 'none', step: 6 };
  if (s.bug === true) {
    const lane = triage(s.fix ?? {}).lane;
    return { route: lane, step: 6 };
  }
  if (s.internal === true) return { route: triageLite(s.lite ?? {}).lane, step: 6 };
  if (s.change_existing === true) return { route: 'redesign', step: 6 };
  // full flow is the last option: only a capability the product lacks reaches it; anything vaguer is asked until one route fits
  if (s.new_capability === true) return { route: 'full', step: 6 };
  return { route: 'ask', step: 7 };
}
