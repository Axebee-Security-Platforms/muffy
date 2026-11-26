#!/usr/bin/env node
// The decision order of references/route.md as a script. The Orchestrator reads the requester's prompt into typed signals (reading is
// the model's job); this script picks the route, or the one question that cuts the candidates. `npm test` runs every scenario in
// evals/route-scenarios.json through it and checks it against the doc's Routes and Examples tables.
//
//   node route.mjs '<signals json>' [--lang th|en]
//
// Signals (all optional; leave out what the prompt does not say): bare, resume, command (feature | redesign | lite | fix), mode
//   (todo | onboard | present | diagram), kind (a diagram kind), open_task, not_designed, question, deploy, stop_point (a route name, or
//   `diagnose`), outcome (`code` or a route name), ambiguous, missing_intake, text_only, upgrade, bug, internal, change_existing,
//   new_capability, fix: { has_symptom, has_location, has_repro, changes_contract, adds_new_ui, expected_source_files }, lite: { ... }
//   (the keys of `next-action.mjs triage`).
// Prints `next=route:<name> step=<n>` (plus `until=4b` for a stop inside the fix lane), `lane=<fix|change|upgrade|verify|feature>` when the
// route is a lane, and for `ask` the question to put to the requester, in their words, as `question=<id>` and `text=<line>` lines.
// Exit 0 = a route, 1 = ask, 2 = usage error.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { triage, triageLite } from './next-action.mjs';

export const MODES = ['menu', 'todo', 'onboard', 'present', 'diagram'];
// Routes whose outcome is not a code change (decision order steps 4 and 5).
export const NON_CODE_ROUTES = ['research', 'plan', 'design', 'design-review', 'spec', 'arch-review', 'adr', 'review', 'qa', 'verify', 'docs', 'docs-existing', 'ops'];
// diagram.md "Kinds": the route a diagram of something not designed yet goes to, by kind.
export const NOT_DESIGNED_ROUTE = { architecture: 'spec', deployment: 'spec', erd: 'spec', state: 'spec', flow: 'spec', screenmap: 'design', gantt: 'plan', 'story-map': 'plan' };
export const ROUTES = ['resume', ...MODES, 'diagram-in-task', 'none', ...NON_CODE_ROUTES, 'fix', 'change', 'upgrade', 'full', 'ask'];
// the routes that are a lane, and the lane each one starts (next.mjs start --lane)
export const LANE_OF = { fix: 'fix', change: 'change', upgrade: 'upgrade', verify: 'verify', full: 'feature' };

// s: { bare, resume, command, mode, kind, open_task, not_designed, question, deploy, stop_point, outcome, ambiguous, missing_intake, text_only, bug, internal, change_existing, new_capability, fix: {...}, lite: {...} }
// The change lane (change-profile.md) is one route; `internal` work goes through its triage, a visible change straight in (the scope is asked there).
export function route(s = {}) {
  // resume with no task name is still resume (resume.md picks the task or shows the menu); a bare `/muffy` shows the menu
  if (s.resume === true) return { route: 'resume', step: 1 };
  if (s.bare === true) return { route: 'menu', step: 1 };
  // `/muffy feature <request>`: the requester forced the full flow; only this decision is skipped, intake and gates still run
  if (s.command === 'feature') return { route: 'full', step: 2 };
  // `/muffy redesign <request>`: the change lane is forced; its scope question (the look, the rules, or both) is still asked inside it
  if (s.command === 'redesign') return { route: 'change', step: 2 };
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
  // "just find the cause": the fix lane with a stop after the audit (fix-profile.md "Diagnose only"), when fix triage takes it
  if (s.stop_point === 'diagnose') return { route: s.missing_intake === true ? 'ask' : triage(s.fix ?? {}).lane, step: 4, until: '4b' };
  const target = s.stop_point ?? s.outcome;
  if (target && target !== 'code') {
    if (!NON_CODE_ROUTES.includes(target)) return { route: 'ask', step: 7 };
    return { route: s.missing_intake === true ? 'ask' : target, step: s.stop_point ? 4 : 5 };
  }
  if (s.text_only === true) return { route: 'none', step: 6 };
  // bump a dependency or runtime already in the manifest (upgrade-profile.md); a new dependency stays with the full flow
  if (s.upgrade === true) return { route: 'upgrade', step: 6 };
  if (s.bug === true) {
    const lane = triage(s.fix ?? {}).lane;
    return { route: lane, step: 6 };
  }
  if (s.internal === true) return { route: triageLite(s.lite ?? {}).lane, step: 6 };
  if (s.change_existing === true) return { route: 'change', step: 6 };
  // full flow is the last option: only a capability the product lacks reaches it; anything vaguer is asked until one route fits
  if (s.new_capability === true) return { route: 'full', step: 6 };
  return { route: 'ask', step: 7 };
}

