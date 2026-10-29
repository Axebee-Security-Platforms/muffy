// The lanes in one table, so the scripts, the evals and the references cannot disagree about which lane a task runs
// or what that lane skips (references/run-profile.md, fix-profile.md, change-profile.md).
// Five lanes: feature (the full flow), fix, verify (review, QA and the gate on a branch someone already wrote), upgrade
// (bump a dependency or runtime already in the manifest), and change, whose scope says what changes: internal (nothing a user
// sees; was the lite lane), ui-only, ui+logic or logic-only (was the redesign lane). `lite` and `redesign` are aliases.
// A task's lane is read back from the first line of its checkpoint `## Run profile`, written by
// `checkpoint.mjs profile` in the form `lane: <id>[ (<scope>)] · skipped <steps>`. Older checkpoints wrote
// `lane: lite …`, `lane: redesign (<scope>) …`, `fix: skipped …`, `lite: skipped …`, `redesign lane (<scope>): …`
// or `fix lane …`; those still parse, to the lane and scope they mean now.
// Change a lane here and in its reference in the same commit: `npm test` compares the two.

// Execution order of the step ids (references/steps.md). 8 and 9 were removed with docs review and staging.
export const STEP_ORDER = ['0', '1', '2', '2b', '3', '3b', '3e', '3c', '3d', '4a', '4b', '4', '5', '5b', '6', '7', '10', '11', '12'];
export const NEVER_SKIP = ['6', '7', '10']; // every lane: review, QA, Human gate
export const GATES = ['2b', '3c']; // human gates; a lane either has both or none
export const SCOPES = ['internal', 'ui-only', 'ui+logic', 'logic-only']; // change lane, picked at pause:scope
export const FIX_SCOPES = ['bug', 'cosmetic']; // fix lane: `Kind:` in fix.md; a cosmetic fix (existing tokens) skips the 4b audit
export const VISIBLE_SCOPES = SCOPES.filter((s) => s !== 'internal'); // a user or caller sees the change
// older lane ids: lite is the internal scope; redesign is a visible scope, asked when the line names none
export const ALIASES = { lite: { lane: 'change', scope: 'internal' }, redesign: { lane: 'change', scope: null } };

// skips: step ids the lane skips by definition (a run adds its own, such as 3d with no smoke trigger)
// neverSkip: steps on top of NEVER_SKIP that this lane must run
// gated: 2b and 3c apply (the ui-only scope still skips 2b, recorded with `checkpoint.mjs gate 2b skip`)
// maxFiles: source files (tests and .team/ excluded) before the diff promotes the run to the full flow; null = no limit
// profile: the `Profile:` header the prompt envelope carries (fix only; the change lane sends `Scope:` instead)
// baseline: the onboard depth the lane needs before it starts (onboard.md → Depth): quick = stack, layout, commands; full = all of it
// A scope overrides the fields it names. A lane's own fields apply when the scope is missing or unknown, so a line with no
// scope fails closed: the change lane's are the visible scopes' (gated, full baseline), the fix lane's are a bug's (4a and 4b).
export const LANES = {
  feature: { skips: [], neverSkip: [], gated: true, maxFiles: null, profile: null, baseline: 'full', ref: 'run-profile.md' },
  fix: {
    skips: ['1', '2', '2b', '3', '3b', '3c', '3d'], neverSkip: ['4a', '4b'], gated: false, maxFiles: 5, profile: 'fix', baseline: 'quick', ref: 'fix-profile.md',
    scopes: { bug: {}, cosmetic: { skips: ['1', '2', '2b', '3', '3b', '3c', '3d', '4b'], neverSkip: ['4a'] } },
  },
  change: {
    skips: ['1'], neverSkip: ['2', '3c', '11'], gated: true, maxFiles: null, profile: null, baseline: 'full', ref: 'change-profile.md',
    scopes: {
      internal: { skips: ['1', '2', '2b', '3b', '3c'], neverSkip: ['3'], gated: false, maxFiles: 15, baseline: 'quick' },
      'ui-only': { skips: ['1', '2b'] },
      'ui+logic': { skips: ['1'] },
      'logic-only': { skips: ['1', '3b', '3e'] },
    },
  },
  // verify-profile.md: the code exists; review, QA, the Human gate and docs run on a copy of the requester's branch
  verify: { skips: ['1', '2', '2b', '3', '3b', '3e', '3c', '4a', '4b', '4', '5', '5b'], neverSkip: [], gated: false, maxFiles: null, profile: null, baseline: 'quick', ref: 'verify-profile.md' },
  // upgrade-profile.md: researcher reads the changelog, architect writes the upgrade ADR, the user approves it at 3c, 3d always runs
  upgrade: { skips: ['2', '2b', '3b'], neverSkip: ['1', '3', '3c', '3d'], gated: true, maxFiles: null, profile: null, baseline: 'quick', ref: 'upgrade-profile.md' },
};

