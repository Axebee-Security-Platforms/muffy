#!/usr/bin/env node
// Fix-lane cost bench (docs/plan/deterministic-next.md): the same three one-line bugs, each in a fresh fixture repo, run headless,
// so Orchestrator requests can be compared between versions of muffy.
//   node scripts/measure-fix.mjs prepare --out <dir>                 build the three repos and check each has one red test (no model)
//   node scripts/measure-fix.mjs run --out <dir> --permission-mode <acceptEdits|auto> [--runs 1] [--case id] [--model sonnet]
//                                    [--budget 3] [--plugin <muffy root>] [--yes]
//   node scripts/measure-fix.mjs score <dir>                         print the table again from the saved results
// `run` calls the model through `claude -p` and costs money: without --yes it only prints the plan. The permission mode has no
// default and bypassPermissions is refused. User settings and MCP servers are left out so both sides of a comparison load the same.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tokensIn } from '../skills/muffy/scripts/task-usage.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, ...rest] = process.argv.slice(2);
const flag = (n, d = null) => { const i = rest.indexOf(`--${n}`); return i < 0 ? d : (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true); };
const die = (msg) => { console.error(msg); process.exit(2); };

// Each case: the same library with exactly one function broken, so the test gate has nothing known-red left after the fix.
const FUNCTIONS = {
  itemCount: { good: 'return items.reduce((s, i) => s + i.qty, 0);', bad: 'return items.length;' },
  maxPrice: { good: 'return items.length ? Math.max(...items.map((i) => i.price)) : 0;', bad: 'return items.length ? Math.min(...items.map((i) => i.price)) : 0;' },
  lastItem: { good: 'return items[items.length - 1];', bad: 'return items[items.length];' },
};
export const CASES = [
  { id: 'item-count', fn: 'itemCount', request: 'itemCount in cart.js counts cart lines instead of units: itemCount([{price:10,qty:2},{price:5,qty:3}]) returns 2, expected 5' },
  { id: 'max-price', fn: 'maxPrice', request: 'maxPrice in cart.js returns the lowest unit price instead of the highest: maxPrice([{price:10,qty:1},{price:40,qty:2}]) returns 10, expected 40' },
  { id: 'last-item', fn: 'lastItem', request: 'lastItem in cart.js always returns undefined instead of the item added last: lastItem([{price:10,qty:1},{price:40,qty:2}]) returns undefined, expected {price:40,qty:2}' },
];

const cartJs = (broken) => `// A tiny cart: items are { price, qty }.
${Object.entries(FUNCTIONS).map(([name, f]) => `export function ${name}(items) {\n  ${name === broken ? f.bad : f.good}\n}\n`).join('\n')}`;
const TESTS = `import test from 'node:test';
import assert from 'node:assert/strict';
import { itemCount, maxPrice, lastItem } from '../cart.js';

const items = [{ price: 10, qty: 2 }, { price: 40, qty: 3 }];
test('itemCount sums the qty of every item', () => assert.equal(itemCount(items), 5));
test('maxPrice returns the highest unit price', () => assert.equal(maxPrice(items), 40));
test('lastItem returns the item added last', () => assert.deepEqual(lastItem(items), { price: 40, qty: 3 }));
`;
// onboarded already, so no run spends requests on onboarding
const baselineMd = (sha) => `---
commit: ${sha}
date: 2026-11-26
depth: quick
---

# Baseline

## Read this first

- Tiny ES-module library: \`cart.js\` exports \`itemCount\`, \`maxPrice\` and \`lastItem\` over items \`{ price, qty }\`.

## Stack

- Node.js, ES modules, no dependencies. Tests use \`node:test\`.

## Layout

- \`cart.js\`, \`test/cart.test.js\`, \`package.json\`.

## Commands

- Test: \`npm test\`.
`;

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const testsPass = (cwd) => spawnSync(process.execPath, ['--test'], { cwd, encoding: 'utf8' }).status === 0;

