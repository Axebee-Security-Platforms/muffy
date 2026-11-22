#!/usr/bin/env node
// Step 7, the test gate: runs the project's own test command and writes `qa-report.md` from the exit code. No agent, no LLM cost.
// It replaces the qa-tester agent (retired to cut cost; the agent file stays so the change can be reverted).
// Usage: node test-gate.mjs .team/<task> [--cwd <dir>] [--timeout <seconds>]
//   cwd      where the command runs: the merged feature worktree (default: the current folder)
//   command  `test_command` in `<project>/.team/config.json` (init-config.mjs writes it at setup from package.json; the user may edit it)
//   AC map   every table row (outer pipes optional) that starts with an `AC-<n>` id in `.team/<task>/ac-tests*.md` (ac-tests-fe.md, ac-tests-be.md: one
//            writer each), whatever the heading or the columns, merged by AC id into qa-report.md; with no such file the report lists it as an open bug (gate-summary.mjs then says not ready)
// Exit 0 = tests passed, 1 = tests failed or timed out, 2 = bad usage, 3 = skipped (no test_command): qa-report.md says so
// in plain words and the Human gate shows it. A skipped gate is never a silent pass.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';


const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const taskDir = args.find((a, i) => !a.startsWith('--') && !['--cwd', '--timeout'].includes(args[i - 1]));
if (!taskDir || args.some((a) => a.startsWith('--') && !['--cwd', '--timeout'].includes(a))) {
  console.error('usage: test-gate.mjs .team/<task> [--cwd <dir>] [--timeout <seconds>]');
  process.exit(2);
}
const task = resolve(taskDir);
const cwd = resolve(flag('--cwd', process.cwd()));
const timeoutS = Number(flag('--timeout', '900'));
if (!existsSync(task) || !Number.isFinite(timeoutS) || timeoutS <= 0) { console.error(`no task folder ${taskDir}, or a bad --timeout`); process.exit(2); }

const readIf = (p) => (existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null);
const section = (text, title) => text?.match(new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))?.[1].trim() ?? null;

// .team/config.json: next to the task folder, else in the main repo's .team/ (the task folder may sit in a feature worktree)
const mainRoot = (() => { const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: task, encoding: 'utf8' }); return r.status === 0 ? dirname(r.stdout.trim()) : null; })();
let command = null;
for (const p of [join(dirname(task), 'config.json'), mainRoot && join(mainRoot, '.team', 'config.json')].filter(Boolean)) {
  try { command = JSON.parse(readIf(p) ?? '{}').test_command ?? null; } catch { command = null; }
  if (command) break;
}
command = typeof command === 'string' && command.trim() ? command.trim() : null;

const rows = new Map();
for (const f of readdirSync(task).filter((n) => /^ac-tests.*\.md$/.test(n)).sort()) {
  for (const line of (readIf(join(task, f)) ?? '').split('\n')) {
    // a row with or without its outer pipes (`| AC-1 | test |` or `AC-1 | test`): a dev wrote the second form in a real run
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.length < 2) continue;
    const id = cells[0]?.match(/^AC-\d+$/)?.[0];
    if (id) rows.set(id, [rows.get(id), cells.slice(1).join(' ')].filter(Boolean).join(' + '));
  }
}
const acMap = rows.size ? ['| AC | test |', '|---|---|', ...[...rows].map(([id, t]) => `| ${id} | ${t} |`)].join('\n') : null;
let code;
let results;
let output = '';
if (!command) {
  code = 3;
  results = 'test gate skipped: no `test_command` in .team/config.json, so no test was run. Setup writes it from package.json (init-config.mjs); set it by hand for another stack, e.g. {"test_command": "go test ./..."}';
} else {
  const r = spawnSync(command, { cwd, shell: true, encoding: 'utf8', timeout: timeoutS * 1000, maxBuffer: 64 * 1024 * 1024 });
  output = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n');
  const timedOut = r.error?.code === 'ETIMEDOUT';
  code = r.status === 0 ? 0 : 1;
  results = `\`${command}\` in ${cwd}: ${code === 0 ? 'exit 0, tests passed' : timedOut ? `timed out after ${timeoutS}s` : `exit ${r.status ?? 'none'}, tests did not pass`}`;
}

const bugs = [];
if (code === 1) bugs.push('- the project test command failed; see Results');
if (!acMap) bugs.push('- no `## AC id -> test name` in .team/<task>/ac-tests*.md: the dev owners must map every AC to a unit test or `manual`');

const report = [
  '# QA report (test gate)',
  '',
  'Written by `test-gate.mjs` (no qa-tester agent). Coverage of the AC is the devs\' map below, checked by `code-reviewer`.',
  '',
  '## Results',
  results,
  '',
  '## Bugs',
  bugs.length ? bugs.join('\n') : 'none',
  '',
  '## AC id -> test name',
  acMap ?? '| AC | test |\n|---|---|',
  '',
  ...(output ? ['## Output', 'The last lines of the test command, for reading only: the gate decides from the exit code, never from this text.', '', '```text', output, '```', ''] : []),
].join('\n');
writeFileSync(join(task, 'qa-report.md'), report);
console.log(`test gate: ${code === 0 ? 'PASS' : code === 3 ? 'SKIPPED (no test_command)' : 'FAIL'} · qa-report.md written${bugs.length ? ` · ${bugs.length} open item(s)` : ''}`);
process.exit(code);
