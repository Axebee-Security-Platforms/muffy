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
// Prints one line: `usage: orchestrator <n> · subagents <n> · total <n>[ · target <n>: under|over] (cache reads <n> not counted)`.
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
  const byReq = new Map();
  for (const r of lines) {
    if (r.type !== 'assistant' || r.isSidechain || !r.message?.usage) continue;
    const at = Date.parse(r.timestamp);
    if (at < sinceMs || at > untilMs) continue;
    const u = r.message.usage;
    const key = r.requestId ?? r.uuid;
    const mine = { fresh: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0), cacheRead: u.cache_read_input_tokens ?? 0 };
    const had = byReq.get(key);
    if (!had || mine.fresh > had.fresh) byReq.set(key, mine);
  }
  let fresh = 0; let cacheRead = 0;
  for (const v of byReq.values()) { fresh += v.fresh; cacheRead += v.cacheRead; }
  return { fresh, cacheRead, requests: byReq.size };
}

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
  const sub = subagentTokens(existsSync(join(task, 'spawns.tsv')) ? readFileSync(join(task, 'spawns.tsv'), 'utf8') : '');
  const since = o.since ?? taskStart(task);
  const file = o.transcript ?? newestTranscript(o.cwd ?? process.cwd());
  let orch = null;
  if (file && since && existsSync(file) && Number.isFinite(Date.parse(since))) {
    try {
      const recs = readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
      orch = orchestratorTokens(recs, Date.parse(since), o.until ? Date.parse(o.until) : Infinity);
    } catch { orch = null; }
  }
  const total = sub.total + (orch?.fresh ?? 0);
  const budget = o.budget === undefined ? null : Number(o.budget);
  const lessSure = !orch || sub.missing > 0;
  console.log([
    `usage: orchestrator ${orch ? fmt(orch.fresh) : 'n/a (no transcript or start time)'}`,
    `subagents ${fmt(sub.total)} (${sub.agents} agents${sub.missing ? `, ${sub.missing} spawn row(s) with no tok:` : ''})`,
    `total ${lessSure ? 'at least ' : ''}${fmt(total)}`,
    ...(budget ? [`target ${fmt(budget)}: ${total <= budget ? 'under' : 'over'}`] : []),
  ].join(' · ') + (orch ? ` (cache reads ${fmt(orch.cacheRead)} not counted; ${orch.requests} requests since ${since})` : ''));
}
