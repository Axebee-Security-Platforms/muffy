#!/usr/bin/env node
// Step 12: what the task cost, in US dollars, in two lines, so the cost can be compared with a target. No agent writes these numbers.
//   Orchestrator  this session's transcript, the assistant messages sent since the task began (the first commit of `.team/<task>/`,
//                 or --since <ISO time>), each API request once, priced by the model that answered it.
//   subagents     their own transcripts (<session>/subagents/*.jsonl), counted the same way. Subagents write their own transcripts,
//                 so nothing is subtracted from the Orchestrator's.
//   price         data/pricing.json (list prices per million tokens, with an as_of date): input, cache write (5 minutes or 1 hour,
//                 as each request used it), cache read and output. A model that is not in that file is not priced and is said so.
//
// Usage: node task-usage.mjs .team/<task> [--budget-usd <dollars>] [--since <ISO>] [--until <ISO>] [--transcript <file>] [--cwd <dir>]
//   until       default: now, which is right at step 12; set it only to measure a task that closed earlier in a longer session
//   cwd         the folder the Orchestrator session runs in (default: the current folder; a feature worktree is mapped to its main
//               repo, which is where the session started); picks ~/.claude/projects/<slug>/
//   transcript  default: the newest session file of that folder
// Prints `usage: $<total> (orchestrator $<n>, subagents $<n>)[ · target $<n>: under|over]` and a `tokens:` line (the counts behind it).
// Anything it cannot read or price is `n/a` and the total says `at least`: never an estimate. `spawns.tsv` carries token counts only,
// not prices, so it is no source of dollars. Exit 0 always except bad usage (2): the line is a report, not a gate.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const PRICING = JSON.parse(readFileSync(join(here, '..', 'data', 'pricing.json'), 'utf8'));

// Price of one request's usage in dollars, or null when its model has no price. `u` is the usage object of an assistant message.
// A cache write is priced by the TTL it used (usage.cache_creation splits it); with no split it is taken as a 5-minute write.
export function requestCost(model, u, pricing = PRICING) {
  const p = pricing.models[String(model ?? '').replace(/-\d{8}$/, '')];
  if (!p) return null;
  const write = u.cache_creation_input_tokens ?? 0;
  const w1h = u.cache_creation?.ephemeral_1h_input_tokens;
  const w5m = u.cache_creation?.ephemeral_5m_input_tokens;
  const split = w1h !== undefined || w5m !== undefined;
  const writeCost = split ? (w5m ?? 0) * p.write5m + (w1h ?? 0) * p.write1h + Math.max(0, write - (w5m ?? 0) - (w1h ?? 0)) * p.write5m : write * p.write5m;
  const prompt = (u.input_tokens ?? 0) + write + (u.cache_read_input_tokens ?? 0);
  const factor = p.longPromptAbove && prompt > p.longPromptAbove ? p.longPromptFactor : 1;
  return (factor * ((u.input_tokens ?? 0) * p.in + writeCost + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.output_tokens ?? 0) * p.out)) / 1e6;
}

// The tokens and the dollars of a list of parsed transcript records, inside a window. Each requestId counts once, with its largest
// output (a streamed reply is logged in pieces). `sidechain`: false keeps the Orchestrator's own records only (a subagent's own file
// is read with `true`, which keeps everything).
export function tokensIn(records, sinceMs, untilMs = Infinity, { sidechain = true } = {}) {
  const byReq = new Map();
  for (const r of records) {
    if (r.type !== 'assistant' || !r.message?.usage) continue;
    if (!sidechain && r.isSidechain) continue;
    const at = Date.parse(r.timestamp);
    if (at < sinceMs || at > untilMs) continue;
    const key = r.requestId ?? r.uuid;
    const had = byReq.get(key);
    if (!had || (r.message.usage.output_tokens ?? 0) > (had.message.usage.output_tokens ?? 0)) byReq.set(key, r);
  }
  const t = { fresh: 0, cacheRead: 0, requests: byReq.size, usd: 0, unpriced: 0, models: {} };
  for (const r of byReq.values()) {
    const u = r.message.usage;
    t.fresh += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0);
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    const c = requestCost(r.message.model, u);
    if (c === null) t.unpriced++; else t.usd += c;
    const m = r.message.model ?? 'unknown';
    t.models[m] = (t.models[m] ?? 0) + 1;
  }
  return t;
}
export const orchestratorTokens = (records, sinceMs, untilMs = Infinity) => tokensIn(records, sinceMs, untilMs, { sidechain: false });

