#!/usr/bin/env node
// Writes the checkpoint bookkeeping the Orchestrator would otherwise type by hand (references/memory-model.md#checkpoint):
//   round  write rounds/<step>-r<n>.md once, then in checkpoint.md: Updated line, ## Loop counters, ## Open blockers
//          (rounds open carried over by blocker id), one ## History line and its [label] definition
//   pause  set `paused at pause:<id> · resume when <condition>` in ## Status (only the pauses in run-profile.md)
//   unpause  remove that line when the pause is answered (refused for plan-review and design-review while
//          their gate is open: `gate` records the answer and clears those)
//   spawn  append one spawns.tsv line, verdict read from the hand-off when one is given
//   gate   the user's answer at a human gate (2b, 3c): approve (needs the pause saved and the gate summary ready),
//          reject (keeps the pause), skip (needs --reason). Writes `gate <id> passed|not passed|skipped` to ## Status
//   profile  the lane line first in ## Run profile (`lane: <id>[ (<scope>)] · skipped …`, lanes.mjs), replacing an older one
//   ask    a named pause about to ask (references/headless.md). Not headless → `next=ask-user` (AskUserQuestion as
//          before, nothing written). Headless → rule H2 may pass it (`auto: … · rule H2` in ## Status), else the
//          questions the Orchestrator put in .team/<task>/gate.json are validated and completed (gate, task,
//          created_at), the pause line is set (replaced, never a second one) and `muffy-status: waiting:<gate>` printed
//   answer  resume: consume `<gate> answered: <answer> by <who> (<source>) <ISO time>` for the gate in gate.json,
//          record it (gate 2b/3c, audit 4b risk), clear the pause, append `<gate> answer consumed`, delete gate.json
// Every command runs check-checkpoint.mjs afterwards and fails with its errors.
//
// Usage:
//   node checkpoint.mjs round  <.team/<task>> --step 6 --round 2 --handoff <file> --summary "<one line>" [--notes "<≤5 lines, | separated>"]
//   node checkpoint.mjs pause  <.team/<task>> <id> --until "<condition>"
//   node checkpoint.mjs unpause <.team/<task>>
//   node checkpoint.mjs spawn  <.team/<task>> --step 4 --role backend-dev --model sonnet --effort medium --round 1
//                              [--handoff <file> | --verdict pass|fail|blocked] [--reruns 0] [--note "<≤8 words>"] [--tok <n>]
//   node checkpoint.mjs gate   <.team/<task>> 2b approve --plan docs/plan/<task>.md --by "<the user's reply>"
//   node checkpoint.mjs gate   <.team/<task>> 3c approve --by "<the user's reply>"
//   node checkpoint.mjs gate   <.team/<task>> 2b|3c reject  --by "<the user's reply>"
//   node checkpoint.mjs gate   <.team/<task>> 2b|3c skip    --reason "<why no gate>"
//   node checkpoint.mjs profile <.team/<task>> feature|fix|change [--scope <scope>] [--until <step>]   (scopes: fix bug|cosmetic; change internal|ui-only|ui+logic|logic-only)
//                               [--skip 3d,designer]
//   node checkpoint.mjs ask    <.team/<task>> <pause id> [--until "<condition>"] [--triage-passed] [--ac-from-request]
//                              [--scope-change] [--verdict need-validation|reject]     (env MUFFY_HEADLESS, _POLICY, MUFFY_TRIGGERED_BY)
//   node checkpoint.mjs answer <.team/<task>> [--plan docs/plan/<task>.md]
// Prints one verdict line. Exit 0 = written and checked, 1 = written but check-checkpoint failed, 2 = usage or input error.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, rmSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { gatePolicy, validateGate, findAnswer, auditAnswer, gateAnswer, STATUS_LINE, CONSUMED } from './headless.mjs';
import { fileURLToPath } from 'node:url';
import { checkTask } from './check-checkpoint.mjs';
import { LOOP_LIMIT } from './next-action.mjs';
import { GATES, PAUSE_OF, gateState } from './gate-rules.mjs';
import { gate2b, gate3c } from './gate-summary.mjs';
import { laneSpec, skipsOf, neverSkipOf, formatRunProfile, isLaneLine, parseRunProfile } from './lanes.mjs';

export const PAUSES = ['scope', 'scope-upgrade', 'onboard-review', 'todo-review', 'plan-review', 'design-review', 'full-regression', 'audit', 'escalation', 'question', 'human-gate'];
const REJECTING = new Set(['Reject', 'Fail']);
const DEF = /^\[([A-Za-z0-9.-]+)\]:\s*\S+\s*$/;