function buildRepo(dir, c) {
  if (existsSync(dir)) die(`${dir} already exists: use a new --out folder`);
  const write = (p, text) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); };
  write('cart.js', cartJs(c.fn));
  write('test/cart.test.js', TESTS);
  write('package.json', JSON.stringify({ name: 'bench-cart', version: '1.0.0', type: 'module', scripts: { test: 'node --test' } }, null, 2) + '\n');
  write('.gitignore', '.worktrees/\n.claude/\n');
  write('.claude/settings.local.json', JSON.stringify({ env: { MUFFY_GUARD: '1' } }, null, 2) + '\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.name', 'bench');
  git(dir, 'config', 'user.email', 'bench@example.test');
  git(dir, 'config', 'core.autocrlf', 'false');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init bench cart');
  write('docs/architecture/baseline.md', baselineMd(git(dir, 'rev-parse', 'HEAD')));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'docs(baseline): quick onboard');
  if (testsPass(dir)) die(`${c.id}: the fixture's tests pass, so the bug is not there`);
  const baseline = spawnSync(process.execPath, [join(root, 'skills', 'muffy', 'scripts', 'check-baseline.mjs'), dir], { encoding: 'utf8' });
  if (baseline.status !== 0) die(`${c.id}: the fixture's baseline is not green, so setup would refresh it:\n${baseline.stdout}`);
}

// Same shim handling as review-bench.mjs: Node cannot spawn an npm .cmd shim without a shell.
const claudeBin = () => {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform !== 'win32') return 'claude';
  for (const dir of (process.env.PATH ?? '').split(';')) {
    const shim = join(dir, 'claude.cmd');
    if (!existsSync(shim)) continue;
    const m = readFileSync(shim, 'utf8').match(/"%dp0%[\\/]([^"]+\.exe)"/i);
    if (m && existsSync(join(dir, m[1]))) return join(dir, m[1]);
  }
  return 'claude';
};

const records = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
function usageOf(session) {
  const projects = join(homedir(), '.claude', 'projects');
  const file = readdirSync(projects).map((d) => join(projects, d, `${session}.jsonl`)).find((f) => existsSync(f));
  if (!file) return null;
  const orch = tokensIn(records(file), 0, Infinity, { sidechain: false });
  const subDir = join(file.replace(/\.jsonl$/, ''), 'subagents');
  const subs = existsSync(subDir) ? readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).map((f) => tokensIn(records(join(subDir, f)), 0)) : [];
  return { requests: orch.requests, orchestratorUsd: orch.usd, subagentUsd: subs.reduce((a, t) => a + t.usd, 0), agents: subs.filter((t) => t.requests > 0).length, unpriced: orch.unpriced + subs.reduce((a, t) => a + t.unpriced, 0) };
}

