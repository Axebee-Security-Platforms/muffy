#!/usr/bin/env node
// Finds unfinished work before muffy takes over a repo. Zero dependencies, Node 18+, read-only, offline.
//   node scan-pending.mjs [repo-root] [--out <file>] [--import <source>=<file>]... [--max-items N] [--max-age-days N]
//                         [--stale-days N (default 90)] [--redact "Name,Customer"]
// Sources: git (uncommitted, stashes, unmerged branches, linked worktrees), code markers (TODO/FIXME,
// skipped tests), and tracker exports (--import jira=issues.csv, github=issues.json, ...).
//
// Privacy, enforced here and nowhere else (every outside string passes through this file):
//   - never opens the network. A tracker is read from an export file the user supplies, or from JSON the
//     Orchestrator fetched through the user's own connector or CLI and saved to a file
//   - reads a whitelist of columns (id, title, status, url, updated). Description, comments, assignee,
//     reporter and labels are never read, so they cannot leak into the output
//   - redacts emails, phone-like numbers, tokens, key=value secrets, long opaque strings and any --redact terms; strips url query and fragment
//   - code markers and uncommitted files are counted by file, never quoted; .env* is never opened
//   - output has no author, person or absolute path
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validate } from './schema.mjs';

const SOURCES = ['github', 'gitlab', 'jira', 'clickup', 'linear', 'other'];
const CLOSED = new Set(['done', 'closed', 'resolved', 'cancelled', 'canceled', 'complete', 'completed', 'merged', 'wontfix', "won't do", 'rejected', 'shipped', 'released', 'duplicate', 'invalid']);
const PRIVACY = 'minimised: no description, comment, assignee or reporter; urls stripped of query and fragment; secrets and emails redacted';

/* ---------- sanitising: the one chokepoint for outside text ---------- */

export function sanitizeUrl(u) {
  if (typeof u !== 'string') return undefined;
  try {
    const p = new URL(u.trim());
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return undefined;
    return `${p.origin}${p.pathname}`;
  } catch {
    return undefined;
  }
}

// Names of people or customers cannot be detected by pattern. The user lists them: --redact "Acme,Alice"
let extraTerms = [];
export function setRedactTerms(terms) {
  extraTerms = terms.map((t) => t.trim()).filter((t) => t.length >= 2).map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
}

export function sanitizeText(s, max = 120) {
  let t = String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  t = t
    .replace(/https?:\/\/[^\s)>\]]+/gi, (m) => sanitizeUrl(m) ?? '[url]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|glpat-[\w-]{15,}|xox[baprs]-[\w-]{10,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,})/g, '[secret]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [secret]')
    .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key|authorization)\s*[:=]\s*\S+/gi, '$1=[secret]')
    .replace(/\b[A-Za-z0-9+/_-]{32,}={0,2}/g, '[secret]')
    // phone, card or national-id like runs: 9 or more digits once spaces, dashes and dots are ignored (a date has 8)
    .replace(/(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[number]' : m));
  for (const re of extraTerms) t = t.replace(re, '[redacted]');
  const chars = Array.from(t);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : t;
}

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

export function normalizeDate(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : /^\d{10,13}$/.test(String(v).trim()) ? Number(v) : NaN;
  const d = Number.isNaN(n) ? new Date(String(v)) : new Date(n < 1e11 ? n * 1000 : n);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/* ---------- reading an export: whitelist only ---------- */

export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  const [head = [], ...body] = rows;
  // duplicate header names (Jira repeats "Labels", "Sprint"): keep the first, which is enough for the whitelist
  return body.map((r) => {
    const o = {};
    head.forEach((h, i) => { if (!(h in o)) o[h] = r[i] ?? ''; });
    return o;
  });
}

const FIELDS = {
  id: ['key', 'issuekey', 'id', 'number', 'iid', 'identifier', 'taskid', 'customid'],
  title: ['title', 'summary', 'name', 'taskname', 'subject'],
  status: ['status', 'state', 'statusname'],
  url: ['url', 'htmlurl', 'weburl', 'link', 'permalink'],
  updated: ['updated', 'updatedat', 'dateupdated', 'lastupdated', 'modified'],
};

// read only the whitelisted keys; Jira nests them under `fields`, so look there too
function pick(rec) {
  const flat = new Map();
  const add = (o) => { for (const [k, v] of Object.entries(o)) if (!flat.has(normKey(k))) flat.set(normKey(k), v); };
  add(rec);
  if (rec.fields && typeof rec.fields === 'object') add(rec.fields);
  const out = {};
  for (const [field, names] of Object.entries(FIELDS)) {
    for (const n of names) {
      if (!flat.has(n)) continue;
      let v = flat.get(n);
      if (v && typeof v === 'object') v = v.name ?? v.status ?? v.state ?? v.value ?? undefined;
      if (v !== undefined && v !== null && String(v) !== '') { out[field] = v; break; }
    }
  }
  return out;
}

export function recordsOf(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const k of ['issues', 'items', 'tasks', 'nodes', 'results', 'data']) if (Array.isArray(parsed[k])) return parsed[k];
    for (const v of Object.values(parsed)) if (v && typeof v === 'object' && Array.isArray(v.nodes)) return v.nodes;
  }
  return [];
}