/* ---------- checkpoint.md as header + sections + link definitions ---------- */

export function parse(text) {
  const crlf = text.includes('\r\n');
  const lines = text.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const defs = [];
  while (lines.length && (DEF.test(lines.at(-1)) || lines.at(-1) === '')) { const l = lines.pop(); if (l) defs.unshift(l); }
  const head = [];
  const sections = [];
  for (const l of lines) {
    if (l.startsWith('## ')) sections.push({ name: l.slice(3).trim(), body: [] });
    else if (sections.length) sections.at(-1).body.push(l);
    else head.push(l);
  }
  for (const s of sections) while (s.body.length && s.body.at(-1) === '') s.body.pop();
  return { crlf, head, sections, defs };
}

export function render({ crlf, head, sections, defs }) {
  const out = [...head];
  for (const s of sections) out.push(`## ${s.name}`, ...s.body, '');
  if (defs.length) out.push(...defs);
  else while (out.at(-1) === '') out.pop();
  const text = out.join('\n') + '\n';
  return crlf ? text.replace(/\n/g, '\r\n') : text;
}

// The section's body lines; created at the end (before the link block) when missing.
function body(cp, name) {
  let s = cp.sections.find((x) => x.name === name);
  if (!s) { s = { name, body: [] }; cp.sections.push(s); }
  return s.body;
}
const dropNone = (lines) => lines.filter((l) => !/^\s*none\.?\s*$/i.test(l) && l.trim() !== '');

/* ---------- commands ---------- */

export function recordRound(taskDir, { step, round, handoff, summary, notes = '' }) {
  const h = JSON.parse(readFileSync(handoff, 'utf8'));
  const label = `${step}-r${round}`;
  const roundFile = join(taskDir, 'rounds', `${label}.md`);
  if (existsSync(roundFile)) throw new Error(`rounds/${label}.md already exists; round files are written once`);
  const owner = h.role ?? 'unknown';
  const blockers = Array.isArray(h.blockers) ? h.blockers : [];
  const verdict = h.verdict ?? h.status ?? 'unknown';
  mkdirSync(join(taskDir, 'rounds'), { recursive: true });
  writeFileSync(roundFile, [
    `# Round ${label}`,
    `Owner: ${owner}`,
    `Hand-off: ${relative(taskDir, resolve(handoff)).split('\\').join('/')}`,
    `Verdict: ${verdict}${blockers.length ? ` · ${blockers.map((b) => b.id).join(', ')}` : ''}`,
    `Artifacts: ${(h.paths_written ?? []).join(', ') || 'none'}`,
    'Notes:',
    ...notes.split('|').map((n) => n.trim()).filter(Boolean).slice(0, 5).map((n) => `- ${n}`),
    '',
  ].join('\n'));

  const cpPath = join(taskDir, 'checkpoint.md');
  if (!existsSync(cpPath)) throw new Error(`missing ${cpPath}`);
  const cp = parse(readFileSync(cpPath, 'utf8'));
  const updated = cp.head.findIndex((l) => l.startsWith('Updated:'));
  const line = `Updated: step ${step} · round ${round}`;
  if (updated >= 0) cp.head[updated] = line; else cp.head.splice(1, 0, line);

  // loop counter: only a rejecting verdict counts (loops.md "Only the work product's failures count")
  const point = `${step}:${owner}`;
  const counters = dropNone(body(cp, 'Loop counters'));
  const at = counters.findIndex((l) => l.startsWith(`${point} `));
  const used = at >= 0 ? Number(counters[at].match(/(\d+)\/\d+/)?.[1] ?? 0) : 0;
  const now = used + (REJECTING.has(h.verdict) ? 1 : 0);
  if (now > 0) {
    const entry = `${point} ${now}/${LOOP_LIMIT}`;
    if (at >= 0) counters[at] = entry; else counters.push(entry);
  }
  replaceBody(cp, 'Loop counters', counters.length ? counters : ['None.']);

  // open blockers: the latest round only, rounds open carried by stable id
  const previous = new Map(dropNone(body(cp, 'Open blockers')).map((l) => [l.match(/\b([BV]-\d+)\b/)?.[1], Number(l.match(/rounds open (\d+)/)?.[1] ?? 1)]));
  const open = [...blockers, ...(h.needs_validation ?? []).map((v) => ({ id: v.id, problem: v.question, owner: v.owner }))]
    .map((b) => `- ${b.id} · ${b.file ?? '-'} · ${b.owner ?? '-'} · rounds open ${(previous.get(b.id) ?? 0) + 1}`);
  replaceBody(cp, 'Open blockers', open.length ? open : ['None.']);

  const history = dropNone(body(cp, 'History')).filter((l) => !l.includes(`[${label}]`));
  history.push(`- step ${step} r${round}: ${summary.replace(/\s+/g, ' ').trim()} [${label}]`);
  replaceBody(cp, 'History', history);
  cp.defs = [...cp.defs.filter((d) => !d.startsWith(`[${label}]:`)), `[${label}]: rounds/${label}.md`];

  writeFileSync(cpPath, render(cp));
  return { label, counter: now ? `${point} ${now}/${LOOP_LIMIT}` : `${point} 0/${LOOP_LIMIT}`, open: open.length };
}