// The fix counts only when a feature branch exists and its tests pass.
function fixedOn(repo) {
  const branch = git(repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/feature/').split('\n').filter(Boolean)[0];
  if (!branch) return false;
  const check = `${repo}-check`;
  git(repo, 'worktree', 'add', '-q', '--detach', check, branch);
  try { return testsPass(check); } finally { git(repo, 'worktree', 'remove', '--force', check); }
}

function score(out) {
  const files = readdirSync(out).filter((f) => f.endsWith('.result.json')).sort();
  if (!files.length) die(`no *.result.json in ${out}`);
  const rows = files.map((f) => JSON.parse(readFileSync(join(out, f), 'utf8')));
  for (const r of rows) console.log(`${r.id.padEnd(16)} ${r.fixed ? 'fixed ' : 'FAILED'} requests ${r.usage?.requests ?? 'n/a'} · orchestrator $${r.usage?.orchestratorUsd.toFixed(2) ?? 'n/a'} · subagents $${r.usage?.subagentUsd.toFixed(2) ?? 'n/a'} (${r.usage?.agents ?? 'n/a'}) · ${r.status} · muffy ${r.muffy}`);
  const ok = rows.filter((r) => r.fixed && r.usage);
  const mean = (get) => ok.reduce((a, r) => a + get(r), 0) / ok.length;
  console.log(ok.length ? `mean of ${ok.length}/${rows.length} fixed runs: ${mean((r) => r.usage.requests).toFixed(1)} requests · $${mean((r) => r.usage.orchestratorUsd + r.usage.subagentUsd).toFixed(2)}` : 'no fixed run to average');
}

function main() {
  if (cmd === 'score') return score(resolve(rest[0] ?? die('score needs a results dir')));
  if (cmd !== 'prepare' && cmd !== 'run') die('usage: measure-fix.mjs prepare|run|score (see the file header)');
  const outFlag = flag('out');
  if (!outFlag || outFlag === true) die(`${cmd} needs --out <dir>`);
  const out = resolve(outFlag);
  if (out.startsWith(resolve(root))) die('--out must be outside the muffy repo: a fixture inside it would inherit its settings and git history');
  const only = flag('case');
  const cases = CASES.filter((c) => !only || c.id === only);
  if (!cases.length) die(`no case ${only}`);

  if (cmd === 'prepare') {
    for (const c of cases) { buildRepo(join(out, c.id), c); console.log(`ready ${c.id}: tests red as expected`); }
    for (const c of cases) rmSync(join(out, c.id), { recursive: true, force: true });
    return;
  }
  const mode = flag('permission-mode');
  if (mode !== 'acceptEdits' && mode !== 'auto') die('run needs --permission-mode acceptEdits | auto');
  const runs = Number(flag('runs', 1));
  const model = flag('model', 'sonnet');
  const budget = flag('budget', '3');
  const plugin = resolve(flag('plugin', root));
  const muffy = git(plugin, 'describe', '--always', '--dirty');
  const claude = spawnSync(claudeBin(), ['--version'], { encoding: 'utf8' }).stdout?.trim() || 'unknown';
  // nothing from this machine's session reaches the run: a vault would get the bench's notes, a stray MUFFY_* would change the lane
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'SECOND_BRAIN_VAULT' && !k.startsWith('MUFFY_'))), MUFFY_HEADLESS: '1', MUFFY_GUARD: '1' };
  console.log(`plan: ${cases.length} cases x ${runs} runs, muffy ${muffy}, model ${model}, permission ${mode}, max $${budget} each -> ${out}`);
  if (!flag('yes')) { console.log('dry run (nothing sent). Add --yes to run; this spends money.'); return; }
  mkdirSync(out, { recursive: true });
  for (const c of cases) for (let k = 1; k <= runs; k++) {
    const id = `${c.id}.r${k}`;
    const dest = join(out, `${id}.result.json`);
    if (existsSync(dest)) { console.log(`skip ${id} (exists)`); continue; }
    const repo = join(out, id);
    buildRepo(repo, c);
    const session = randomUUID();
    const args = ['-p', `/muffy:muffy fix "${c.request}"`, '--plugin-dir', plugin, '--session-id', session, '--model', model,
      '--permission-mode', mode, '--setting-sources', 'project,local', '--strict-mcp-config', '--max-budget-usd', String(budget), '--output-format', 'json'];
    const r = spawnSync(claudeBin(), args, { cwd: repo, input: '', encoding: 'utf8', timeout: 1800000, maxBuffer: 64 * 1024 * 1024, env });
    writeFileSync(join(out, `${id}.claude.json`), r.stdout || r.stderr || String(r.error ?? ''));
    let reply = '', denials = null;
    try { const j = JSON.parse(r.stdout); reply = j.result ?? ''; denials = j.permission_denials?.length ?? null; } catch { /* not json: the raw output is saved */ }
    const status = reply.match(/muffy-status:\s*(\S+)/)?.[1] ?? (r.status === 0 ? 'finished' : `exit ${r.status ?? r.error?.code}`);
    writeFileSync(dest, JSON.stringify({ id, muffy, claude, model, permissionMode: mode, session, status, denials,fixed: fixedOn(repo), usage: usageOf(session) }, null, 2) + '\n');
    console.log(`done ${id}: ${status}`);
  }
  score(out);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