const order = (steps) => [...new Set(steps)].sort((a, b) => STEP_ORDER.indexOf(a) - STEP_ORDER.indexOf(b));
// a scope the lane knows, lower-cased, or null
const scopeIn = (lane, s) => {
  const v = String(s ?? '').trim().toLowerCase();
  return LANES[lane]?.scopes && Object.hasOwn(LANES[lane].scopes, v) ? v : null;
};

// { lane, scope } with the aliases resolved: lite → change (internal), redesign → change (its scope, or none)
export function resolveLane(lane, scope) {
  const id = String(lane ?? '').toLowerCase();
  const alias = ALIASES[id];
  if (alias) return { lane: alias.lane, scope: alias.scope ?? scopeIn(alias.lane, scope) };
  return { lane: id, scope: scopeIn(id, scope) };
}

// the lane's fields with its scope's on top; null for an unknown lane
export function laneSpec(lane, scope) {
  const r = resolveLane(lane, scope);
  const l = LANES[r.lane];
  if (!l) return null;
  const { scopes, ...own } = l;
  return { ...own, ...(scopes?.[r.scope] ?? {}), lane: r.lane, scope: r.scope };
}

// the steps a lane (and scope) skips by definition, in execution order
export const skipsOf = (lane, scope) => order(laneSpec(lane, scope)?.skips ?? []);