function replaceBody(cp, name, lines) { const b = body(cp, name); b.splice(0, b.length, ...lines); }

export function setPause(taskDir, id, until) {
  if (!PAUSES.includes(id)) throw new Error(`pause:${id} is not a named pause (${PAUSES.join(', ')})`);
  if (!until?.trim()) throw new Error('--until needs the resume condition');
  return editStatus(taskDir, `paused at pause:${id} · resume when ${until.trim()}`);
}
// A gate's pause (plan-review, design-review) is cleared only by `gate`, which records the user's answer.
// Unpausing it bare would let the run go on with the gate still open, so it is refused while the gate is open.
export function clearPause(taskDir) {
  const cpPath = join(taskDir, 'checkpoint.md');
  if (!existsSync(cpPath)) throw new Error(`missing ${cpPath}`);
  const text = readFileSync(cpPath, 'utf8');
  const status = parse(text).sections.find((s) => s.name === 'Status')?.body ?? [];
  const run = parseRunProfile(text);
  if (laneSpec(run.lane, run.scope).gated) {
    for (const gate of GATES) {
      if (status.some((l) => l.includes(`paused at pause:${PAUSE_OF[gate]}`)) && gateState(text, gate) === 'open') {
        throw new Error(`unpause: pause:${PAUSE_OF[gate]} waits on gate ${gate}, which has no recorded answer. Record it with checkpoint.mjs gate <dir> ${gate} approve|reject --by "<the user's reply>" (approve clears the pause)`);
      }
    }
  }
  return editStatus(taskDir, null);
}

function editStatus(taskDir, pausedLine) {
  const cpPath = join(taskDir, 'checkpoint.md');
  if (!existsSync(cpPath)) throw new Error(`missing ${cpPath}`);
  const cp = parse(readFileSync(cpPath, 'utf8'));
  const status = body(cp, 'Status');
  const kept = status.filter((l) => !/paused at pause:/.test(l));
  replaceBody(cp, 'Status', pausedLine ? [...kept, pausedLine] : kept);
  writeFileSync(cpPath, render(cp));
  return pausedLine ?? 'pause cleared';
}

// done -> pass; blocked / needs-input -> blocked; not-ready or a rejecting verdict -> fail
export const verdictOf = (h) => (REJECTING.has(h.verdict) || h.status === 'not-ready' ? 'fail' : ['blocked', 'needs-input'].includes(h.status) ? 'blocked' : 'pass');

