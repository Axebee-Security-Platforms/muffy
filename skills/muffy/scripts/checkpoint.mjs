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
// Prints one verdict line. Exit 0 = written and checked, 1 = written but check-checkpoint failed, 2 = usage or input error.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTask } from './check-checkpoint.mjs';
import { LOOP_LIMIT } from './next-action.mjs';
import { GATES, PAUSE_OF, laneOf, gateState, redesignScope } from './gate-rules.mjs';
import { gate2b, gate3c } from './gate-summary.mjs';

export const PAUSES = ['scope', 'scope-upgrade', 'onboard-review', 'todo-review', 'plan-review', 'design-review', 'full-regression', 'human-gate'];
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
  if (['feature', 'redesign'].includes(laneOf(text))) {
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

// The user's answer at a human gate. `approve` needs the pause saved first (the question was asked) and a ready
// gate summary; `reject` keeps the pause; `skip` needs a reason and is refused where the gate cannot be skipped.
export function recordGate(taskDir, gate, action, { by, reason, plan } = {}) {
  if (!GATES.includes(gate)) throw new Error(`gate: ${gate} is not a gate (${GATES.join(', ')})`);
  if (!['approve', 'reject', 'skip'].includes(action)) throw new Error('gate: action is approve, reject or skip');
  const cpPath = join(taskDir, 'checkpoint.md');
  if (!existsSync(cpPath)) throw new Error(`missing ${cpPath}`);
  const text = readFileSync(cpPath, 'utf8');
  const lane = laneOf(text);
  const pause = `paused at pause:${PAUSE_OF[gate]}`;
  const paused = (parse(text).sections.find((s) => s.name === 'Status')?.body ?? []).some((l) => l.includes(pause));
  const date = new Date().toISOString().slice(0, 10);
  const cp = parse(text);
  const status = body(cp, 'Status');
  let line;

  if (action === 'skip') {
    if (!reason?.trim()) throw new Error('gate skip: --reason is required');
    if (gate === '2b' && lane === 'feature') throw new Error('gate 2b cannot be skipped in the feature lane (only fix, lite and a ui-only redesign skip it)');
    if (gate === '2b' && lane === 'redesign' && redesignScope(text) !== 'ui-only') throw new Error('gate 2b can be skipped only in a ui-only redesign, where the AC are approved with the design at 3c');
    if (gate === '3c' && existsSync(join(taskDir, 'design.md'))) throw new Error('gate 3c cannot be skipped: design.md exists, so a designer ran');
    if (gate === '3c' && lane === 'redesign' && existsSync(join(taskDir, 'contract.md'))) throw new Error('gate 3c cannot be skipped: contract.md exists, so the user approves the contract here');
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
  if (!['round', 'pause', 'unpause', 'spawn', 'gate'].includes(cmd) || !taskDir) {
    console.error('usage: checkpoint.mjs round|pause|unpause|spawn|gate <.team/<task>> ... (see the header of this file)');
    process.exit(2);
  }
  let said;
  try {
    if (cmd === 'gate') said = recordGate(taskDir, pos[1], pos[2], { by: o.by, reason: o.reason, plan: typeof o.plan === 'string' ? o.plan : undefined });
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
}
