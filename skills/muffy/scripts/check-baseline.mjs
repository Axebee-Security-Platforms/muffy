#!/usr/bin/env node
// How far has the code moved since docs/architecture/baseline.md was written? (references/baseline-freshness.md)
//   node check-baseline.mjs [repo-root] [--baseline docs/architecture/baseline.md] [--yellow 10] [--red 40] [--json]
// Facts only, from git and the manifests; nothing is read from the source files and no .env* file is opened. Prints a colour and at most
// five reason lines. Thresholds: flags, else .team/baseline-thresholds.json {"yellow": n, "red": n}, else 10 and 40.
//   green   no stack mismatch, no cited path missing, fewer than `yellow` covered files changed since the baseline's commit
//   yellow  a cited path is missing, or `yellow` or more covered files changed, or the commit is not in this history
//   red     a runtime or dependency in the baseline differs (by major version) from the manifest, or `red` or more covered files changed,
//           or five or more cited paths are missing
// "Covered" = manifests, lockfiles, infra and CI files, files the baseline cites, and files under directories it cites.
// --json adds `depth`: quick (frontmatter `depth: quick`, onboard.md → Depth) or full. A missing baseline prints {"baseline":"missing"}.
// Exit 0 green, 1 yellow, 2 red, 3 baseline missing or bad usage.
import { basename } from 'node:path';
import { COVERED_FILE, inSkippedDir, loadExtensions, repoHelpers } from './repo-facts.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const root = args.find((a, i) => !a.startsWith('--') && !['--baseline', '--yellow', '--red'].includes(args[i - 1])) ?? '.';
const asJson = args.includes('--json');
const bad = args.filter((a) => a.startsWith('--') && !['--baseline', '--yellow', '--red', '--json'].includes(a));
if (bad.length) { console.error('usage: check-baseline.mjs [repo-root] [--baseline F] [--yellow N] [--red N] [--json]'); process.exit(3); }

const { has, readText: read, git } = repoHelpers(root);

const extManifests = loadExtensions(root).manifests;
const baselinePath = flag('--baseline') ?? 'docs/architecture/baseline.md';
const baseline = read(baselinePath);
if (baseline === null) { console.log(asJson ? JSON.stringify({ baseline: 'missing', depth: null, reasons: [] }) : 'baseline: missing'); process.exit(3); }
// a quick baseline (onboard.md → Depth) has only Read this first, Stack, Layout and Commands; a lane that needs more upgrades it
const depth = /^depth:\s*quick\b/im.test(baseline) ? 'quick' : 'full';

let limits = { yellow: 10, red: 40 };
try { limits = { ...limits, ...JSON.parse(read('.team/baseline-thresholds.json') ?? '{}') }; } catch { /* keep defaults */ }
if (flag('--yellow')) limits.yellow = Number(flag('--yellow'));
if (flag('--red')) limits.red = Number(flag('--red'));

const reasons = [];
let level = 0; // 0 green, 1 yellow, 2 red
const raise = (to, why) => { level = Math.max(level, to); reasons.push(why); };

const FILE_EXT = /\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|kts?|swift|dart|rb|php|cs|vue|svelte|md|ya?ml|toml|lock|gradle|sql|prisma|graphql|proto|tf|sh|ps1|html|s?css)$/i;

