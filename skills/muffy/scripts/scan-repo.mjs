#!/usr/bin/env node
// Heuristic repo scan that seeds `/muffy onboard`. Zero dependencies, Node 18+, read-only.
//   node scan-repo.mjs [repo-root] [--out <file>]
// Prints JSON (or writes it to --out). Facts only: no opinions, no file contents beyond manifests.
// .env* files are listed by name and never opened.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, extname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? args[outIdx + 1] : undefined;
const root = resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out') ?? '.');
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`error: not a directory: ${root}`);
  process.exit(1);
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.team', '.worktrees', '.claude', 'venv', '.venv', '__pycache__', 'target', 'vendor', 'coverage']);
const SRC_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php', '.cs', '.swift']);
const MAX_FILES = 20000;

const has = (p) => existsSync(join(root, p));
const readText = (p) => (has(p) ? readFileSync(join(root, p), 'utf8') : null);
const readJson = (p) => {
  try {
    return JSON.parse(readText(p));
  } catch {
    return null;
  }
};
const list = (p) => (has(p) && statSync(join(root, p)).isDirectory() ? readdirSync(join(root, p)) : []);

// bounded walk: source counts, test files, env file names
const srcByExt = {};
const testFiles = [];
const envFiles = [];
let walked = 0;
let truncated = false;
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (walked >= MAX_FILES) {
      truncated = true;
      return;
    }
    if (e.isDirectory()) {
      if (!SKIP.has(e.name)) walk(join(dir, e.name));
      continue;
    }
    walked++;
    const rel = relative(root, join(dir, e.name)).split('\\').join('/');
    if (e.name.startsWith('.env')) envFiles.push(rel);
    const ext = extname(e.name);
    if (SRC_EXT.has(ext)) srcByExt[ext] = (srcByExt[ext] ?? 0) + 1;
    if (/\.(test|spec)\.[a-z]+$/.test(e.name) || /^test_.*\.py$/.test(e.name) || /_test\.(go|py)$/.test(e.name)) testFiles.push(rel);
  }
};
walk(root);

const manifests = ['package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'composer.json', 'Gemfile'].filter(has);

// node
const pkg = readJson('package.json');
const allDeps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
const KNOWN = {
  frontend: ['next', 'react', 'vue', 'nuxt', 'svelte', '@sveltejs/kit', 'astro', '@angular/core', 'solid-js', 'vite', 'tailwindcss'],
  backend: ['express', 'fastify', '@nestjs/core', 'koa', 'hono', 'trpc', '@trpc/server', 'graphql', 'apollo-server'],
  data: ['prisma', '@prisma/client', 'drizzle-orm', 'typeorm', 'mongoose', 'sequelize', 'knex', 'pg', 'mysql2', 'redis', 'ioredis'],
  testing: ['vitest', 'jest', 'mocha', '@playwright/test', 'cypress', '@testing-library/react'],
  quality: ['typescript', 'eslint', 'prettier', 'biome', '@biomejs/biome'],
};
const detected = Object.fromEntries(Object.entries(KNOWN).map(([k, names]) => [k, names.filter((n) => n in allDeps).map((n) => `${n}@${allDeps[n]}`)]));
const lockfile = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb', 'bun.lock'].find(has) ?? null;
const scripts = pkg?.scripts ?? {};
const pickScripts = Object.fromEntries(['dev', 'start', 'build', 'test', 'lint', 'typecheck', 'format'].filter((k) => k in scripts).map((k) => [k, scripts[k]]));

// python (names only, crude on purpose)
const pyText = `${readText('requirements.txt') ?? ''}\n${readText('pyproject.toml') ?? ''}`.toLowerCase();
const python = ['django', 'flask', 'fastapi', 'sqlalchemy', 'alembic', 'pytest', 'celery', 'pydantic'].filter((n) => new RegExp(`(^|[^a-z0-9_-])${n}([^a-z0-9_-]|$)`).test(pyText));

// runtime pins
const pins = {};
for (const f of ['.nvmrc', '.node-version', '.python-version', '.tool-versions', '.ruby-version']) if (has(f)) pins[f] = readText(f).trim().split(/\r?\n/).slice(0, 5).join('; ');
if (pkg?.engines) pins['package.json engines'] = JSON.stringify(pkg.engines);

// infra and CI
const infra = [
  ...['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yaml', 'vercel.json', 'netlify.toml', 'fly.toml', 'serverless.yml', 'render.yaml', 'Procfile', '.gitlab-ci.yml', 'Jenkinsfile'].filter(has),
  ...list('.github/workflows').map((f) => `.github/workflows/${f}`),
  ...['terraform', 'infra', 'k8s', 'helm', 'deploy'].filter((d) => list(d).length),
];

// existing docs
const docs = {
  readme: ['README.md', 'README'].find(has) ?? null,
  claudeMd: has('CLAUDE.md'),
  agentsMd: has('AGENTS.md'),
  contributing: has('CONTRIBUTING.md'),
  docsDir: list('docs'),
  adrCount: list('docs/adr').filter((f) => f.endsWith('.md')).length,
  hasBaseline: has('docs/architecture/baseline.md'),
};

// structure: top-level dirs, plus children of the usual monorepo / source roots
const topDirs = list('.').filter((n) => !SKIP.has(n) && !n.startsWith('.') && statSync(join(root, n)).isDirectory());
const children = Object.fromEntries(['src', 'app', 'apps', 'packages', 'services', 'libs', 'lib'].filter((d) => topDirs.includes(d)).map((d) => [d, list(d).filter((n) => !n.startsWith('.') && statSync(join(root, d, n)).isDirectory())]));
const monorepo = ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'].filter(has).concat(pkg?.workspaces ? ['package.json#workspaces'] : []);

// UI evidence: decides whether onboarding also writes docs/design-system/
const designTokens = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tokens.json', 'design-tokens.json', 'theme.ts', 'theme.js'].filter(has);
const ui = detected.frontend.some((d) => !d.startsWith('vite@')) || designTokens.length > 0 || has('docs/design-system');

// git
const git = (...a) => {
  try {
    return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const sourceFiles = Object.values(srcByExt).reduce((n, c) => n + c, 0);
const result = {
  generated: new Date().toISOString(),
  root: root.split('\\').join('/'),
  hasCode: sourceFiles > 0,
  git: { head: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), commits: Number(git('rev-list', '--count', 'HEAD')) || null },
  manifests,
  sourceFiles: { total: sourceFiles, byExtension: srcByExt, truncated },
  node: pkg ? { name: pkg.name ?? null, packageManager: lockfile, scripts: pickScripts, detected } : null,
  python: python.length ? python : null,
  runtimePins: pins,
  structure: { topDirs, children, monorepo },
  tests: { files: testFiles.length, sample: testFiles.slice(0, 5) },
  infra,
  docs,
  ui: { likely: ui, tokenFiles: designTokens },
  envFiles: { names: envFiles, note: 'listed by name only, never opened' },
};

const json = `${JSON.stringify(result, null, 2)}\n`;
if (outFile) {
  mkdirSync(dirname(resolve(outFile)), { recursive: true });
  writeFileSync(resolve(outFile), json);
  console.log(`scan written: ${outFile}`);
} else {
  process.stdout.write(json);
}
