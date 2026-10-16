#!/usr/bin/env node
// Offline eval suite. No LLM calls: it checks that the specs (output-format / quality-checks /
// schemas) are enforceable, that golden fixtures satisfy them, and that the Orchestrator loop
// rules behave as documented on mock multi-agent scenarios.
//   node scripts/eval.mjs                 run everything
//   node scripts/eval.mjs --update-rubric re-sync evals/agents/*.eval.json `rubric` from quality-checks.md
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../skills/muffy/scripts/schema.mjs';
import { simulate } from './lib/loop-sim.mjs';
import { runFixLaneEvals } from './lib/fix-lane-evals.mjs';
import { runPendingEvals } from './lib/pending-evals.mjs';
import { chooseEffort, defaultEffort, PROTECTED_ROLES, STALLED_AFTER } from './lib/effort-sim.mjs';
import { smokeRequired, SMOKE_TRIGGERS } from './lib/smoke-sim.mjs';
import { checkTask } from '../skills/muffy/scripts/check-artifacts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...p) => join(root, ...p);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const handoffSchema = readJson(rel('skills/muffy/schemas/handoff.schema.json'));
const update = process.argv.includes('--update-rubric');

let pass = 0;
const failures = [];
const check = (name, ok, detail = '') => { if (ok) pass++; else failures.push(`${name}${detail ? ` - ${detail}` : ''}`); };

const rubricOf = (role) =>
  readFileSync(rel('agents/references', role, 'quality-checks.md'), 'utf8')
    .split(/\r?\n/).filter((l) => /^- /.test(l)).map((l) => l.replace(/^- (\[ \] )?/, '').trim());

const fixtureDir = rel('evals/fixtures/login-flow/.team/login-flow');
const TASK = 'login-flow';
const read = (name) => readFileSync(join(fixtureDir, name), 'utf8');

/* 1. agent evals: spec sync, golden artifacts, golden hand-off, negative controls */
for (const f of readdirSync(rel('evals/agents')).filter((n) => n.endsWith('.eval.json'))) {
  const ev = readJson(rel('evals/agents', f));
  const role = ev.role;
  const n = `agent:${role}`;

  check(`${n} has agent definition`, existsSync(rel('agents', `${role}.md`)));
  const live = rubricOf(role);
  if (update) { ev.rubric = live; writeFileSync(rel('evals/agents', f), JSON.stringify(ev, null, 2) + '\n'); }
  check(`${n} rubric in sync with quality-checks.md`, JSON.stringify(ev.rubric) === JSON.stringify(live), 'run: node scripts/eval.mjs --update-rubric, then review the live_scenarios');
  check(`${n} has >=2 live scenarios with must/must_not`, ev.live_scenarios?.length >= 2 && ev.live_scenarios.every((s) => s.must?.length && s.must_not?.length));

  for (const art of ev.artifacts) {
    const p = join(fixtureDir, art.path.replace(`.team/{task}/`, ''));
    const txt = existsSync(p) ? readFileSync(p, 'utf8') : null;
    check(`${n} fixture ${art.path} exists`, txt !== null);
    if (txt === null) continue;
    if (art.first_line) check(`${n} ${art.path} first line matches /${art.first_line}/`, new RegExp(art.first_line).test(txt.trimStart().split(/\r?\n/)[0]));
    for (const pat of art.must_match) check(`${n} ${art.path} matches /${pat}/`, new RegExp(pat, 'mi').test(txt));
    for (const pat of art.must_not_match ?? []) check(`${n} ${art.path} avoids /${pat}/`, !new RegExp(pat, 'mi').test(txt));
    // negative control: an empty artifact must fail at least one rule, or the rules prove nothing
    const failsEmpty = art.must_match.some((pat) => !new RegExp(pat, 'mi').test('')) ;
    check(`${n} ${art.path} rules reject an empty file`, failsEmpty);
  }

  const h = readJson(rel(ev.handoff_fixture));
  const errs = validate(handoffSchema, h);
  check(`${n} golden hand-off valid`, errs.length === 0, errs.join('; '));
  check(`${n} golden hand-off role/step match eval`, h.role === role && h.step === ev.step);
  const bad = { ...h }; delete bad.summary;
  check(`${n} hand-off without summary is rejected`, validate(handoffSchema, bad).length > 0);
}