export function logSpawn(taskDir, o) {
  for (const k of ['step', 'role', 'model', 'effort', 'round']) if (o[k] === undefined || o[k] === '') throw new Error(`spawn: --${k} is required`);
  const verdict = o.handoff ? verdictOf(JSON.parse(readFileSync(o.handoff, 'utf8'))) : o.verdict;
  if (!['pass', 'fail', 'blocked'].includes(verdict)) throw new Error('spawn: give --handoff or --verdict pass|fail|blocked');
  const note = String(o.note ?? '').replace(/[\t\n]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
  const tok = /^\d+$/.test(String(o.tok ?? '')) ? `tok:${o.tok}` : 'tok:n/a';
  const line = [o.step, o.role, o.model, o.effort, o.round, verdict, o.reruns ?? 0, `${note ? `${note} ` : ''}${tok}`].join('\t');
  appendFileSync(join(taskDir, 'spawns.tsv'), `${line}\n`);
  return line.replace(/\t/g, ' · ');
}

// The lane line, first in ## Run profile: the scripts read the lane from it (lanes.mjs), so it is never typed by hand.
// Replaces an earlier lane line in any form and keeps the other lines (effort, test level).
export function setProfile(taskDir, lane, { scope, skip = [], until } = {}) {
  const cpPath = join(taskDir, 'checkpoint.md');
  if (!existsSync(cpPath)) throw new Error(`missing ${cpPath}`);
  const line = formatRunProfile(lane, { scope, skip, until });
  const cp = parse(readFileSync(cpPath, 'utf8'));
  if (!cp.sections.some((s) => s.name === 'Run profile')) {
    const at = cp.sections.findIndex((s) => s.name !== 'Goal');
    cp.sections.splice(at < 0 ? cp.sections.length : at, 0, { name: 'Run profile', body: [] });
  }
  const kept = dropNone(body(cp, 'Run profile')).filter((l) => !isLaneLine(l));
  replaceBody(cp, 'Run profile', [line, ...kept]);
  writeFileSync(cpPath, render(cp));
  return line;
}

// The user's answer at a human gate. `approve` needs the pause saved first (the question was asked) and a ready
// gate summary; `reject` keeps the pause; `skip` needs a reason and is refused where the gate cannot be skipped.
export function recordGate(taskDir, gate, action, { by, reason, plan } = {}) {
  if (!GATES.includes(gate)) throw new Error(`gate: ${gate} is not a gate (${GATES.join(', ')})`);
  if (!['approve', 'reject', 'skip'].includes(action)) throw new Error('gate: action is approve, reject or skip');
  const cpPath = join(taskDir, 'checkpoint.md');
  if (!existsSync(cpPath)) throw new Error(`missing ${cpPath}`);
  const text = readFileSync(cpPath, 'utf8');
  const { lane, scope } = parseRunProfile(text);
  const pause = `paused at pause:${PAUSE_OF[gate]}`;
  const paused = (parse(text).sections.find((s) => s.name === 'Status')?.body ?? []).some((l) => l.includes(pause));
  const date = new Date().toISOString().slice(0, 10);
  const cp = parse(text);
  const status = body(cp, 'Status');
  let line;

  if (action === 'skip') {
    if (!reason?.trim()) throw new Error('gate skip: --reason is required');
    if (gate === '2b' && lane === 'feature') throw new Error('gate 2b cannot be skipped in the feature lane (only fix, the internal change scope and the ui-only change scope skip it)');
    if (gate === '2b' && laneSpec(lane, scope).gated && lane !== 'feature' && !skipsOf(lane, scope).includes('2b')) throw new Error('gate 2b can be skipped only where the lane skips it: a ui-only change (the AC are approved with the design at 3c) or an upgrade (the ADR is approved at 3c)');
    if (gate === '3c' && neverSkipOf(lane, scope).includes('3c') && laneSpec(lane, scope).gated && lane !== 'change') throw new Error(`gate 3c cannot be skipped in the ${lane} lane: the user approves its ADR or contract there`);
    if (gate === '3c' && existsSync(join(taskDir, 'design.md'))) throw new Error('gate 3c cannot be skipped: design.md exists, so a designer ran');
    if (gate === '3c' && lane === 'change' && laneSpec(lane, scope).gated && existsSync(join(taskDir, 'contract.md'))) throw new Error('gate 3c cannot be skipped: contract.md exists, so the user approves the contract here');
    line = `gate ${gate} skipped · ${reason.trim()}`;
  } else {
    if (!paused) throw new Error(`gate ${gate}: save the pause first (checkpoint.mjs pause <dir> ${PAUSE_OF[gate]} --until "the user answers"), so the question is on record`);
    if (!by?.trim()) throw new Error('gate: --by is required, the user\'s reply in their own words');
    if (action === 'approve') {
      const summary = gate === '2b' ? gate2b(taskDir, { plan }) : gate3c(taskDir);
      if (summary.notReady.length) throw new Error(`gate ${gate} not ready: ${summary.notReady.join('; ')}`);
      line = `gate ${gate} passed · user: "${by.trim()}" · ${date}`;
    } else {
      line = `gate ${gate} not passed · user: "${by.trim()}" · ${date}`;
    }
  }

  // an answer clears the pause that asked; a rejection keeps it open until the revision is answered
  const kept = status.filter((l) => !(action !== 'reject' && l.includes(pause)));
  replaceBody(cp, 'Status', [...kept, line]);
  writeFileSync(cpPath, render(cp));
  return `${line} (gate state now ${gateState(render(cp), gate)})`;
}

/* ---------- headless gates (references/headless.md) ---------- */

const statusOf = (cpPath) => parse(readFileSync(cpPath, 'utf8')).sections.find((s) => s.name === 'Status')?.body ?? [];

// A pause about to ask. Returns { action: 'interactive' | 'auto' | 'ask', line?, reason?, gateFile? }.
export function askGate(taskDir, gate, { env = {}, facts = {}, until, now = new Date() } = {}) {
  if (!PAUSES.includes(gate)) throw new Error(`pause:${gate} is not a named pause (${PAUSES.join(', ')})`);
  const cpPath = join(taskDir, 'checkpoint.md');
  if (!existsSync(cpPath)) throw new Error(`missing ${cpPath}`);
  const gateFile = join(taskDir, 'gate.json');
  const policy = gatePolicy(gate, env, { ...facts, status: statusOf(cpPath) });
  if (policy.action === 'interactive') return policy;

  if (policy.action === 'auto') {
    const cp = parse(readFileSync(cpPath, 'utf8'));
    const kept = body(cp, 'Status').filter((l) => !l.includes(`paused at pause:${gate} `));
    replaceBody(cp, 'Status', [...kept, `- ${policy.line} · ${now.toISOString()}`]);
    writeFileSync(cpPath, render(cp));
    if (existsSync(gateFile)) rmSync(gateFile);
    return policy;
  }

  if (!existsSync(gateFile)) throw new Error(`ask: headless, ${policy.reason}. Write the AskUserQuestion input ({ "questions": [...] }) to ${gateFile} first`);
  let draft;
  try { draft = JSON.parse(readFileSync(gateFile, 'utf8')); } catch (e) { throw new Error(`ask: ${gateFile} is not JSON (${e.message})`); }
  const out = { gate, task: basename(resolve(taskDir)), created_at: now.toISOString(), questions: Array.isArray(draft) ? draft : draft.questions };
  const errs = validateGate(out);
  if (errs.length) throw new Error(`ask: gate.json does not match the AskUserQuestion shape: ${errs.join('; ')}`);
  writeFileSync(gateFile, `${JSON.stringify(out, null, 2)}\n`);
  setPause(taskDir, gate, until?.trim() || 'a person answers gate.json');
  return { ...policy, gateFile, statusLine: STATUS_LINE(gate) };
}

// Resume: the answer to the gate in gate.json, if a person wrote one. Returns { state: 'none' | 'waiting' | 'answered', … }.
export function consumeAnswer(taskDir, { plan, now = new Date() } = {}) {
  const cpPath = join(taskDir, 'checkpoint.md');
  const gateFile = join(taskDir, 'gate.json');
  if (!existsSync(cpPath)) throw new Error(`missing ${cpPath}`);
  if (!existsSync(gateFile)) return { state: 'none' };
  const g = JSON.parse(readFileSync(gateFile, 'utf8'));
  const a = findAnswer(statusOf(cpPath), g.gate);
  if (!a) return { state: 'waiting', gate: g.gate, statusLine: STATUS_LINE(g.gate) };

  const answers = splitAnswers(a.answer, g.questions ?? []);
  const first = answers[0].answer;
  const by = `${a.answer} · ${a.by} (${a.source})`;
  let event = null;
  const gateId = Object.keys(PAUSE_OF).find((k) => PAUSE_OF[k] === g.gate);
  if (gateId) {
    const act = gateAnswer(first);
    if (!act) throw new Error(`answer: "${first}" is neither approve nor reject for gate ${gateId}`);
    recordGate(taskDir, gateId, act, { by, plan });
    event = act;
  } else if (g.gate === 'audit') {
    event = auditAnswer(first);
    if (!event) throw new Error(`answer: "${first}" is not more-info, accept-risk or cancel`);
    clearPause(taskDir);
    if (event === 'accept-risk') {
      const cp = parse(readFileSync(cpPath, 'utf8'));
      replaceBody(cp, 'Status', [...body(cp, 'Status'), `- audit 4b: risk accepted · user: "${by}"`]);
      writeFileSync(cpPath, render(cp));
    }
  } else {
    clearPause(taskDir);
  }

  const cp = parse(readFileSync(cpPath, 'utf8'));
  replaceBody(cp, 'Status', [...body(cp, 'Status'), `- ${CONSUMED(g.gate, now.toISOString())}`]);
  writeFileSync(cpPath, render(cp));
  rmSync(gateFile);
  return { state: 'answered', gate: g.gate, answer: a.answer, answers, by: a.by, source: a.source, event };
}

// One answer line holds every question's answer in question order, joined by ` | `; a multiSelect answer joins
// its labels with `, `. A part count other than the question count is refused before anything is written.
export function splitAnswers(answer, questions) {
  const parts = answer.split(' | ').map((p) => p.trim());
  const n = Math.max(questions.length, 1);
  if (parts.length !== n) throw new Error(`answer: ${parts.length} part(s) separated by " | " for ${n} question(s) in gate.json; write one part per question, in order`);
  return parts.map((p, i) => {
    const q = questions[i] ?? {};
    return { header: q.header ?? '', question: q.question ?? '', answer: p, labels: q.multiSelect ? p.split(',').map((l) => l.trim()).filter(Boolean) : [p] };
  });
}

/* ---------- CLI ---------- */

function opts(argv) {
  const o = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
    else pos.push(argv[i]);
  }
  return { o, pos };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const { o, pos } = opts(rest);
  const taskDir = pos[0];
  if (!['round', 'pause', 'unpause', 'spawn', 'gate', 'profile', 'ask', 'answer'].includes(cmd) || !taskDir) {
    console.error('usage: checkpoint.mjs round|pause|unpause|spawn|gate|profile|ask|answer <.team/<task>> ... (see the header of this file)');
    process.exit(2);
  }
  let said;
  let tail = [];
  try {
    if (cmd === 'ask') {
      const facts = { triagePassed: 'triage-passed' in o, acFromRequest: 'ac-from-request' in o, scopeChange: 'scope-change' in o, verdict: typeof o.verdict === 'string' ? o.verdict : undefined };
      const r = askGate(taskDir, pos[1], { env: process.env, facts, until: typeof o.until === 'string' ? o.until : undefined });
      if (r.action === 'interactive') { console.log('next=ask-user (not headless: AskUserQuestion as before; nothing written)'); process.exit(0); }
      if (r.action === 'auto') { said = r.line; tail = ['next=continue']; }
      else { said = `gate.json written · paused at pause:${pos[1]} (${r.reason})`; tail = ['next=stop: commit .team/<task>/ on the task branch, end the final message with the line below', r.statusLine]; }
    } else if (cmd === 'answer') {
      const r = consumeAnswer(taskDir, { plan: typeof o.plan === 'string' ? o.plan : undefined });
      if (r.state === 'none') { console.log('next=none (no gate.json: nothing headless is waiting)'); process.exit(0); }
      if (r.state === 'waiting') { console.log(`next=stop (pause:${r.gate} has no answer yet: do not ask, do not answer it yourself)\n${r.statusLine}`); process.exit(0); }
      said = `pause:${r.gate} answered: ${r.answer} by ${r.by} (${r.source}); gate.json removed`;
      tail = r.answers.length > 1
        ? [...r.answers.map((x, i) => `answer.${i + 1}=${x.header}: ${x.answer}`), ...(r.event ? [`answer=${r.event}`] : []), 'next=continue']
        : [`answer=${r.event ?? r.answer}`, 'next=continue'];
    } else if (cmd === 'profile') said = setProfile(taskDir, pos[1], { scope: typeof o.scope === 'string' ? o.scope : undefined, until: typeof o.until === 'string' ? o.until : undefined, skip: typeof o.skip === 'string' ? o.skip.split(',').map((s) => s.trim()).filter(Boolean) : [] });
    else if (cmd === 'gate') said = recordGate(taskDir, pos[1], pos[2], { by: o.by, reason: o.reason, plan: typeof o.plan === 'string' ? o.plan : undefined });
    else if (cmd === 'round') {
      if (!o.step || !o.round || !o.handoff || !o.summary) throw new Error('round: --step, --round, --handoff and --summary are required');
      const r = recordRound(taskDir, { step: o.step, round: o.round, handoff: o.handoff, summary: o.summary, notes: o.notes });
      said = `round ${r.label} recorded · counter ${r.counter} · open blockers ${r.open}`;
    } else if (cmd === 'pause') said = setPause(taskDir, pos[1], o.until);
    else if (cmd === 'unpause') said = clearPause(taskDir);
    else said = `spawn logged: ${logSpawn(taskDir, o)}`;
  } catch (e) {
    console.error(`checkpoint: ${e.message}`);
    process.exit(2);
  }
  const errors = checkTask(taskDir);
  if (errors.length) {
    console.log(`written: ${said}`);
    console.error(`check-checkpoint failed:\n${errors.join('\n')}`);
    process.exit(1);
  }
  console.log(`OK ${said}`);
  for (const l of tail) console.log(l);
}
