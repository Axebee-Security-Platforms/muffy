#!/usr/bin/env node
// Reviewer miss-rate bench. Seeded defects + clean cases, scored on what the reviewer files as a Blocker.
//   node scripts/review-bench.mjs list
//   node scripts/review-bench.mjs run --out <dir> [--runs 2] [--all] [--model sonnet] [--effort high] [--case id] [--budget 1] [--yes]
//   node scripts/review-bench.mjs score <dir> [--json] [--gate] [--baseline evals/review-bench/baseline.json]
// `run` calls the model through `claude -p` and costs tokens: without --yes it only prints the plan.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CASES, buildPatch, scoreReview, aggregate, gate, buildSystemPrompt, userPrompt, locateDefects } from './lib/review-bench.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, ...rest] = process.argv.slice(2);
const flag = (n, d = null) => { const i = rest.indexOf(`--${n}`); return i < 0 ? d : (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true); };
// Node cannot spawn an npm .cmd shim without a shell, and a shell mangles the multi-line prompt:
// on Windows read the shim and run the claude executable it points to. CLAUDE_BIN overrides.
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
const pct = (v) => (v == null ? '  n/a' : `${(v * 100).toFixed(1)}%`.padStart(6));

const list = () => {
  for (const c of CASES) console.log(`${c.id.padEnd(20)} ${c.kind.padEnd(7)} expect ${c.expect.padEnd(7)} ${locateDefects(c).map((d) => `${d.id}${d.line ? `@${d.file}:${d.line}` : ''}`).join(', ') || '-'}`);
};

const run = () => {
  const out = flag('out');
  if (!out || out === true) { console.error('run needs --out <dir>'); process.exit(2); }
  const runs = Number(flag('runs', 2));
  const only = flag('case');
  const cases = CASES.filter((c) => (only ? c.id === only : flag('all') || c.core));
  const model = flag('model', 'sonnet');
  const effort = flag('effort', 'high');
  const budget = flag('budget', '1');
  const calls = cases.length * runs;
  console.log(`plan: ${cases.length} cases x ${runs} runs = ${calls} reviewer calls, model ${model}, effort ${effort}, max $${budget} each -> ${out}`);
  if (!flag('yes')) { console.log('dry run (nothing sent). Add --yes to run; this spends tokens.'); return; }
  mkdirSync(out, { recursive: true });
  const system = buildSystemPrompt();
  for (const c of cases) for (let k = 1; k <= runs; k++) {
    const dest = join(out, `${c.id}.r${k}.md`);
    if (existsSync(dest)) { console.log(`skip ${c.id} r${k} (exists)`); continue; }
    const work = mkdtempSync(join(tmpdir(), 'review-bench-'));
    try {
      const dir = join(work, '.team', c.id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'ac.md'), c.ac);
      writeFileSync(join(dir, 'contract.md'), c.contract);
      writeFileSync(join(dir, 'diff-1.patch'), buildPatch(c.files));
      const args = ['-p', '--system-prompt', system, '--model', model, '--effort', effort, '--tools', 'Read,Grep,Glob', '--allowedTools', 'Read', 'Grep', 'Glob', '--no-session-persistence', '--max-budget-usd', String(budget), '--output-format', 'text'];
      if (flag('bare')) args.push('--bare');
      const r = spawnSync(claudeBin(), args, { cwd: work, input: userPrompt(c.id), encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
      if (r.error || r.status !== 0) { console.error(`FAIL ${c.id} r${k}: ${r.error?.message ?? (r.stderr || '').slice(0, 300)}`); continue; }
      writeFileSync(dest, r.stdout);
      console.log(`done ${c.id} r${k}`);
    } finally { try { rmSync(work, { recursive: true, force: true, maxRetries: 3 }); } catch { /* temp dir may still be held by the child on Windows; the OS cleans it */ } }
  }
};

const score = () => {
  const dir = rest.find((a) => !a.startsWith('--'));
  if (!dir || !existsSync(dir)) { console.error('score needs a results dir'); process.exit(2); }
  const scores = [];
  for (const f of readdirSync(dir).filter((n) => /\.r\d+\.md$/.test(n)).sort()) {
    const c = CASES.find((x) => f.startsWith(x.id + '.r'));
    if (c) scores.push({ ...scoreReview(c, readFileSync(join(dir, f), 'utf8')), file: f });
  }
  if (!scores.length) { console.error('no <case>.r<k>.md files found'); process.exit(2); }
  const m = aggregate(scores);
  if (flag('json')) console.log(JSON.stringify({ metrics: m, runs: scores }, null, 2));
  else {
    for (const s of scores) console.log(`${s.file.padEnd(28)} verdict ${String(s.verdict).padEnd(7)} ${s.verdictOk ? 'ok ' : 'BAD'}  ${s.kind === 'clean' ? `false blockers ${s.falseBlockers}` : s.defects.map((d) => `${d.id}:${d.status}`).join(' ') + (s.extraBlockers ? ` (+${s.extraBlockers} extra)` : '')}`);
    console.log(`\nruns ${m.runs} · seeded defects ${m.defects} · clean runs ${m.clean_runs}`);
    console.log(`miss rate               ${pct(m.miss_rate)}   (defect not filed as a Blocker)`);
    console.log(`  hard miss             ${pct(m.hard_miss_rate)}   (not mentioned at all)`);
    console.log(`  demoted to suggestion ${pct(m.demotion_rate)}   (the cost of "unsure -> Suggestion")`);
    console.log(`false reject rate       ${pct(m.false_reject_rate)}   (clean case rejected or given a blocker)`);
    console.log(`false blockers / clean  ${m.false_blockers_per_clean_run ?? 'n/a'}`);
    console.log(`verdict accuracy        ${pct(m.verdict_accuracy)}${m.unparsed_runs ? `   unparsed runs: ${m.unparsed_runs}` : ''}`);
  }
  if (flag('gate')) {
    const base = JSON.parse(readFileSync(typeof flag('baseline') === 'string' ? flag('baseline') : join(root, 'evals/review-bench/baseline.json'), 'utf8'));
    const bad = gate(m, base);
    if (bad.length) { console.error('\nGATE FAIL:\n  ' + bad.join('\n  ')); process.exit(1); }
    console.log('\ngate: ok');
  }
};

if (cmd === 'list') list();
else if (cmd === 'run') run();
else if (cmd === 'score') score();
else { console.error('usage: review-bench.mjs list | run --out <dir> [--yes] | score <dir> [--gate]'); process.exit(2); }
