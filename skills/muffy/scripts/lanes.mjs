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
// baseline: the onboard depth the lane needs before it starts (onboard.md → Depth): quick = stack, layout, commands; full = all of it
export const LANES = {
  feature: { skips: [], neverSkip: [], gated: true, maxFiles: null, profile: null, baseline: 'full', ref: 'run-profile.md' },
  fix: { skips: ['1', '2', '2b', '3', '3b', '3c', '3d'], neverSkip: ['4a', '4b'], gated: false, maxFiles: 5, profile: 'fix', baseline: 'quick', ref: 'fix-profile.md' },
  lite: { skips: ['1', '2', '2b', '3b', '3c'], neverSkip: ['3'], gated: false, maxFiles: 15, profile: 'lite', baseline: 'quick', ref: 'lite-profile.md' },
  redesign: {
    skips: ['1'], neverSkip: ['2', '3c', '11'], gated: true, maxFiles: null, profile: null, baseline: 'full', ref: 'redesign-profile.md',
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

/* ---------- the plan card (route.md "Say the plan"): the lane in the words of the work, not its name ---------- */

// What the user sees for each step. Steps with no label (0, 3b, 3e, 5, 5b, 12) are the Orchestrator's own bookkeeping.
// A lane or scope can word a step its own way (`labels`); `maybe` marks a step that runs only when its trigger is true.
export const STEP_LABELS = {
  '1': { th: 'วิจัยข้อมูล', en: 'research' },
  '2': { th: 'เขียน user story และแผน', en: 'user stories and plan' },
  '2b': { th: 'คุณอนุมัติแผน', en: 'you approve the plan' },
  '3': { th: 'ออกแบบหน้าจอ, API และ infra', en: 'design screens, API and infra' },
  '3c': { th: 'คุณอนุมัติดีไซน์', en: 'you approve the design' },
  '3d': { th: 'ทดสอบ stack บน docker', en: 'stack smoke on docker', maybe: true },
  '4a': { th: 'หาสาเหตุ (ยังไม่แก้โค้ด)', en: 'find the cause (no code yet)' },
  '4b': { th: 'อีกโมเดลตรวจสาเหตุซ้ำ', en: 'a second model checks the cause' },
  '4': { th: 'เขียนโค้ด', en: 'write the code' },
  '6': { th: 'รีวิวโค้ด', en: 'code review' },
  '7': { th: 'เทสบน docker local', en: 'QA on docker local' },
  '10': { th: 'คุณอนุมัติ branch', en: 'you accept the branch' },
  '11': { th: 'เขียนเอกสาร + Deploy hand-off', en: 'docs and Deploy hand-off' },
};
const LANE_WORDS = {
  feature: { th: 'ทำฟีเจอร์ใหม่', en: 'build something new', why: { th: '', en: '' }, labels: { '11': { th: 'เขียนเอกสาร + Deploy hand-off', en: 'docs and Deploy hand-off', maybe: true } } },
  fix: {
    th: 'แก้บั๊ก', en: 'fix a bug', why: { th: 'มีอาการและจุดที่เกิดชัดแล้ว', en: 'the symptom and where it happens are known' },
    labels: { '4': { th: 'แก้โค้ด + regression test', en: 'fix + regression test' }, '11': { th: 'เขียนเอกสาร + Deploy hand-off', en: 'docs and Deploy hand-off', maybe: true } },
  },
  lite: {
    th: 'ปรับภายใน (ผู้ใช้ไม่เห็น)', en: 'internal change (nothing a user sees)', why: { th: 'ผู้ใช้มองไม่เห็นการเปลี่ยนแปลง', en: 'nothing a user sees changes' },
    labels: { '3': { th: 'ออกแบบ API / โครงสร้าง', en: 'design the API or structure' }, '11': { th: 'เขียนเอกสาร + Deploy hand-off', en: 'docs and Deploy hand-off', maybe: true } },
  },
  redesign: {
    th: 'ปรับของที่มีอยู่', en: 'change what already exists', why: { th: 'ของนี้มีอยู่แล้ว', en: 'it already exists' },
    labels: { '2': { th: 'เขียน AC ของการเปลี่ยนแปลง', en: 'acceptance criteria for the change' } },
    scopes: {
      'ui-only': { th: 'เปลี่ยนแค่หน้าตา', en: 'look only', labels: { '3': { th: 'ออกแบบหน้าจอใหม่', en: 'design the new screens' }, '3c': { th: 'คุณอนุมัติ AC และดีไซน์', en: 'you approve the AC and design' } } },
      'ui+logic': { th: 'เปลี่ยนหน้าตาและกฎ', en: 'look and rules', labels: { '3': { th: 'ออกแบบหน้าจอและ API', en: 'design the screens and API' } } },
      'logic-only': { th: 'เปลี่ยนแค่กฎเบื้องหลัง', en: 'rules only', labels: { '3': { th: 'ออกแบบกฎ / API', en: 'design the rules or API' }, '3c': { th: 'คุณอนุมัติ contract', en: 'you approve the contract' } } },
    },
  },
};
const STOP_DEFAULT = { th: 'branch ที่ผ่าน QA บน docker local (ไม่ deploy ให้)', en: 'a QA-passed branch on docker local (never deployed)' };

// The card the Orchestrator shows before spawning, from the lane table: steps that run, steps skipped and why, where it stops.
// until: stop after this step (a stated stop point: "แค่วางแผน" → 2b, "ยังไม่ต้องเขียนโค้ด" → 3c)
export function planCard(lane, { scope, until, skip = [], lang = 'th' } = {}) {
  const words = LANE_WORDS[lane];
  if (!words) throw new Error(`unknown lane: ${lane} (${Object.keys(LANES).join(', ')})`);
  if (lane === 'redesign' && !scopeOf(scope)) throw new Error(`the redesign card needs a scope (${SCOPES.join(', ')}): ask it first`);
  if (until && !STEP_LABELS[until]) throw new Error(`--until ${until} is not a step the user sees (${Object.keys(STEP_LABELS).join(', ')})`);
  const sw = scope ? words.scopes[scopeOf(scope)] : null;
  const label = (s) => ({ ...STEP_LABELS[s], ...(words.labels?.[s] ?? {}), ...(sw?.labels?.[s] ?? {}) });
  const skipped = new Set([...skipsOf(lane, scopeOf(scope)), ...skip]);
  const shown = STEP_ORDER.filter((s) => STEP_LABELS[s]);
  const kept = shown.filter((s) => !skipped.has(s) && (lane === 'fix' || !['4a', '4b'].includes(s)));
  const cut = until ? kept.slice(0, kept.indexOf(until) + 1) : kept;
  const maybe = lang === 'th' ? ' (ถ้าจำเป็น)' : ' (if needed)';
  const steps = cut.map((s) => `${label(s)[lang]}${label(s).maybe ? maybe : ''}`);
  const left = shown.filter((s) => skipped.has(s) && !['2b', '3c', '3d', '4a', '4b'].includes(s)).map((s) => label(s)[lang]);
  const T = lang === 'th'
    ? { plan: 'แผน', steps: 'ขั้นตอน', skip: 'ข้าม', stop: 'หยุดที่' }
    : { plan: 'Plan', steps: 'Steps', skip: 'Skipped', stop: 'Stops at' };
  return [
    `${T.plan}: ${words[lang]}${sw ? ` · ${sw[lang]}` : ''}`,
    `${T.steps}: ${steps.join(' → ')}`,
    ...(left.length ? [`${T.skip}: ${left.join(', ')}${words.why[lang] ? ` (${words.why[lang]})` : ''}`] : []),
    `${T.stop}: ${until ? label(until)[lang] : STOP_DEFAULT[lang]}`,
  ];
}

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