const fmt = (n) => n.toLocaleString('en-US').replace(/,/g, ' ');
const usd = (n) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
const slugOf = (cwd) => resolve(cwd).replace(/[^A-Za-z0-9]/g, '-');

// A feature worktree (.worktrees/feature-<task>) is a folder of its own to Claude Code's transcript naming, but the session that
// runs the task started in the main repo: try the folder itself, then the main repo of the git checkout it is in.
function transcriptDirs(cwd) {
  const dirs = [resolve(cwd)];
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (common) dirs.push(dirname(common));
  } catch { /* not a git folder */ }
  return [...new Set(dirs)].map((d) => join(homedir(), '.claude', 'projects', slugOf(d))).filter((d) => existsSync(d));
}

function newestTranscript(cwd) {
  const files = transcriptDirs(cwd).flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => ({ f: join(dir, f), t: statSync(join(dir, f)).mtimeMs })));
  return files.sort((a, b) => b.t - a.t)[0]?.f ?? null;
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
  if (!task || !existsSync(task) || (o['budget-usd'] !== undefined && !(Number(o['budget-usd']) > 0))) {
    console.error('usage: task-usage.mjs .team/<task> [--budget-usd <dollars>] [--since <ISO>] [--until <ISO>] [--transcript <file>] [--cwd <dir>]');
    process.exit(2);
  }
  const since = o.since ?? taskStart(task);
  const until = o.until ? Date.parse(o.until) : Infinity;
  const file = o.transcript ?? newestTranscript(o.cwd ?? task);
  const read = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const windowOk = since && Number.isFinite(Date.parse(since));
  let orch = null;
  if (file && windowOk && existsSync(file)) {
    try { orch = orchestratorTokens(read(file), Date.parse(since), until); } catch { orch = null; }
  }
  // the subagents' transcripts sit next to the session file: <session>/subagents/agent-*.jsonl, with a .meta.json naming each role
  const subDir = file && join(file.replace(/\.jsonl$/, ''), 'subagents');
  let subs = null;
  if (windowOk && subDir && existsSync(subDir)) {
    try {
      subs = readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).map((f) => {
        let role = f.replace(/\.jsonl$/, '');
        try { role = JSON.parse(readFileSync(join(subDir, f.replace(/\.jsonl$/, '.meta.json')), 'utf8')).agentType.replace(/^muffy:/, ''); } catch { /* keep the file name */ }
        return { role, ...tokensIn(read(join(subDir, f)), Date.parse(since), until) };
      }).filter((t) => t.requests > 0);
    } catch { subs = null; }
  }
  const sub = subs && subs.length ? { usd: subs.reduce((a, t) => a + t.usd, 0), fresh: subs.reduce((a, t) => a + t.fresh, 0), cacheRead: subs.reduce((a, t) => a + t.cacheRead, 0), unpriced: subs.reduce((a, t) => a + t.unpriced, 0) } : null;
  const unpriced = (orch?.unpriced ?? 0) + (sub?.unpriced ?? 0);
  const total = (orch?.usd ?? 0) + (sub?.usd ?? 0);
  const complete = !!orch && !!sub && unpriced === 0;
  const budget = o['budget-usd'] === undefined ? null : Number(o['budget-usd']);
  console.log([
    `usage: ${complete ? '' : 'at least '}${usd(total)}`,
    `orchestrator ${orch ? usd(orch.usd) : 'n/a (no session transcript or start time)'}`,
    `subagents ${sub ? usd(sub.usd) : 'n/a (no subagent transcripts)'}`,
    ...(budget ? [`target ${usd(budget)}: ${total > budget ? 'over' : complete ? 'under' : 'cannot tell (a part is missing)'}`] : []),
  ].join(' · '));
  console.log(`tokens: ${[
    orch ? `orchestrator ${fmt(orch.fresh)} fresh + ${fmt(orch.cacheRead)} cache read in ${orch.requests} requests since ${since}` : null,
    sub ? `subagents ${fmt(sub.fresh)} fresh + ${fmt(sub.cacheRead)} cache read in ${subs.length} agents (${subs.map((t) => `${t.role} ${usd(t.usd)}`).join(', ')})` : null,
  ].filter(Boolean).join(' · ') || 'n/a'}; ${PRICING.as_of} list prices${unpriced ? `; ${unpriced} request(s) on a model with no price are left out` : ''}`);
}
