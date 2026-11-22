#!/usr/bin/env node
// Step 12: the task's token cost in one line, so the cost can be compared with a target. No agent writes these numbers.
//   subagents     the `tok:` values in `.team/<task>/spawns.tsv`, the last value of each role + step (they are cumulative per agent)
//   Orchestrator  this session's transcript, the assistant messages sent since the task began (the first commit of `.team/<task>/`,
//                 or --since <ISO time>): input + cache-write + output tokens, each API request once. Cache reads are listed
//                 apart and left out of the total (a long session re-reads its context every turn, which is not new work).
//                 Subagents write their own transcripts, so nothing is subtracted.
//
// Usage: node task-usage.mjs .team/<task> [--budget <tokens>] [--since <ISO>] [--until <ISO>] [--transcript <file>] [--cwd <dir>]
//   until       default: now, which is right at step 12; set it only to measure a task that closed earlier in a longer session
//   cwd         the folder the Orchestrator session runs in (default: the current folder); picks ~/.claude/projects/<slug>/
//   transcript  default: the newest session file of that folder
// Prints `usage: orchestrator <n> · subagents <n> · total <n>[ · target <n>: under|over] (cache reads <n> not counted)`, then a
// `cost-weighted:` line: the same tokens priced (cache write 1.25x, cache read 0.1x, output 5x), where the Orchestrator's context
// re-read on every turn and the agents' output show up. The target is on the first line only.
// A transcript it cannot find or read gives `orchestrator n/a` and the total says `at least`: never an estimate.
// Exit 0 always except bad usage (2): the line is a report, not a gate.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// last `tok:` value of each role + step in spawns.tsv, summed; rows with no tok: are counted in `missing`
export function subagentTokens(tsv) {
  const last = new Map();
  let missing = 0;
  for (const line of String(tsv ?? '').replace(/\r\n/g, '\n').split('\n').filter(Boolean)) {
    const cols = line.split('\t');
    const tok = line.match(/\btok:(\d+)/)?.[1];
    if (tok === undefined) { missing++; continue; }
    last.set(`${cols[0]}|${cols[1]}`, Number(tok));
  }
  return { total: [...last.values()].reduce((a, b) => a + b, 0), agents: last.size, missing };
}

// lines: parsed transcript records. Each requestId counts once, with its largest usage (a streamed reply is logged in pieces).
export function orchestratorTokens(lines, sinceMs, untilMs = Infinity) {
  return tokensIn(lines.filter((r) => !r.isSidechain), sinceMs, untilMs);
}

// the same count over any list of records; a subagent's own transcript is summed with this directly
export function tokensIn(lines, sinceMs, untilMs = Infinity) {
  const byReq = new Map();
  for (const r of lines) {
    if (r.type !== 'assistant' || !r.message?.usage) continue;
    const at = Date.parse(r.timestamp);
    if (at < sinceMs || at > untilMs) continue;
    const u = r.message.usage;
    const key = r.requestId ?? r.uuid;
    const mine = { input: u.input_tokens ?? 0, write: u.cache_creation_input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0 };
    mine.fresh = mine.input + mine.write + mine.output;
    const had = byReq.get(key);
    if (!had || mine.fresh > had.fresh) byReq.set(key, mine);
  }
  const t = { fresh: 0, input: 0, write: 0, output: 0, cacheRead: 0, requests: byReq.size };
  for (const v of byReq.values()) for (const k of ['fresh', 'input', 'write', 'output', 'cacheRead']) t[k] += v[k];
  return { ...t, weighted: weighted(t) };
}

// What the tokens cost, in units of one fresh input token, at the standard price ratios: cache write 1.25x, cache read 0.1x,
// output 5x. An estimate for comparing runs (a 1-hour cache write costs more than 1.25x): the fresh total ignores the cache reads
// that a long context pays on every turn, and weights an output token like an input token. The target stays on the fresh total.
export const WEIGHTS = { input: 1, write: 1.25, cacheRead: 0.1, output: 5 };
export const weighted = (t) => Math.round(t.input * WEIGHTS.input + t.write * WEIGHTS.write + t.cacheRead * WEIGHTS.cacheRead + t.output * WEIGHTS.output);

const fmt = (n) => n.toLocaleString('en-US').replace(/,/g, ' ');
const slugOf = (cwd) => resolve(cwd).replace(/[^A-Za-z0-9]/g, '-');

