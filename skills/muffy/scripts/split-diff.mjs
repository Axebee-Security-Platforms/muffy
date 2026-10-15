#!/usr/bin/env node
// Split a large unified diff into one patch per review topic, so code-reviewer reads one concern at a time.
// Usage: node split-diff.mjs <diff-n.patch> [--max-lines 1500] [--max-files 15] [--rules rules.json] [--force]
//   rules.json: [{ "topic": "db-migration", "match": "regex on the file path" }, ...]; first match wins, before the defaults.
// Writes next to the input: <name>-<topic>.patch for every topic and <name>-index.md (topic -> files).
// Exit 0 = split written or not needed, 1 = verification failed, 2 = bad usage / unreadable.
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i === -1 ? dflt : args[i + 1];
};
const file = args.find((a, i) => !a.startsWith('--') && !['--max-lines', '--max-files', '--rules'].includes(args[i - 1]));
if (!file) {
  console.error('usage: split-diff.mjs <diff-n.patch> [--max-lines N] [--max-files N] [--rules rules.json] [--force]');
  process.exit(2);
}
const maxLines = Number(opt('--max-lines', 1500));
const maxFiles = Number(opt('--max-files', 15));
const force = args.includes('--force');

let text;
let userRules = [];
try {
  text = readFileSync(file, 'utf8');
  const rf = opt('--rules');
  if (rf) userRules = JSON.parse(readFileSync(rf, 'utf8')).map((r) => ({ topic: r.topic, re: new RegExp(r.match) }));
} catch (e) {
  console.error(`cannot read: ${e.message}`);
  process.exit(2);
}

// --- parse into per-file blocks (text preserved byte for byte) ---
const starts = [...text.matchAll(/^diff --git /gm)].map((m) => m.index);
const files = starts.map((s, i) => {
  const body = text.slice(s, starts[i + 1] ?? text.length);
  const head = body.slice(0, body.indexOf('\n'));
  const m = head.match(/^diff --git a\/(.+?) b\/(.+)$/);
  const path = (m ? m[2] : head.slice(11)).replace(/^"|"$/g, '');
  const lines = (body.match(/\n/g) || []).length;
  return { path, body, lines };
});
if (!files.length || text.slice(0, starts[0]).trim()) {
  console.error('not a git unified diff (no leading "diff --git" blocks)');
  process.exit(2);
}
const totalLines = files.reduce((n, f) => n + f.lines, 0);
if (!force && totalLines <= maxLines && files.length <= maxFiles) {
  console.log(`no split needed: ${files.length} files, ${totalLines} lines (limits ${maxFiles} files / ${maxLines} lines)`);
  process.exit(0);
}

// --- topic assignment ---
const INFRA = /(^|\/)(Dockerfile[^/]*|docker-compose[^/]*|\.nvmrc|\.github\/.*|package(-lock)?\.json|pnpm-lock\.yaml|Cargo\.(toml|lock)|.*\.md|docs\/.*|smoke\/.*)$/i;
const MIGRATION = /(^|\/)migrations?\/|\.sql$/i;
const TEST = /(\.test\.[jt]sx?|\.spec\.[jt]sx?|_tests?\.rs|_test\.go|(^|\/)test_[^/]+\.py)$|(^|\/)(tests?|__tests__)\//;
const stem = (p) =>
  basename(p).replace(/\.(test|spec)(?=\.)/, '').replace(/_tests?(?=\.)/, '').replace(/\.[^.]+$/, '');
