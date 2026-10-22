#!/usr/bin/env node
// What changed since docs/architecture/baseline.md was written? Input for an onboard refresh (references/onboard.md, 0b).
//   node baseline-delta.mjs [repo-root] [--baseline docs/architecture/baseline.md] [--max 800] [--json]
// Facts only, from git: prints `mode: refresh` with the changed paths grouped by folder and the baseline lines that cite a changed
// path, or `mode: full` with the reason (no baseline, no commit line, commit not in history, or more than --max files changed).
// Reads no source file and opens no .env*. Exit 0 refresh, 1 full, 3 bad usage.
import { inSkippedDir, repoHelpers } from './repo-facts.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const root = args.find((a, i) => !a.startsWith('--') && !['--baseline', '--max'].includes(args[i - 1])) ?? '.';
const bad = args.filter((a) => a.startsWith('--') && !['--baseline', '--max', '--json'].includes(a));
if (bad.length) { console.error('usage: baseline-delta.mjs [repo-root] [--baseline F] [--max N] [--json]'); process.exit(3); }
const max = Number(flag('--max') ?? 800);
const { readText: read, git } = repoHelpers(root);

const out = (o) => {
  if (args.includes('--json')) console.log(JSON.stringify(o));
  else console.log([`mode: ${o.mode}`, ...(o.reason ? [`- ${o.reason}`] : []), ...(o.since ? [`since: ${o.since}`] : []),
    ...(o.groups?.length ? ['changed (folder: files, status):', ...o.groups.map((g) => `- ${g.dir}: ${g.count} (${g.status})`)] : []),
    ...(o.cited?.length ? ['baseline lines citing a changed path:', ...o.cited.map((c) => `- L${c.line}: ${c.path}`)] : [])].join('\n'));
  process.exit(o.mode === 'refresh' ? 0 : 1);
};

const baseline = read(flag('--baseline') ?? 'docs/architecture/baseline.md');
if (baseline === null) out({ mode: 'full', reason: 'no baseline yet' });
const sha = baseline.match(/^commit:\s*([0-9a-f]{7,40})\b/im)?.[1];
if (!sha) out({ mode: 'full', reason: 'the baseline has no commit: line' });
if (git('cat-file', '-e', `${sha}^{commit}`) === null) out({ mode: 'full', reason: `commit ${sha} is not in this history` });

const rows = (git('diff', '--name-status', '--no-renames', `${sha}..HEAD`) ?? '').split('\n').filter(Boolean)
  .map((l) => { const [s, ...p] = l.split('\t'); return { s, p: p.join('\t') }; }).filter((r) => !inSkippedDir(r.p) && !/^docs\/architecture\/baseline(\.md|\/)/.test(r.p));
if (rows.length > max) out({ mode: 'full', reason: `${rows.length} files changed since ${sha.slice(0, 7)}; more than ${max}` });

const byDir = new Map();
for (const { s, p } of rows) {
  const parts = p.split('/');
  const dir = parts.length > 2 ? parts.slice(0, 2).join('/') : parts.length === 2 ? parts[0] : '.';
  const g = byDir.get(dir) ?? { dir, count: 0, kinds: new Set() };
  g.count++; g.kinds.add(s); byDir.set(dir, g);
}
const label = { A: 'added', M: 'modified', D: 'deleted' };
const groups = [...byDir.values()].sort((a, b) => b.count - a.count)
  .map((g) => ({ dir: g.dir, count: g.count, status: [...g.kinds].map((k) => label[k] ?? k).join('/') }));

const changed = rows.map((r) => r.p);
const cited = [];
baseline.split(/\r?\n/).forEach((text, i) => {
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const tok = m[1].replace(/:\d+(-\d+)?$/, '').replace(/^\.\//, '');
    if (tok.length > 2 && changed.some((f) => f === tok || (tok.endsWith('/') && f.startsWith(tok)))) { if (!cited.some((c) => c.line === i + 1 && c.path === tok)) cited.push({ line: i + 1, path: tok }); }
  }
});
out({ mode: 'refresh', since: sha, groups: groups.slice(0, 25), cited: cited.slice(0, 40) });