function newestTranscript(cwd) {
  const dir = join(homedir(), '.claude', 'projects', slugOf(cwd));
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => ({ f: join(dir, f), t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  return files[0]?.f ?? null;
}

function taskStart(task) {
  try {
    const out = execFileSync('git', ['log', '--reverse', '--format=%aI', '--', '.'], { cwd: task, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').filter(Boolean)[0] ?? null;
  } catch { return null; }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const o = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) argv[i].startsWith('--') ? (o[argv[i].slice(2)] = argv[++i]) : pos.push(argv[i]);
  const task = pos[0] && resolve(pos[0]);
  if (!task || !existsSync(task) || (o.budget !== undefined && !(Number(o.budget) > 0))) {
    console.error('usage: task-usage.mjs .team/<task> [--budget <tokens>] [--since <ISO>] [--until <ISO>] [--transcript <file>] [--cwd <dir>]');
    process.exit(2);
  }
  const tsv = existsSync(join(task, 'spawns.tsv')) ? readFileSync(join(task, 'spawns.tsv'), 'utf8') : '';
  let sub = subagentTokens(tsv);
  const since = o.since ?? taskStart(task);
  const until = o.until ? Date.parse(o.until) : Infinity;
  const file = o.transcript ?? newestTranscript(o.cwd ?? process.cwd());
  const read = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const windowOk = since && Number.isFinite(Date.parse(since));
  let orch = null;
  if (file && windowOk && existsSync(file)) {
    try { orch = orchestratorTokens(read(file), Date.parse(since), until); } catch { orch = null; }
  }
  // spawns.tsv is the Orchestrator's own log and may be missing or short; the subagents' transcripts sit next to the session file
  // (<session>/subagents/*.jsonl), so with no usable log they are read from there, counted the same way as the Orchestrator's
  let subFrom = 'spawns.tsv';
  const subDir = file && join(file.replace(/\.jsonl$/, ''), 'subagents');
  let subT = null; // the subagents' transcripts: the fallback for the total, and the only source of the cost-weighted figure
  if (windowOk && subDir && existsSync(subDir)) {
    try {
      const per = readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).map((f) => tokensIn(read(join(subDir, f)), Date.parse(since), until)).filter((t) => t.requests > 0);
      subT = { total: per.reduce((a, t) => a + t.fresh, 0), agents: per.length, weighted: per.reduce((a, t) => a + t.weighted, 0) };
    } catch { subT = null; }
  }
  if ((sub.agents === 0 || sub.missing > 0) && subT && subT.agents > 0) {
    sub = { total: subT.total, agents: subT.agents, missing: 0 };
    subFrom = 'transcripts';
  }
  const subKnown = sub.agents > 0 && sub.missing === 0;
  const total = sub.total + (orch?.fresh ?? 0);
  const budget = o.budget === undefined ? null : Number(o.budget);
  const complete = !!orch && subKnown;
  console.log([
    `usage: orchestrator ${orch ? fmt(orch.fresh) : 'n/a (no transcript or start time)'}`,
    subKnown ? `subagents ${fmt(sub.total)} (${sub.agents} agents, from ${subFrom})` : `subagents n/a (no spawns.tsv log and no subagent transcripts${sub.missing ? `; ${sub.missing} spawn row(s) with no tok:` : ''})`,
    `total ${complete ? '' : 'at least '}${fmt(total)}`,
    ...(budget ? [`target ${fmt(budget)}: ${total > budget ? 'over' : complete ? 'under' : 'cannot tell (a part is missing)'}`] : []),
  ].join(' · ') + (orch ? ` (cache reads ${fmt(orch.cacheRead)} not counted; ${orch.requests} requests since ${since})` : ''));
  // the second line: the same run priced, so a rule that cuts turns or output shows up (the fresh total above cannot see either)
  if (orch && subT) {
    const w = orch.weighted + subT.weighted;
    console.log(`cost-weighted: ${fmt(w)} input-equivalents (orchestrator ${fmt(orch.weighted)} = ${Math.round((100 * orch.weighted) / w)}%, subagents ${fmt(subT.weighted)}; cache write ${WEIGHTS.write}x, cache read ${WEIGHTS.cacheRead}x, output ${WEIGHTS.output}x of an input token; an estimate for comparing runs, no target)`);
  } else {
    console.log('cost-weighted: n/a (needs the session transcript and the subagents\' transcripts)');
  }
}