const STALE_DEFAULT = 90;
const isStale = (date, days) => Boolean(date) && Date.now() - Date.parse(date) > days * 86400000;

export function normalizeRecords(records, source, branches = [], staleDays = STALE_DEFAULT) {
  const items = [];
  let dropped = 0;
  for (const rec of records) {
    if (!rec || typeof rec !== 'object') { dropped++; continue; }
    const f = pick(rec);
    const status = f.status === undefined ? undefined : sanitizeText(f.status, 40);
    if (status && CLOSED.has(status.toLowerCase())) { dropped++; continue; }
    if (f.title === undefined) { dropped++; continue; }
    let id = f.id === undefined ? `row-${items.length + 1}` : String(f.id);
    if ((source === 'github' || source === 'gitlab') && /^\d+$/.test(id)) id = `#${id}`;
    id = sanitizeText(id, 80);
    const it = { source, id, title: sanitizeText(f.title) };
    if (status) it.status = status;
    const url = sanitizeUrl(f.url);
    if (url) it.url = url;
    const updated = normalizeDate(f.updated);
    if (updated) it.updated = updated;
    if (isStale(updated, staleDays)) it.stale = true;
    const bare = id.replace(/^#/, '');
    if (bare.length >= 2) {
      const re = new RegExp(`(^|[^0-9a-z])${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^0-9a-z]|$)`, 'i');
      const hit = branches.find((b) => re.test(b));
      if (hit) it.linkedBranch = sanitizeText(hit);
    }
    items.push(it);
  }
  return { items, dropped };
}

export function readExport(file, source, branches, staleDays) {
  const text = readFileSync(file, 'utf8');
  const records = /\.json$/i.test(file) || /^\s*[[{]/.test(text) ? recordsOf(JSON.parse(text)) : parseCsv(text);
  return normalizeRecords(records, source, branches, staleDays);
}

/* ---------- local scan: git and code markers ---------- */

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.team', '.worktrees', '.claude', 'venv', '.venv', '__pycache__', 'target', 'vendor', 'coverage']);
const SRC_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php', '.cs', '.swift']);
const MARKER = /\b(TODO|FIXME|HACK|XXX)\b/;
const SKIPPED_TEST = /\b(?:it|test|describe)\.skip\b|\bx(?:it|describe)\(|@pytest\.mark\.skip|@Ignore\b|\bt\.Skip\(/;
const isTestFile = (n) => /\.(test|spec)\.[a-z]+$/.test(n) || /^test_.*\.py$/.test(n) || /_test\.(go|py)$/.test(n);
const MAX_FILES = 20000;
const MAX_BYTES = 1_000_000;

export function scanLocal(root, staleDays = STALE_DEFAULT) {
  const git = (...a) => {
    try {
      return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return null;
    }
  };
  const items = [];
  const sources = [];
  const branches = [];
  const inGit = git('rev-parse', '--is-inside-work-tree') === 'true';

  if (inGit) {
    const status = (git('status', '--porcelain') ?? '').split(/\r?\n/).filter(Boolean);
    if (status.length) {
      const untracked = status.filter((l) => l.startsWith('??')).length;
      const staged = status.filter((l) => !l.startsWith('??') && l[0] !== ' ').length;
      items.push({ source: 'git-uncommitted', id: 'working-tree', title: `${status.length} uncommitted changes (${staged} staged, ${untracked} untracked)`, status: 'uncommitted' });
    }
    sources.push({ name: 'git-uncommitted', kind: 'git', count: status.length ? 1 : 0 });

    const stashes = (git('stash', 'list', '--format=%gd|%cd', '--date=short') ?? '').split(/\r?\n/).filter(Boolean);
    for (const s of stashes) {
      const [id, date] = s.split('|');
      items.push({ source: 'git-stash', id, title: 'stashed changes', status: 'stashed', ...(normalizeDate(date) ? { updated: normalizeDate(date) } : {}) });
    }
    sources.push({ name: 'git-stash', kind: 'git', count: stashes.length });

    branches.push(...(git('for-each-ref', 'refs/heads', '--format=%(refname:short)') ?? '').split(/\r?\n/).filter(Boolean));
    const head = git('rev-parse', '--abbrev-ref', 'HEAD');
    const base = ['origin/main', 'origin/master', 'main', 'master'].find((b) => git('rev-parse', '--verify', '--quiet', b) !== null) ?? head;
    let unmerged = [];
    if (base) {
      unmerged = (git('branch', '--no-merged', base, '--format=%(refname:short)|%(committerdate:short)') ?? '')
        .split(/\r?\n/).filter(Boolean).map((l) => l.split('|')).filter(([n]) => n !== base);
    }
    const CAP = 50;
    for (const [name, date] of unmerged.slice(0, CAP)) {
      const ahead = Number(git('rev-list', '--count', `${base}..${name}`)) || 0;
      items.push({ source: 'git-branch', id: sanitizeText(name, 80), title: `${ahead} commit${ahead === 1 ? '' : 's'} not in ${base}`, status: 'unmerged', ...(normalizeDate(date) ? { updated: normalizeDate(date) } : {}), ...(isStale(normalizeDate(date), staleDays) ? { stale: true } : {}) });
    }
    sources.push({ name: 'git-branch', kind: 'git', count: Math.min(unmerged.length, CAP), ...(unmerged.length > CAP ? { dropped: unmerged.length - CAP, truncated: true } : {}) });

    // linked worktrees: the branch only, never the path (a path leaks the user's directory names)
    const wt = (git('worktree', 'list', '--porcelain') ?? '').split(/\r?\n\r?\n/).slice(1);
    let wtCount = 0;
    for (const block of wt) {
      const b = block.match(/^branch refs\/heads\/(.+)$/m)?.[1];
      if (!b) continue;
      wtCount++;
      items.push({ source: 'git-worktree', id: sanitizeText(b, 80), title: 'linked worktree', status: 'open' });
    }
    sources.push({ name: 'git-worktree', kind: 'git', count: wtCount });
  }

  // code markers, per file, no quoted text. Symlinks are skipped so a link cannot lead outside the repo
  const todo = new Map();
  const skipped = new Map();
  let walked = 0;
  let truncated = false;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (walked >= MAX_FILES) { truncated = true; return; }
      if (e.isSymbolicLink()) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p); continue; }
      walked++;
      if (e.name.startsWith('.env') || !SRC_EXT.has(extname(e.name))) continue;
      let txt;
      try {
        if (statSync(p).size > MAX_BYTES) continue;
        txt = readFileSync(p, 'utf8');
      } catch { continue; }
      const rel = relative(root, p).split('\\').join('/');
      let t = 0;
      let s = 0;
      const test = isTestFile(e.name);
      for (const line of txt.split(/\r?\n/)) {
        if (MARKER.test(line)) t++;
        if (test && SKIPPED_TEST.test(line)) s++;
      }
      if (t) todo.set(rel, t);
      if (s) skipped.set(rel, s);
    }
  };
  walk(root);
  const CAP_FILES = 50;
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, map, source, label] of [['code-todo', todo, 'code-todo', 'TODO/FIXME marker'], ['skipped-test', skipped, 'skipped-test', 'skipped test']]) {
    const rows = top(map);
    for (const [file, n] of rows.slice(0, CAP_FILES)) items.push({ source, id: sanitizeText(file, 80), title: `${n} ${label}${n === 1 ? '' : 's'}`, status: 'open' });
    sources.push({ name, kind: 'code', count: Math.min(rows.length, CAP_FILES), ...(rows.length > CAP_FILES ? { dropped: rows.length - CAP_FILES, truncated: true } : {}) });
  }
  if (truncated) sources.push({ name: 'walk-limit', kind: 'code', count: 0, truncated: true });
  return { items, sources, branches };
}