/* 2. cross-artifact traceability (the rule in skills/muffy/references/quality-checks.md) */
const acIds = [...new Set(read('ac.md').match(/AC-\d+/g))];
const contractTree = () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  return [join(fixtureDir, 'contract.md'), ...walk(join(fixtureDir, 'contract'))].map((p) => readFileSync(p, 'utf8')).join('\n');
};
const traced = { 'design.md': read('design.md'), 'contract.md + contract/': contractTree(), 'qa-report.md': read('qa-report.md') };
check('contract.md is an index: check-artifacts passes on the fixture (<= 60 lines, links resolve, every AC mapped)', checkTask(fixtureDir).length === 0, checkTask(fixtureDir).join('; '));
const missing = (docs) => Object.entries(docs).flatMap(([name, txt]) => acIds.filter((id) => !txt.includes(id)).map((id) => `${id} missing in ${name}`));
check('traceability: every AC is in design, contract and qa-report', missing(traced).length === 0, missing(traced).join(', '));
check('traceability: dropping AC-2 from contract is detected', missing({ ...traced, 'contract.md + contract/': traced['contract.md + contract/'].replaceAll('AC-2', 'AC-X') }).length > 0);
const runtime = (t) => t.match(/^Runtime:\s*(.+?)(?:\s*\(|$)/m)?.[1];
check('runtime pin: deploy.md == contract.md == qa-report.md', runtime(read('deploy.md')) === runtime(read('contract.md')) && runtime(read('contract.md')) === runtime(read('qa-report.md')));
check('runtime pin: mismatch is detected', runtime(read('deploy.md')) !== runtime(read('contract.md').replace('Node 22.14', 'Node 20.1')));

/* 2a. prompt envelopes: schema-valid, and `read` covers every unconditional .team/<task>/ path in required-inputs.md */
const envSchema = readJson(rel('skills/muffy/schemas/prompt-envelope.schema.json'));
for (const f of readdirSync(rel('evals/fixtures/login-flow/prompts')).filter((n) => n.endsWith('.json'))) {
  const role = f.replace(/\.json$/, '');
  const env = readJson(rel('evals/fixtures/login-flow/prompts', f));
  const errs = validate(envSchema, env);
  check(`envelope:${role} valid`, errs.length === 0, errs.join('; '));
  const needed = readFileSync(rel('agents/references', role, 'required-inputs.md'), 'utf8').split(/\r?\n/)
    .filter((l) => /^- /.test(l) && !/\(if /i.test(l))
    .flatMap((l) => [...l.matchAll(/`([^`]*<task>[^`]*)`/g)].map((m) => m[1].replaceAll('<task>', TASK).replaceAll('<n>', '1')));
  const absent = needed.filter((p) => !env.read.includes(p));
  check(`envelope:${role} reads every required input`, absent.length === 0, `missing ${absent.join(', ')}`);
  check(`envelope:${role} does not paste file contents`, JSON.stringify(env).length < 1200);
}

/* 2b. checkpoint format (references/memory-model.md#checkpoint) */
const cp = read('checkpoint.md');
for (const h of ['Goal', 'Run profile', 'Status', 'Decisions in force', 'Loop counters', 'Open blockers', 'History']) {
  check(`checkpoint has ## ${h}`, new RegExp(`^## ${h}\\s*$`, 'm').test(cp));
}
check('checkpoint is <= 40 lines outside ## Goal', cp.replace(/^## Goal[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/m, '').trimEnd().split(/\r?\n/).length <= 40);
check('checkpoint loop counters are within the limit', !/\b[4-9]\/3\b/.test(cp));

/* 2c. no-vault brain (references/memory-model.md): `.team/brain/` holds project.md, task notes and one append-only note per agent */
{
  const brainDir = join(fixtureDir, '..', 'brain');
  const handoffs = readdirSync(join(fixtureDir, 'handoff')).map((f) => readJson(join(fixtureDir, 'handoff', f)));
  const files = (d, base = d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(d, e.name), base) : [join(d, e.name).slice(base.length + 1).replace(/\\/g, '/')]);
  const checkBrain = (dir, task) => {
    const bad = [];
    const at = (p) => existsSync(join(dir, p));
    const text = (p) => (at(p) ? readFileSync(join(dir, p), 'utf8') : '');
    const project = text('project.md');
    for (const h of ['Tasks', 'Lessons', 'Open issues', 'Retired lessons']) if (!new RegExp(`^## ${h}\\s*$`, 'm').test(project)) bad.push(`project.md lacks ## ${h}`);
    const lessons = (project.match(/^## Lessons\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? '').split(/\r?\n/).filter((l) => /^- /.test(l));
    if (lessons.length > 30) bad.push('more than 30 Lessons');
    for (const l of lessons) if (!/\d{4}-\d{2}-\d{2}/.test(l) || !/\[\[[^\]]+\]\]/.test(l)) bad.push(`lesson without date + wikilink: ${l}`);
    if (!project.includes(`[[tasks/${task}]]`)) bad.push('project.md ## Tasks does not link the task note');
    const note = text(`tasks/${task}.md`);
    for (const k of ['project', 'task', 'date', 'status']) if (!new RegExp(`^${k}:`, 'm').test(note)) bad.push(`task note lacks frontmatter ${k}`);
    for (const m of note.matchAll(/\[\[(agents\/[^\]]+)\]\]/g)) if (!at(`${m[1]}.md`)) bad.push(`task note links a missing note: ${m[1]}`);
    for (const h of handoffs) {
      if (!h.brain_note) continue;
      const p = `agents/${h.role}/${task}.md`;
      if (!at(p)) bad.push(`no brain note for ${h.role}`);
      else if (!/^## \d{4}-\d{2}-\d{2}/m.test(text(p))) bad.push(`${h.role} brain note has no dated section`);
    }
    if (!at(`agents/code-reviewer/${task}.md`)) bad.push('Orchestrator did not record the code-reviewer note');
    for (const f of files(dir)) if (!(f === 'project.md' || /^tasks\/[^/]+\.md$/.test(f) || /^agents\/[^/]+\/[^/]+\.md$/.test(f))) bad.push(`file outside the brain layout: ${f}`);
    return bad;
  };
  const problems = checkBrain(brainDir, TASK);
  check('brain fixture follows the layout, links resolve and every hand-off with a brain_note has its note', problems.length === 0, problems.join('; '));
  check('code-reviewer review ends with a ### Second brain section for the Orchestrator to record', /^### Second brain\s*$/m.test(read('review-1.md')));
  const tmp = mkdtempSync(join(tmpdir(), 'muffy-brain-'));
  cpSync(brainDir, tmp, { recursive: true });
  check('brain negative control: a missing agent note is caught', (rmSync(join(tmp, 'agents', 'backend-dev', `${TASK}.md`)), checkBrain(tmp, TASK).some((p) => /no brain note for backend-dev/.test(p))));
  check('brain negative control: a stray file is caught', (writeFileSync(join(tmp, 'agents', 'notes.txt'), 'x'), checkBrain(tmp, TASK).some((p) => /outside the brain layout/.test(p))));
  rmSync(tmp, { recursive: true, force: true });
}

/* 3. mock multi-agent scenarios against the loop rules */
for (const f of readdirSync(rel('evals/mock-scenarios')).filter((n) => n.endsWith('.json'))) {
  const sc = readJson(rel('evals/mock-scenarios', f));
  const withDefaults = {
    ...sc,
    events: sc.events.map((e) => (e.handoff ? { ...e, handoff: { ...(sc.defaults ?? {}), ...e.handoff } } : e)),
  };
  const out = simulate(withDefaults);
  const n = `scenario:${sc.id}`;
  check(`${n} outcome`, out.outcome === sc.expect.outcome, `expected ${sc.expect.outcome}, got ${out.outcome}`);
  check(`${n} actions`, JSON.stringify(out.actions) === JSON.stringify(sc.expect.actions), `expected ${JSON.stringify(sc.expect.actions)}, got ${JSON.stringify(out.actions)}`);
  if (sc.expect.trigger) check(`${n} trigger`, out.trigger === sc.expect.trigger, `got ${out.trigger}`);
  for (const [point, count] of Object.entries(sc.expect.loops ?? {})) check(`${n} loops ${point}`, out.loops[point] === count, `got ${out.loops[point]}`);
  if (out.outcome !== 'invalid-profile') check(`${n} no rule violations`, out.violations.length === 0, out.violations.join('; '));
}

/* 4. effort rules (references/token-discipline.md "Effort tiers") */
for (const sc of readJson(rel('evals/effort-scenarios.json'))) {
  const out = chooseEffort({ role: sc.role, mode: sc.mode, signals: sc.signals });
  check(`effort:${sc.id}`, out.effort === sc.expect, `expected ${sc.expect}, got ${out.effort} (${out.reason})`);
}

/* 4b. effort docs vs code: the doc's defaults, protected roles and stall threshold must match agents/*.md and effort-sim.mjs */
const tierDoc = readFileSync(rel('skills/muffy/references/token-discipline.md'), 'utf8');
const docLines = tierDoc.split(/\r?\n/);
const lineWith = (re) => docLines.find((l) => re.test(l)) ?? '';
const effortLine = lineWith(/^- \*\*Effort tiers\*\*/);
const docDefaults = (line) => Object.fromEntries([...line.matchAll(/((?:`[a-z-]+`(?:, )?)+) = (low|medium|high)/g)]
  .flatMap((m) => [...m[1].matchAll(/`([a-z-]+)`/g)].map((r) => [r[1], m[2]])));
const rolesIn = (line) => [...line.matchAll(/`([a-z-]+)`/g)].map((m) => m[1]).sort();
const roles = readdirSync(rel('agents')).filter((n) => n.endsWith('.md')).map((n) => n.replace(/\.md$/, ''));
const scenarios = readJson(rel('evals/effort-scenarios.json'));
const documented = docDefaults(effortLine);
for (const role of roles) check(`effort-doc:${role} default in doc matches agents/${role}.md`, documented[role] === defaultEffort(role), `doc says ${documented[role]}, frontmatter says ${defaultEffort(role)}`);
check('effort-doc: doc lists no role without an agent file', Object.keys(documented).every((r) => roles.includes(r)));
check('effort-doc: negative control, a drifted doc line is detected', docDefaults(effortLine.replace('`architect`, ', '')).architect !== defaultEffort('architect'));
const protectedSorted = [...PROTECTED_ROLES].sort();
check('effort-doc: "Never lower" roles match PROTECTED_ROLES', JSON.stringify(rolesIn(lineWith(/\*\*Never lower\*\*/))) === JSON.stringify(protectedSorted));
check('effort-doc: model and effort protect the same roles', JSON.stringify(rolesIn(lineWith(/\*\*Never downgrade\*\*/))) === JSON.stringify(protectedSorted));
check('effort-doc: every protected role defaults to high, so never-lower is meaningful', PROTECTED_ROLES.every((r) => defaultEffort(r) === 'high'));
check('effort-doc: stall threshold in doc matches STALLED_AFTER', tierDoc.includes(`≥ ${STALLED_AFTER} consecutive rejections`));
for (const sig of ['High impact', 'Assumed requirements', 'Stalled', 'Exact fix']) check(`effort-doc: signal table has "${sig}"`, new RegExp(`^\\s*\\| ${sig}`, 'm').test(tierDoc));
check('effort-doc: scenarios cover every role', roles.every((r) => scenarios.some((s) => s.role === r)), `uncovered: ${roles.filter((r) => !scenarios.some((s) => s.role === r))}`);

/* 5. smoke triggers (references/run-profile.md "Smoke triggers") */
for (const sc of readJson(rel('evals/smoke-scenarios.json'))) {
  const out = smokeRequired(sc.signals);
  check(`smoke:${sc.id}`, out.required === sc.expect, `expected ${sc.expect}, got ${out.required} (${out.reasons})`);
}
const profileDoc = readFileSync(rel('skills/muffy/references/run-profile.md'), 'utf8');
const triggerLine = profileDoc.split(/\r?\n/).find((l) => l.startsWith('**Smoke triggers')) ?? '';
for (const [key, kw] of Object.entries({ runtime_or_dependency_changed: 'lockfile', devops_files_changed: 'Dockerfile', no_passing_smoke_on_record: 'no passing smoke', staging_none: 'staging: none' })) {
  check(`smoke-doc: run-profile.md documents trigger ${key}`, triggerLine.includes(kw), `missing "${kw}"`);
}
check('smoke-doc: every SMOKE_TRIGGERS key has a documented keyword', Object.keys(SMOKE_TRIGGERS).length === 4);
check('smoke-doc: setup.md asks the staging question at pause:scope', /Staging: is there one/.test(readFileSync(rel('skills/muffy/references/setup.md'), 'utf8')));
check('smoke-scenarios: every trigger has a positive scenario', Object.keys(SMOKE_TRIGGERS).every((k) => readJson(rel('evals/smoke-scenarios.json')).some((s) => s.signals[k] === true && s.expect === true)));

/* 6. split-diff: topic split keeps every file once, bytes intact, tests with their source */
{
  const tmp = mkdtempSync(join(tmpdir(), 'splitdiff-'));
  const blk = (path, n) => `diff --git a/${path} b/${path}
--- a/${path}
+++ b/${path}
@@ -0,0 +1,${n} @@
` + Array.from({ length: n }, (_, i) => `+l${i}
`).join('');
  const paths = [['storage/migrations/001_x.sql', 20], ['api/src/routes/pins.rs', 400], ['api/tests/pins.rs', 50], ['web/src/shared/a.ts', 400], ['web/src/shared/a.test.ts', 50], ['web/src/ui/b.tsx', 400], ['docs/x.md', 10]];
  for (let i = 0; i < 12; i++) paths.push([`web/src/ui/c${i}.tsx`, 30]);
  const patch = paths.map(([p, n]) => blk(p, n)).join('');
  writeFileSync(join(tmp, 'diff-1.patch'), patch);
  const script = rel('skills/muffy/scripts/split-diff.mjs');
  const small = spawnSync(process.execPath, [script, join(tmp, 'diff-1.patch'), '--max-lines', '100000', '--max-files', '100'], { encoding: 'utf8' });
  check('split-diff: small diff is left alone', small.status === 0 && /no split needed/.test(small.stdout) && !existsSync(join(tmp, 'diff-1-index.md')));
  const r = spawnSync(process.execPath, [script, join(tmp, 'diff-1.patch'), '--max-lines', '500', '--max-files', '5'], { encoding: 'utf8' });
  check('split-diff: large diff splits (exit 0)', r.status === 0, r.stderr);
  const out = readdirSync(tmp).filter((f) => /^diff-1-.+\.patch$/.test(f));
  const all = out.map((f) => readFileSync(join(tmp, f), 'utf8'));
  const seenPaths = all.flatMap((t) => [...t.matchAll(/^diff --git a\/(\S+) /gm)].map((m) => m[1]));
  check('split-diff: every file in exactly one topic', seenPaths.length === paths.length && new Set(seenPaths).size === paths.length);
  check('split-diff: bytes preserved', all.join('').length === patch.length);
  check('split-diff: more than one topic', out.length > 1);
  const holding = (p) => all.findIndex((t) => t.includes(`diff --git a/${p} `));
  check('split-diff: test sits with its source', holding('web/src/shared/a.ts') === holding('web/src/shared/a.test.ts') && holding('api/src/routes/pins.rs') === holding('api/tests/pins.rs'));
  check('split-diff: migration and docs get their own topics', out.some((f) => f.includes('db-migration')) && out.some((f) => f.includes('infra-docs-smoke')));
  check('split-diff: index lists every file', paths.every(([p]) => readFileSync(join(tmp, 'diff-1-index.md'), 'utf8').includes(p)));
  rmSync(tmp, { recursive: true, force: true });
}

/* 7. devops-preflight: runtime and env checks pass/fail, values never printed */
{
  const tmp = mkdtempSync(join(tmpdir(), 'preflight-'));
  const script = rel('skills/muffy/scripts/devops-preflight.mjs');
  writeFileSync(join(tmp, 'nvmrc'), `${process.version}\n`);
  writeFileSync(join(tmp, 'bad-nvmrc'), 'v1.0.0\n');
  writeFileSync(join(tmp, 'env'), 'KEY=sk-ant-SECRETVALUE\nEMPTY=\n');
  const run = (...a) => spawnSync(process.execPath, [script, ...a], { encoding: 'utf8' });
  const ok = run('--nvmrc', join(tmp, 'nvmrc'), '--env-file', join(tmp, 'env'), '--var', 'KEY=sk-ant-');
  check('preflight: matching runtime and env prefix pass (exit 0)', ok.status === 0, ok.stdout);
  check('preflight: never prints the secret value', !ok.stdout.includes('SECRETVALUE') && !ok.stderr.includes('SECRETVALUE'));
  check('preflight: runtime mismatch fails (exit 1)', run('--nvmrc', join(tmp, 'bad-nvmrc')).status === 1);
  const bad = run('--nvmrc', join(tmp, 'nvmrc'), '--env-file', join(tmp, 'env'), '--var', 'KEY=wrong-', '--var', 'EMPTY', '--var', 'GONE');
  check('preflight: wrong prefix, empty and missing vars all fail', bad.status === 1 && /"failed":\["env KEY","env EMPTY","env GONE"\]/.test(bad.stdout), bad.stdout);
  check('preflight: unknown flag is a usage error (exit 2)', run('--nope').status === 2);
  rmSync(tmp, { recursive: true, force: true });
}

/* 7b. guards: Bash allowlist for doc agents, full-regression approval for qa-tester */
check('install.mjs parses', spawnSync('node', ['--check', rel('install.mjs')]).status === 0);
{
  const tmp = mkdtempSync(join(tmpdir(), 'muffy-guards-'));
  mkdirSync(join(tmp, '.team', 'x'), { recursive: true });
  const guard = (script, agent_type, command, cwd = tmp) => spawnSync('node', [rel('skills/muffy/scripts', script)], { input: JSON.stringify({ tool_name: 'Bash', agent_type, cwd, tool_input: { command } }), encoding: 'utf8' }).status;
  const A = 'guard-bash-allowlist.mjs';
  check('guard-bash: doc agent may run a validator', guard(A, 'architect', 'node .claude/skills/muffy/scripts/validate-handoff.mjs .team/x/h.json') === 0);
  check('guard-bash: doc agent may read git', guard(A, 'muffy:docs-writer', 'git diff --stat') === 0);
  check('guard-bash: chaining, commits and npm are blocked', ['node .claude/skills/muffy/scripts/check-artifacts.mjs a; rm -rf .', 'git commit -m x', 'npm test', 'git log > a'].every((c) => guard(A, 'designer', c) === 2));
  check('guard-bash: Orchestrator and other roles are untouched', guard(A, undefined, 'npm test') === 0 && guard(A, 'backend-dev', 'npm test') === 0);
  const F = 'guard-full-regression.mjs';
  check('guard-regression: whole-system runs are blocked for qa-tester', ['npm test', 'npx vitest run', 'pytest', 'go test ./...', 'cd app && npm run test:e2e'].every((c) => guard(F, 'qa-tester', c) === 2));
  check('guard-regression: scoped runs are allowed', ['npm test -- src/a.test.ts', 'npx vitest run src/a.test.ts', 'pytest tests/a.py -k login', 'npx playwright test e2e/a.spec.ts', 'go test ./pkg/auth'].every((c) => guard(F, 'qa-tester', c) === 0));
  check('guard-regression: other roles are not checked', guard(F, 'backend-dev', 'npm test') === 0);
  const L = 'guard-test-level.mjs';
  const lvlIn = (lvl, tool, arg) => { writeFileSync(join(tmp, '.team', 'x', 'test-level'), lvl); return spawnSync('node', [rel('skills/muffy/scripts', L)], { input: JSON.stringify({ tool_name: tool, agent_type: 'qa-tester', cwd: tmp, tool_input: tool === 'Bash' ? { command: arg } : { file_path: arg } }), encoding: 'utf8' }).status; };
  check('guard-level: L0 blocks any test run and test files but allows build', lvlIn('L0', 'Bash', 'npm test -- src/a.test.ts') === 2 && lvlIn('L0', 'Write', 'src/a.test.ts') === 2 && lvlIn('L0', 'Bash', 'npm run build') === 0);
  check('guard-level: L1 allows a scoped unit run, blocks integration and e2e', lvlIn('L1', 'Bash', 'npm test -- src/a.test.ts') === 0 && lvlIn('L1', 'Bash', 'npx playwright test e2e/a.spec.ts') === 2 && lvlIn('L1', 'Bash', 'npx vitest run tests/integration/a.test.ts') === 2 && lvlIn('L1', 'Write', 'e2e/new.spec.ts') === 2);
  check('guard-level: L2 and L3 allow scoped integration and e2e', ['L2', 'L3'].every((l) => lvlIn(l, 'Bash', 'npx playwright test e2e/a.spec.ts') === 0 && lvlIn(l, 'Write', 'e2e/new.spec.ts') === 0));
  rmSync(join(tmp, '.team', 'x', 'test-level'));
  check('guard-level: no level file means no ceiling', spawnSync('node', [rel('skills/muffy/scripts', L)], { input: JSON.stringify({ tool_name: 'Bash', agent_type: 'qa-tester', cwd: tmp, tool_input: { command: 'npx playwright test e2e/a.spec.ts' } }), encoding: 'utf8' }).status === 0);
  writeFileSync(join(tmp, '.team', 'x', 'full-regression.approved'), 'npm test 2026-01-01');
  check('guard-regression: approval marker lets qa-tester run it', guard(F, 'qa-tester', 'npm test') === 0);
  rmSync(tmp, { recursive: true, force: true });
}

/* 8. fix lane (references/fix-profile.md): triage examples, fix.md fixture, diagnosis hand-offs */
runFixLaneEvals({ check, root });

/* 9. analyze mode (references/analyze.md): pending-work scan, privacy filters */
runPendingEvals({ check, root });

console.log(`eval: ${pass} passed, ${failures.length} failed`);
if (failures.length) { console.error(failures.map((x) => `  FAIL ${x}`).join('\n')); process.exit(1); }