// Decision order step 7 and the minimum-intake table: the one question to ask next, in the requester's words (never lane names), and
// which signal its answer sets. A request that is a code change is asked in this order, stopping once one route fits.
const QUESTIONS = {
  broken: { th: 'มีอะไรพังหรือทำงานผิดอยู่ไหม', en: 'Is something broken or wrong?', sets: 'bug', yes: 'fix triage' },
  'exists-or-new': { th: 'ของนี้มีอยู่แล้ว หรือเป็นของใหม่', en: 'Does this exist already, or is it new?', sets: 'new_capability | change_existing', yes: 'new → full flow; exists → the next question' },
  visible: { th: 'ผู้ใช้จะเห็นอะไรเปลี่ยนไหม', en: 'Will a user see anything change?', sets: 'internal | change_existing', yes: 'nothing → internal; the screens → ui-only or ui+logic; only the rules → logic-only' },
  'which-route': { th: 'อยากได้ผลลัพธ์แบบไหน', en: 'What should come out of this?', sets: 'outcome', yes: 'the options run smallest route first, full flow last' },
};
export const INTAKE = {
  fix: { th: 'เกิดอะไรขึ้น และเกิดที่ไหนหรือทำให้เกิดยังไง', en: 'What happens, and where or how to trigger it?' },
  change: { th: 'ส่วนไหนที่ต้องการเปลี่ยน (และถ้าเป็นเรื่องความเร็ว ตัวเลขก่อนปรับคือเท่าไร)', en: 'Which part should change (and for speed, the number before)?' },
  full: { th: 'เป้าหมายในหนึ่งประโยค และใครเป็นผู้ใช้', en: 'The goal in one sentence, and who it is for' },
  verify: { th: 'branch ไหน ฐานคืออะไร และควรทำอะไรได้', en: 'Which branch, its base, and what it should do' },
  upgrade: { th: 'อัปเกรดอะไรไปเวอร์ชันไหน', en: 'Upgrade what, to which version?' },
  review: { th: 'branch หรือ PR ไหน', en: 'Which branch or PR?' },
};

export function routeAsk(s = {}) {
  if (s.missing_intake === true) {
    const key = s.outcome && s.outcome !== 'code' ? s.outcome : s.bug ? 'fix' : s.internal || s.change_existing ? 'change' : s.upgrade ? 'upgrade' : s.new_capability ? 'full' : null;
    if (key && INTAKE[key]) return { id: `intake:${key}`, ...INTAKE[key], sets: 'the missing fact' };
  }
  if (s.outcome === 'code' || s.bug !== undefined || s.internal !== undefined || s.new_capability !== undefined || s.change_existing !== undefined || s.ambiguous === true) {
    if (s.bug === undefined) return { id: 'broken', ...QUESTIONS.broken };
    if (s.new_capability === undefined && s.change_existing === undefined && s.internal === undefined) return { id: 'exists-or-new', ...QUESTIONS['exists-or-new'] };
    return { id: 'visible', ...QUESTIONS.visible };
  }
  return { id: 'which-route', ...QUESTIONS['which-route'] };
}

function cli(argv) {
  const json = argv.find((a) => !a.startsWith('--'));
  const lang = argv[argv.indexOf('--lang') + 1] === 'en' ? 'en' : 'th';
  if (!json) { console.error("usage: route.mjs '<signals json>' [--lang th|en]"); return 2; }
  let s;
  try { s = JSON.parse(json); } catch (e) { console.error(`route: the signals are not JSON: ${e.message}`); return 2; }
  const r = route(s);
  console.log(`next=route:${r.route} step=${r.step}${r.until ? ` until=${r.until}` : ''}`);
  if (LANE_OF[r.route]) console.log(`lane=${LANE_OF[r.route]}`);
  if (r.route === 'ask') {
    const q = routeAsk(s);
    console.log(`question=${q.id}`);
    console.log(`text=${q[lang]}`);
    if (q.sets) console.log(`answer-sets=${q.sets}`);
    return 1;
  }
  return 0;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) process.exit(cli(process.argv.slice(2)));