/* 1. paths the baseline cites must still exist (existence only; .env* is never opened) */
const cited = new Set(), dirs = new Set();
for (const m of baseline.matchAll(/`([^`\s]+)`/g)) {
  const tok = m[1].replace(/:\d+(-\d+)?$/, '');
  if (/^(https?:|[a-z]+:\/\/)/i.test(tok) || tok.includes('*') || tok.includes('<') || tok.startsWith('--')) continue;
  if (tok.endsWith('/')) dirs.add(tok.replace(/^\.\//, ''));
  else if (/\.[A-Za-z][A-Za-z0-9]{0,5}$/.test(tok) && /^[\w@./-]+$/.test(tok) && !/^\d/.test(tok)) {
    const p = tok.replace(/^\.\//, '');
    // `req.user`, `process.env`, `res.json` are code, not paths: a bare name counts only when it has a folder, is a manifest,
    // exists, or ends in a source-file extension that is never a property name
    if (p.includes('/') || COVERED_FILE.test(p) || has(p) || FILE_EXT.test(p)) cited.add(p);
  }
}
const missing = [...cited].filter((p) => !has(p));
if (missing.length >= 5) raise(2, `${missing.length} cited paths are missing: ${missing.slice(0, 3).join(', ')}, ...`);
else if (missing.length) raise(1, `${missing.length} cited path${missing.length > 1 ? 's' : ''} missing: ${missing.join(', ')}`);

/* 2. runtime and dependencies: a major version in the baseline that the manifest no longer has */
const major = (v) => String(v ?? '').replace(/^[^\d]*/, '').match(/^\d+/)?.[0];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// versions are read from the Stack and Runtime sections only (prose elsewhere says "200 ms" or "Next steps: 2"), and the number must
// follow the name directly: "next 14", "Next.js 14", "node@22", "python: 3.12"
const stackText = [...baseline.matchAll(/^#{1,3}[ \t]*([^\n]*)\n([\s\S]*?)(?=^#{1,3}[ \t]|$(?![\s\S]))/gm)]
  .filter((m) => /stack|runtime/i.test(m[1])).map((m) => m[2]).join('\n') || baseline;
const near = (name) => stackText.match(new RegExp(`(?<![\\w-])${esc(name)}(?:\\.js)?(?![\\w-])[\\s@:=^~v]{0,4}(\\d+(?:\\.\\d+)*)`, 'i'))?.[1];
const mismatches = [];
let pkg = null;
try { pkg = JSON.parse(read('package.json') ?? 'null'); } catch { /* not json */ }
for (const [name, ver] of Object.entries({ ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) })) {
  const said = near(name), actual = major(ver);
  if (said && actual && major(said) !== actual) mismatches.push(`${name}: baseline ${said}, manifest ${ver}`);
}
const pin = (file, label) => { const v = read(file)?.trim().split(/\r?\n/)[0]; const said = near(label); if (v && said && major(v) !== major(said)) mismatches.push(`${label}: baseline ${said}, ${file} ${v}`); };
pin('.nvmrc', 'node'); pin('.node-version', 'node'); pin('.python-version', 'python');
const goVer = read('go.mod')?.match(/^go\s+(\d+(?:\.\d+)*)/m)?.[1];
if (goVer && near('go') && major(near('go')) !== major(goVer) && /\bgo\s+\d/i.test(stackText)) mismatches.push(`go: baseline ${near('go')}, go.mod ${goVer}`);
if (mismatches.length) raise(2, `stack differs from the manifest: ${mismatches.slice(0, 3).join('; ')}`);

/* 3. how much of what the baseline covers changed since its commit */
const sha = baseline.match(/^commit:\s*([0-9a-f]{7,40})\b/im)?.[1];
if (!sha) raise(1, 'the baseline has no commit: line, so its age cannot be measured');
else if (git('cat-file', '-e', `${sha}^{commit}`) === null) raise(1, `commit ${sha} is not in this history (rebased or shallow clone)`);
else {
  const changed = (git('diff', '--name-only', `${sha}..HEAD`) ?? '').split('\n').filter(Boolean);
  // a file inside a dependency or build folder is never the project's own manifest, even when someone committed it, unless the baseline cites it
  const covered = changed.filter((f) => cited.has(f) || [...dirs].some((d) => f.startsWith(d)) || (!inSkippedDir(f) && (COVERED_FILE.test(basename(f)) || extManifests.includes(basename(f)) || f.startsWith('.github/workflows/'))));
  const note = `${covered.length} covered file${covered.length === 1 ? '' : 's'} changed since ${sha.slice(0, 7)} (${changed.length} in all)`;
  if (covered.length >= limits.red) raise(2, `${note}; red at ${limits.red}`);
  else if (covered.length >= limits.yellow) raise(1, `${note}; yellow at ${limits.yellow}`);
}

const color = ['green', 'yellow', 'red'][level];
if (asJson) console.log(JSON.stringify({ baseline: color, depth, reasons, limits }));
else console.log([`baseline: ${color}${depth === 'quick' ? ' (quick)' : ''}`, ...reasons.slice(0, 5).map((r) => `- ${r}`)].join('\n'));
process.exit(level);