const slug = (s) => s.replace(/[^A-Za-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'root';

const sources = files.filter((f) => !TEST.test(f.path) && !INFRA.test(f.path) && !MIGRATION.test(f.path));
const bySource = new Map();
for (const f of sources) {
  const k = stem(f.path);
  if (!bySource.has(k)) bySource.set(k, []);
  bySource.get(k).push(f);
}
// The path a file is grouped under: a test borrows the path of the source it tests.
const groupPath = (f) => {
  if (TEST.test(f.path)) {
    const cand = (bySource.get(stem(f.path)) || []).map((s) => s.path).sort();
    if (cand.length) return cand[0];
  }
  return f.path;
};

const fixed = new Map(); // topic -> files from rules / infra / migration
const open = new Map(); // top dir -> files to split by depth
const put = (m, k, f) => (m.has(k) ? m.get(k).push(f) : m.set(k, [f]));
for (const f of files) {
  const rule = userRules.find((r) => r.re.test(f.path));
  if (rule) put(fixed, rule.topic, f);
  else if (MIGRATION.test(f.path)) put(fixed, 'db-migration', f);
  else if (INFRA.test(f.path)) put(fixed, 'infra-docs-smoke', f);
  else put(open, groupPath(f).split('/')[0], f);
}

// Split a group by the next path segment until each part fits maxLines (or cannot split further).
const size = (fs) => fs.reduce((n, f) => n + f.lines, 0);
function splitDepth(prefix, fs, depth) {
  if (size(fs) <= maxLines) return [{ topic: prefix, files: fs }];
  const parts = new Map();
  for (const f of fs) {
    const segs = groupPath(f).split('/');
    const key = segs.length - 1 > depth ? segs[depth] : '';
    put(parts, key, f);
  }
  if (parts.size === 1) {
    const only = [...parts.keys()][0];
    return depth > 20 ? [{ topic: prefix, files: fs }] : splitDepth(only ? `${prefix}-${slug(only)}` : prefix, fs, depth + 1);
  }
  return [...parts].flatMap(([k, g]) => splitDepth(k ? `${prefix}-${slug(k)}` : `${prefix}-root`, g, depth + 1));
}

let topics = [];
for (const [top, fs] of open) topics.push(...splitDepth(slug(top), fs, 1).map((t) => ({ ...t, top: slug(top) })));

// Merge small leftovers of the same top dir (sorted by name) into one "<top>-misc" topic, up to maxLines.
const SMALL = Math.max(100, Math.floor(maxLines / 7));
const merged = [];
for (const top of new Set(topics.map((t) => t.top))) {
  const mine = topics.filter((t) => t.top === top).sort((a, b) => a.topic.localeCompare(b.topic));
  let bucket = null;
  for (const t of mine) {
    if (size(t.files) >= SMALL) { merged.push(t); continue; }
    if (bucket && size(bucket.files) + size(t.files) <= maxLines) bucket.files.push(...t.files);
    else { bucket = { topic: `${top}-misc`, top, files: [...t.files] }; merged.push(bucket); }
  }
}
topics = merged;
for (const [topic, fs] of fixed) topics.push({ topic, files: fs });
// A lone "-misc" with one file takes that file's topic name instead.
for (const t of topics) if (t.topic.endsWith('-misc') && t.files.length === 1) t.topic = slug(`${t.top}-${basename(t.files[0].path).replace(/\.[^.]+$/, '')}`);
// Drop generic path tokens from names (nms-ingest-src-db -> nms-ingest-db).
for (const t of topics) t.topic = t.topic.split('-').filter((w, i) => i === 0 || !['src', 'app', 'features', 'lib'].includes(w)).join('-');
// Unique names.
const seen = new Map();
for (const t of topics) {
  const n = (seen.get(t.topic) || 0) + 1;
  seen.set(t.topic, n);
  if (n > 1) t.topic = `${t.topic}-${n}`;
}
topics.sort((a, b) => a.topic.localeCompare(b.topic));

// --- verify: every file exactly once, bytes preserved ---
const placed = topics.flatMap((t) => t.files.map((f) => f.path));
const dup = placed.filter((p, i) => placed.indexOf(p) !== i);
const bytesIn = Buffer.byteLength(text);
const bytesOut = topics.reduce((n, t) => n + t.files.reduce((m, f) => m + Buffer.byteLength(f.body), 0), 0);
if (placed.length !== files.length || dup.length || bytesIn !== bytesOut) {
  console.error(`verification failed: ${files.length} files in, ${placed.length} placed, duplicates [${dup}], bytes ${bytesIn} vs ${bytesOut}`);
  process.exit(1);
}

// --- write ---
const dir = dirname(resolve(file));
const prefix = basename(file).replace(/\.patch$/, '');
for (const f of readdirSync(dir)) {
  if (f.startsWith(`${prefix}-`) && f.endsWith('.patch')) unlinkSync(join(dir, f)); // stale topics from an earlier run
}
const index = [`# ${prefix} topics`, '', `Source: ${basename(file)} (${files.length} files, ${totalLines} lines). One line per topic, then its files.`, ''];
for (const t of topics) {
  writeFileSync(join(dir, `${prefix}-${t.topic}.patch`), t.files.map((f) => f.body).join(''));
  index.push(`## ${t.topic} (${t.files.length} files, ${size(t.files)} lines) -> ${prefix}-${t.topic}.patch`);
  for (const f of t.files.sort((a, b) => a.path.localeCompare(b.path))) index.push(`- ${f.path} (${f.lines})`);
  index.push('');
}
writeFileSync(join(dir, `${prefix}-index.md`), index.join('\n'));
console.log(`split ${files.length} files / ${totalLines} lines into ${topics.length} topics in ${dir}`);
for (const t of topics) console.log(`  ${prefix}-${t.topic}.patch  ${t.files.length} files  ${size(t.files)} lines`);
