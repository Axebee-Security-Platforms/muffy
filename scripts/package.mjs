#!/usr/bin/env node
// Stage a clean, shippable copy of the skill package into dist/muffy/ (allowlist, not blocklist),
// then fail if anything personal or VCS-related slipped in. Zip/tar dist/muffy yourself.
//   node scripts/package.mjs
import { cpSync, rmSync, mkdirSync, readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'muffy');
const INCLUDE = ['agents', 'skills', 'README.md', 'INSTALL.md', 'install.mjs', 'package.json', 'team-flow-settings-template.json', 'settings.local.json.template'];
const FORBIDDEN = [/(^|\/)\.git(\/|$)/, /(^|\/)settings\.local\.json$/, /(^|\/)\.DS_Store$/, /(^|\/)__MACOSX(\/|$)/, /(^|\/)node_modules(\/|$)/, /(^|\/)\.team(\/|$)/, /(^|\/)dist(\/|$)/];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of INCLUDE) {
  if (!existsSync(join(root, item))) continue;
  cpSync(join(root, item), join(out, item), { recursive: true, filter: (src) => !FORBIDDEN.some((re) => re.test(relative(root, src).split(sep).join('/'))) });
}

const files = [];
const walk = (d) => readdirSync(d).forEach((n) => { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); });
walk(out);
const bad = files.map((f) => relative(out, f).split(sep).join('/')).filter((r) => FORBIDDEN.some((re) => re.test(r)));
const personal = files.filter((f) => /\.(md|json|mjs|template)$/.test(f) && /\/Users\/[a-z0-9_.-]+\//i.test(readFileSync(f, 'utf8'))).map((f) => relative(out, f).split(sep).join('/'));
if (bad.length || personal.length) {
  console.error(`package: refused\n${[...bad.map((b) => `  forbidden file ${b}`), ...personal.map((p) => `  personal path in ${p}`)].join('\n')}`);
  process.exit(1);
}
const bytes = files.reduce((n, f) => n + statSync(f).size, 0);
console.log(`package: ${files.length} files, ${(bytes / 1024).toFixed(1)} KiB -> ${relative(root, out)}`);