/* ---------- main ---------- */

export function buildReport(root, imports, { maxItems = 200, maxAgeDays = 0, staleDays = STALE_DEFAULT } = {}) {
  const local = scanLocal(root, staleDays);
  const items = [...local.items];
  const sources = [...local.sources];
  for (const { source, file } of imports) {
    const { items: got, dropped } = readExport(file, source, local.branches, staleDays);
    let kept = got;
    let aged = 0;
    if (maxAgeDays > 0) {
      const cutoff = Date.now() - maxAgeDays * 86400000;
      kept = got.filter((i) => !i.updated || Date.parse(i.updated) >= cutoff);
      aged = got.length - kept.length;
    }
    kept.sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''));
    const room = kept.slice(0, maxItems);
    items.push(...room);
    sources.push({ name: `${source}-export`, kind: 'tracker-export', count: room.length, dropped: dropped + aged + (kept.length - room.length), ...(kept.length > room.length ? { truncated: true } : {}) });
  }
  return { generated: new Date().toISOString(), root: '.', privacy: PRIVACY, sources, items };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const take = (flag) => {
    const out = [];
    for (let i = 0; i < args.length; i++) if (args[i] === flag) out.push(args[i + 1]);
    return out;
  };
  const flagged = new Set(['--out', '--import', '--max-items', '--max-age-days', '--stale-days', '--redact']);
  const positional = args.filter((a, i) => !a.startsWith('--') && !flagged.has(args[i - 1]));
  const root = resolve(positional[0] ?? '.');
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`error: not a directory: ${root}`);
    process.exit(1);
  }
  const imports = take('--import').map((spec) => {
    const i = (spec ?? '').indexOf('=');
    const source = i > 0 ? spec.slice(0, i) : '';
    const file = i > 0 ? spec.slice(i + 1) : '';
    if (!SOURCES.includes(source) || !file) {
      console.error(`error: --import wants <source>=<file>, source one of ${SOURCES.join(', ')}; got "${spec}"`);
      process.exit(1);
    }
    if (!existsSync(file)) {
      console.error(`error: export file not found: ${file}`);
      process.exit(1);
    }
    return { source, file: resolve(file) };
  });
  const num = (flag, d) => (take(flag)[0] === undefined ? d : Number(take(flag)[0]));
  setRedactTerms((take('--redact')[0] ?? '').split(','));
  const report = buildReport(root, imports, { maxItems: num('--max-items', 200), maxAgeDays: num('--max-age-days', 0), staleDays: num('--stale-days', STALE_DEFAULT) });
  const schema = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'pending.schema.json'), 'utf8'));
  const errs = validate(schema, report);
  if (errs.length) {
    console.error(`error: report failed pending.schema.json, nothing written:\n${errs.slice(0, 10).join('\n')}`);
    process.exit(2);
  }
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const outFile = take('--out')[0];
  if (outFile) {
    mkdirSync(dirname(resolve(outFile)), { recursive: true });
    writeFileSync(resolve(outFile), json);
    console.log(`pending written: ${outFile} (${report.items.length} items from ${report.sources.length} sources)`);
  } else {
    process.stdout.write(json);
  }
}