export const neverSkipOf = (lane, scope) => [...NEVER_SKIP, ...(laneSpec(lane, scope)?.neverSkip ?? [])];

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
const DOCS_MAYBE = { '11': { th: 'เขียนเอกสาร + Deploy hand-off', en: 'docs and Deploy hand-off', maybe: true } };
const LANE_WORDS = {
  feature: { th: 'ทำฟีเจอร์ใหม่', en: 'build something new', why: { th: '', en: '' }, labels: DOCS_MAYBE },
  fix: {
    th: 'แก้บั๊ก', en: 'fix a bug', why: { th: 'มีอาการและจุดที่เกิดชัดแล้ว', en: 'the symptom and where it happens are known' },
    labels: { '4': { th: 'แก้โค้ด + regression test', en: 'fix + regression test' }, ...DOCS_MAYBE },
    scopes: {
      bug: { th: 'บั๊ก', en: 'a bug' },
      cosmetic: { th: 'หน้าตา จาก token เดิม', en: 'the look, existing tokens', labels: { '4': { th: 'แก้หน้าตา + เช็คด้วยตา', en: 'fix the look + visual check' } } },
    },
  },
  change: {
    th: 'ปรับของที่มีอยู่', en: 'change what already exists', why: { th: 'ของนี้มีอยู่แล้ว', en: 'it already exists' },
    labels: { '2': { th: 'เขียน AC ของการเปลี่ยนแปลง', en: 'acceptance criteria for the change' } },
    scopes: {
      internal: {
        th: 'ปรับภายใน (ผู้ใช้ไม่เห็น)', en: 'internal (nothing a user sees)', why: { th: 'ผู้ใช้มองไม่เห็นการเปลี่ยนแปลง', en: 'nothing a user sees changes' },
        labels: { '3': { th: 'ออกแบบ API / โครงสร้าง', en: 'design the API or structure' }, ...DOCS_MAYBE },
      },
      'ui-only': { th: 'เปลี่ยนแค่หน้าตา', en: 'look only', labels: { '3': { th: 'ออกแบบหน้าจอใหม่', en: 'design the new screens' }, '3c': { th: 'คุณอนุมัติ AC และดีไซน์', en: 'you approve the AC and design' } } },
      'ui+logic': { th: 'เปลี่ยนหน้าตาและกฎ', en: 'look and rules', labels: { '3': { th: 'ออกแบบหน้าจอและ API', en: 'design the screens and API' } } },
      'logic-only': { th: 'เปลี่ยนแค่กฎเบื้องหลัง', en: 'rules only', labels: { '3': { th: 'ออกแบบกฎ / API', en: 'design the rules or API' }, '3c': { th: 'คุณอนุมัติ contract', en: 'you approve the contract' } } },
    },
  },
};
LANE_WORDS.verify = {
  th: 'ตรวจ branch ที่เขียนเสร็จแล้ว', en: 'check a branch that is already written', why: { th: 'โค้ดเขียนเสร็จแล้ว', en: 'the code is already written' }, labels: DOCS_MAYBE,
  stop: { th: 'ผลรีวิวและผลเทสบน docker local ของ branch คุณ (ไม่แก้และไม่ merge branch ของคุณ)', en: 'review and QA results on docker local for your branch (never edited or merged)' },
};
LANE_WORDS.upgrade = {
  th: 'อัปเกรด dependency หรือ runtime', en: 'upgrade a dependency or runtime', why: { th: 'อัปเกรดของที่มีอยู่ ไม่ได้สร้างของใหม่', en: 'it bumps something already there, nothing new is built' },
  labels: {
    '1': { th: 'สรุป changelog และ breaking changes', en: 'read the changelog and breaking changes' },
    '3': { th: 'เขียน ADR การอัปเกรดและสิ่งที่ต้องแก้', en: 'the upgrade ADR and what must change' },
    '3c': { th: 'คุณอนุมัติ ADR', en: 'you approve the ADR' },
    '3d': { th: 'ทดสอบ stack บน docker', en: 'stack smoke on docker', maybe: false },
    '7': { th: 'เทสบน docker local (เสนอ full regression)', en: 'QA on docker local (full regression offered)' },
  },
};
const STOP_DEFAULT = { th: 'branch ที่ผ่าน QA บน docker local (ไม่ deploy ให้)', en: 'a QA-passed branch on docker local (never deployed)' };

// The card the Orchestrator shows before spawning, from the lane table: steps that run, steps skipped and why, where it stops.
// until: stop after this step (a stated stop point: "แค่วางแผน" → 2b, "ยังไม่ต้องเขียนโค้ด" → 3c)
export function planCard(lane, { scope, until, skip = [], lang = 'th' } = {}) {
  const r = resolveLane(lane, scope);
  const words = LANE_WORDS[r.lane];
  if (!words) throw new Error(`unknown lane: ${lane} (${Object.keys(LANES).join(', ')})`);
  if (r.lane === 'change' && !r.scope) throw new Error(`the change card needs a scope (${SCOPES.join(', ')}): ask it first`);
  if (until && !STEP_LABELS[until]) throw new Error(`--until ${until} is not a step the user sees (${Object.keys(STEP_LABELS).join(', ')})`);
  const sw = r.scope ? words.scopes[r.scope] : null;
  const why = sw?.why ?? words.why;
  const label = (s) => ({ ...STEP_LABELS[s], ...(words.labels?.[s] ?? {}), ...(sw?.labels?.[s] ?? {}) });
  const skipped = new Set([...skipsOf(r.lane, r.scope), ...skip]);
  const shown = STEP_ORDER.filter((s) => STEP_LABELS[s]);
  const kept = shown.filter((s) => !skipped.has(s) && (r.lane === 'fix' || !['4a', '4b'].includes(s)));
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
    ...(left.length ? [`${T.skip}: ${left.join(', ')}${why[lang] ? ` (${why[lang]})` : ''}`] : []),
    `${T.stop}: ${until ? label(until)[lang] : (words.stop ?? STOP_DEFAULT)[lang]}`,
  ];
}

/* ---------- the Run profile line ---------- */

const norm = (text) => String(text ?? '').replace(/\r\n/g, '\n');
const runProfile = (cpText) => norm(cpText).match(/^## Run profile[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? '';

// `lane: fix · skipped 1, 2, 2b, 3, 3b, 3c, 3d` / `lane: change (ui-only) · skipped 1, 2b, 3d` / `lane: fix (bug) · skipped … · until 4b`
// until: the run stops once that step is accepted (a stated stop point, route.md "Stop points"); it must be a step the lane runs
export function formatRunProfile(lane, { scope, skip = [], until } = {}) {
  const r = resolveLane(lane, scope);
  if (!LANES[r.lane]) throw new Error(`unknown lane: ${lane} (${Object.keys(LANES).join(', ')})`);
  if (r.lane === 'change' && !r.scope) throw new Error(`the change lane needs a scope (${SCOPES.join(', ')})`);
  if (scope && !r.scope) throw new Error(`${lane} has no scope ${scope}${LANES[r.lane].scopes ? ` (${Object.keys(LANES[r.lane].scopes).join(', ')})` : ''}`);
  const steps = skip.filter((s) => STEP_ORDER.includes(s));
  const other = skip.filter((s) => !STEP_ORDER.includes(s)); // roles a scope leaves out (designer, architect), kept as written
  const all = [...order([...skipsOf(r.lane, r.scope), ...steps]), ...new Set(other)];
  if (until && (!STEP_ORDER.includes(until) || all.includes(until))) throw new Error(`until ${until}: not a step this lane runs`);
  return `lane: ${r.lane}${r.scope ? ` (${r.scope})` : ''} · skipped ${all.length ? all.join(', ') : 'none'}${until ? ` · until ${until}` : ''}`;
}

// lines a lane line may have been written as, newest first; the first match decides (lite and redesign resolve to change)
const LEGACY = [
  [/^[-*\s]*redesign lane\s*\(([^)]+)\)/im, 'redesign'],
  [/\bredesign lane\b|\/muffy redesign\b/i, 'redesign'],
  [/^[-*\s]*fix:/im, 'fix'],
  [/^[-*\s]*lite:/im, 'lite'],
  [/\bfix lane\b|\/muffy fix\b/i, 'fix'],
  [/\blite lane\b|\/muffy lite\b/i, 'lite'],
];

// the step ids after `skipped` on the line where a match ends at `end` (roles such as designer are dropped)
const lineAt = (rp, end) => rp.slice(rp.lastIndexOf('\n', end - 1) + 1).split('\n')[0];
const skippedOn = (rp, end) => (lineAt(rp, end).match(/\bskipped\b(.*?)(?:·\s*until\b.*)?$/i)?.[1] ?? '').split(/[,\s]+/).filter((s) => STEP_ORDER.includes(s));
// the stop point on the lane line (`· until 4b`), or null
const untilOn = (rp, end) => { const u = lineAt(rp, end).match(/·\s*until\s+(\w+)/i)?.[1]; return STEP_ORDER.includes(u) ? u : null; };

// { lane, scope, skipped, until } of a checkpoint; feature when the Run profile names no other lane.
// `skipped` is every step id the lane line lists, so a run's own skip (3d with no smoke trigger) is read back too.
// A lane line written before the merge (`lane: lite`, `lane: redesign (ui-only)`) reads as the change lane and scope it is now.
export function parseRunProfile(cpText) {
  const rp = runProfile(cpText);
  const m = rp.match(/^[-*\s]*lane:\s*(\w+)(?:\s*\(([^)]+)\))?/im);
  const id = m?.[1].toLowerCase();
  if (m && (LANES[id] || ALIASES[id])) { const end = m.index + m[0].length; return { ...resolveLane(id, m[2]), skipped: skippedOn(rp, end), until: untilOn(rp, end) }; }
  for (const [re, lane] of LEGACY) {
    const hit = rp.match(re);
    if (hit) return { ...resolveLane(lane, lane === 'redesign' ? hit[1] : null), skipped: skippedOn(rp, hit.index + hit[0].length), until: null };
  }
  return { lane: 'feature', scope: null, skipped: [], until: null };
}

// true for a Run profile line that names a lane in any form (checkpoint.mjs profile replaces it)
export const isLaneLine = (line) => /^[-*\s]*lane:\s*\w+/i.test(line) || LEGACY.some(([re]) => re.test(line));
