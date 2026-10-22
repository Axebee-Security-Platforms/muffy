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
import { runOwnershipEvals } from './lib/ownership-evals.mjs';
import { runLiteLaneEvals } from './lib/lite-lane-evals.mjs';
import { runPendingEvals } from './lib/pending-evals.mjs';
import { runRouteEvals } from './lib/route-evals.mjs';
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
  // a mode of an agent (present mode of product-manager) keeps its references, and so its rubric, in a subfolder
  const n = `agent:${role}${ev.references ? ` (${ev.references})` : ''}`;

  check(`${n} has agent definition`, existsSync(rel('agents', `${role}.md`)));
  const live = rubricOf(ev.references ?? role);
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

/* 2-pre. make-envelope.mjs builds a valid, lean prompt; run-quiet.mjs keeps output short */
{
  const mk = (extra) => spawnSync(process.execPath, [rel('skills/muffy/scripts/make-envelope.mjs'), '--role', 'backend-dev', '--step', '4', '--round', '1', '--task', 'login-flow', '--brain', '.team/brain', '--goal', 'Build login', '--read', 'ac.md,contract.md', '--write', 'src/auth/', ...extra], { encoding: 'utf8' });
  const ok = mk([]), bad = mk(['--profile', 'nope']);
  check('make-envelope: valid flags print the template with the hand-off path and shape', ok.status === 0 && ok.stdout.includes('handoff/4-backend-dev-r1.json') && ok.stdout.includes('Hand-off shape:') && ok.stdout.includes('1,200 characters'), ok.stderr);
  check('make-envelope: prompt stays lean (< 1.6 KB)', ok.stdout.length < 1600, String(ok.stdout.length));
  check('make-envelope: schema violation exits 1 and prints nothing to stdout', bad.status === 1 && bad.stdout === '');
  const noisy = join(tmpdir(), 'muffy-rq-noisy.js');
  writeFileSync(noisy, "for (let i = 0; i < 40; i++) console.log(i === 3 ? 'ERROR x' : 'l' + i); process.exit(4);");
  const q = spawnSync(process.execPath, [rel('skills/muffy/scripts/run-quiet.mjs'), '--tail', '2', '--out', join(tmpdir(), 'muffy-rq.log'), '--', process.execPath, noisy], { encoding: 'utf8' });
  check('run-quiet: keeps the exit code and prints a digest, not the output', q.status === 4 && q.stdout.split(/\r?\n/).length < 10 && q.stdout.includes('ERROR x') && q.stdout.includes('lines=40'), q.stdout);
}

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
  check('guard-bash: the product-manager may run the diagram check for a plan diagram', guard(A, 'product-manager', 'node .claude/skills/muffy/scripts/check-diagram.mjs docs/plan/pay-gantt.html') === 0);
  check('guard-bash: architect may run the diagram check', guard(A, 'architect', 'node .claude/skills/muffy/scripts/check-diagram.mjs docs/architecture/overview.html') === 0);
  {
    const { check: diagramErrors } = await import('../skills/muffy/scripts/check-diagram.mjs');
    const tpl = readFileSync(rel('skills/muffy/templates/diagram.html'), 'utf8');
    const withJson = (j) => tpl.replace(/(<script type="application\/json" id="diagram">)[\s\S]*?(<\/script>)/, `$1${JSON.stringify(j)}$2`);
    const arch = { kind: 'architecture', title: 'T', nodes: [{ id: 'a', label: 'A', type: 'app', col: 1, row: 1 }, { id: 'b', label: 'B', type: 'service', col: 2, row: 1 }, { id: 'c', label: 'C', type: 'store', col: 3, row: 1 }], edges: [{ from: 'a', to: 'b', label: 'x' }] };
    check('diagram: the shipped template passes', diagramErrors(tpl).length === 0);
    check('diagram: every shipped example JSON passes in the template', ['architecture', 'state', 'deployment', 'erd', 'flow', 'screenmap', 'pattern-queue-bottleneck', 'pattern-trust-boundary', 'pattern-delta', 'pattern-db-schema', 'gantt', 'story-map', 'flow-branch'].every((k) => diagramErrors(withJson(JSON.parse(readFileSync(rel(`skills/muffy/templates/diagram-examples/${k}.json`), 'utf8')))).length === 0));
    {
      const { warnings } = await import('../skills/muffy/scripts/check-diagram.mjs');
      const many = { kind: 'architecture', title: 'T', nodes: Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, label: 'N', type: 'service', col: i + 1, row: 1 })), edges: [] };
      check('diagram: a dense diagram warns but still passes', warnings(withJson(many)).length === 1 && diagramErrors(withJson(many)).length === 0);
      check('diagram: a small diagram does not warn', warnings(withJson(arch)).length === 0);
      const fb = JSON.parse(readFileSync(rel('skills/muffy/templates/diagram-examples/flow-branch.json'), 'utf8')), fbErr = (steps) => diagramErrors(withJson({ ...fb, steps }));
      const [s0, s1, s2, s3] = fb.steps;
      check('diagram flow: an either/or with two options passes and the shipped flow examples carry no warning', fbErr(fb.steps).length === 0 && warnings(withJson(fb)).length === 0 && warnings(withJson(JSON.parse(readFileSync(rel('skills/muffy/templates/diagram-examples/flow.json'), 'utf8')))).length === 0);
      check('diagram flow: a group without an option (or the reverse) fails', fbErr([s0, { ...s1, option: undefined }, s2, s3]).some((e) => e.includes('go together')));
      check('diagram flow: a group with one option fails', fbErr([s0, s1, { ...s2, option: 'In stock' }, { ...s3, group: undefined, option: undefined }]).some((e) => e.includes('one option')));
      check('diagram flow: an option split in two runs fails', fbErr([s0, s1, s3, { ...s2, option: 'In stock' }]).some((e) => e.includes('split in two')));
      check('diagram flow: a group that is not adjacent fails', fbErr([s1, s3, s0, s2]).some((e) => e.includes('not adjacent')));
      check('diagram flow: an option name over 40 characters fails', fbErr([s0, { ...s1, option: 'x'.repeat(41) }, s2, s3]).some((e) => e.includes('max 40')));
      check('diagram flow: more than two either/or groups fails', fbErr([s0, ...['a', 'b', 'c'].flatMap((g) => [{ ...s1, group: g }, { ...s3, group: g }])]).some((e) => e.includes('at most 2')));
      const plain = { kind: 'flow', title: 'T', subtitle: 'Uses a webhook and SSO', actors: [{ id: 'a', label: 'A', type: 'app' }, { id: 'b', label: 'B', type: 'service' }], steps: [{ from: 'a', to: 'b', label: 'POST /orders' }] };
      check('diagram plain words: engineering words, code-like labels and acronyms warn', ['webhook', 'reads like code', 'SSO'].every((k) => warnings(withJson(plain)).some((w) => w.includes(k))));
      const long = { ...plain, subtitle: 'Fine', actors: [...plain.actors, ...['c', 'd', 'e'].map((id) => ({ id, label: id, type: 'app' }))], steps: Array.from({ length: 9 }, (_, i) => ({ from: 'b', to: 'a', label: 'Step ' + i, ...(i === 3 ? { fail: true } : {}) })) };
      check('diagram sequence: too many steps or actors, an unused actor, a late start and a silent failure warn', ['9 steps', '5 actors', 'takes part in no step', 'not the first actor', 'fails but does not say'].every((k) => warnings(withJson(long)).some((w) => w.includes(k))));
    }
    check('diagram: the template gives screen readers the connections and named flow steps', tpl.includes("'sr'") && tpl.includes("'Connections'") && tpl.includes("'Step '"));
    {
      // text drawn in a type colour (tag, badge) must reach 4.5:1 on the card; ink and muted likewise, in both themes
      const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const vars = (s) => Object.fromEntries([...s.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
      const themes = { light: vars(tpl.match(/:root \{([\s\S]*?)\n\}/)[1]), dark: vars(tpl.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/)[1]) };
      const low = Object.entries(themes).flatMap(([t, v]) => ['ink', 'muted', 'service', 'app', 'store', 'external', 'queue', 'fail'].filter((k) => ratio(v[k], v.card) < 4.5).map((k) => `${t} ${k}`));
      check(`diagram: template text colours reach 4.5:1 on the card${low.length ? ` (low: ${low.join(', ')})` : ''}`, low.length === 0);
    }
    {
      // needs a Chrome or Edge on the machine; without one the render check is skipped, like the script itself
      const { findBrowser, layoutIssues } = await import('../skills/muffy/scripts/check-diagram-render.mjs');
      if (findBrowser()) {
        const dir = mkdtempSync(join(tmpdir(), 'muffy-render-eval-')), save = (n, j) => { const f = join(dir, `${n}.html`); writeFileSync(f, withJson(j)); return f; };
        try {
          const ok = ['architecture', 'state', 'deployment', 'erd', 'screenmap', 'pattern-queue-bottleneck', 'pattern-trust-boundary', 'pattern-delta', 'pattern-db-schema', 'gantt', 'story-map', 'flow-branch', 'flow'].map((k) => layoutIssues(save(k, JSON.parse(readFileSync(rel(`skills/muffy/templates/diagram-examples/${k}.json`), 'utf8')))));
          check('diagram render: the shipped examples have no layout issues', ok.every((i) => Array.isArray(i) && i.length === 0));
          const bad = layoutIssues(save('bad', { kind: 'architecture', title: 'T', nodes: [{ id: 'a', label: 'A', type: 'app', col: 1, row: 1 }, { id: 'b', label: 'B', type: 'service', col: 2, row: 2 }, { id: 'c', label: 'C', type: 'store', col: 3, row: 3 }], edges: [{ from: 'a', to: 'c', label: 'x' }] }));
          check('diagram render: a wire running behind a card is reported', bad.some((i) => i.includes('runs behind card B')));
          {
            const exp = (...a) => spawnSync(process.execPath, [rel('skills/muffy/scripts/diagram-export.mjs'), ...a], { encoding: 'utf8' });
            const arch = save('exp-arch', JSON.parse(readFileSync(rel('skills/muffy/templates/diagram-examples/architecture.json'), 'utf8'))), flowF = save('exp-flow', JSON.parse(readFileSync(rel('skills/muffy/templates/diagram-examples/flow.json'), 'utf8')));
            const png = join(dir, 'a.png'), svg = join(dir, 'f.svg');
            check('export: a PNG is written for a card diagram, and a failing page is refused', exp(arch, '--png', png, '--scale', '1').status === 0 && readFileSync(png).subarray(1, 4).toString() === 'PNG' && exp(save('exp-bad', { kind: 'architecture', title: 'T', nodes: [{ id: 'a', label: 'A', type: 'app', col: 1, row: 1 }], edges: [{ from: 'a', to: 'z', label: 'x' }] }), '--png', join(dir, 'b.png')).status === 2);
            {
              const gantt = save('exp-gantt', JSON.parse(readFileSync(rel('skills/muffy/templates/diagram-examples/gantt.json'), 'utf8'))), svgs = { arch: join(dir, 'arch.svg'), gantt: join(dir, 'gantt.svg') };
              const ok = exp(arch, '--svg', svgs.arch).status === 0 && exp(gantt, '--svg', svgs.gantt, '--theme', 'dark').status === 0;
              const a = ok ? readFileSync(svgs.arch, 'utf8') : '', g = ok ? readFileSync(svgs.gantt, 'utf8') : '';
              check('export: a card diagram and a gantt export as native SVG (shapes and text, no script, no foreignObject), in the chosen theme', ok && [a, g].every((t) => t.startsWith('<svg xmlns=') && t.includes('<rect') && t.includes('<text') && !/<script|foreignObject|<pre/.test(t)) && a.includes('>Orders API<') && a.includes('>HTTPS<') && g.includes('>Orders schema<') && g.includes('fill="rgb(15, 18, 24)"'));
            }
            check('export: a flow diagram exports a standalone SVG with its colours baked in', exp(flowF, '--svg', svg, '--theme', 'dark').status === 0 && (() => { const t = readFileSync(svg, 'utf8'); return t.startsWith('<svg xmlns=') && t.includes('--paper: #0f1218') && !t.includes('undefined') && t.includes('.step .msg'); })());
          }
          {
            const fl = JSON.parse(readFileSync(rel('skills/muffy/templates/diagram-examples/flow.json'), 'utf8')), wide = JSON.parse(readFileSync(rel('skills/muffy/templates/diagram-examples/architecture.json'), 'utf8'));
            const longLabel = layoutIssues(save('flow-long', { ...fl, steps: fl.steps.map((st, i) => (i ? st : { ...st, label: 'Supercalifragilisticexpialidocious'.repeat(4) })) }));
            const tooWide = layoutIssues(save('wide', { ...wide, nodes: Array.from({ length: 9 }, (_, i) => ({ id: 'n' + i, label: 'Node ' + i, type: 'service', col: i + 1, row: 1 })), edges: [] }));
            check('diagram render: a flow label wider than the space between its actors, and a page wider than the window, are reported', longLabel.some((i) => i.includes('wider than the space between its actors')) && tooWide.some((i) => i.includes('wider than the window')));
          }
          {
            // 24 one-day units fit a 1280 px window; an 800 px one (a split screen) makes the unit labels and a 1-day bar too narrow
            const g = JSON.parse(readFileSync(rel('skills/muffy/templates/diagram-examples/gantt.json'), 'utf8'));
            const f = save('gantt-dense', { ...g, unit: 'day', tasks: [...g.tasks.slice(0, 4), { id: 'z', label: 'Handover', phase: 'p3', start: 23, length: 1 }] });
            const wide = layoutIssues(f), narrow = layoutIssues(f, undefined, 800);
            check('diagram render: gantt unit labels that are cramped and a bar label that does not fit are reported', wide.length === 0 && narrow.some((i) => i.includes('unit labels are cramped')) && narrow.some((i) => i.includes('"1d" does not fit its bar')));
          }
          {
            const exp = (...a) => spawnSync(process.execPath, [rel('skills/muffy/scripts/diagram-export.mjs'), ...a], { encoding: 'utf8' });
            const kinds = ['story-map', 'state', 'deployment', 'erd', 'screenmap'], bad = kinds.filter((k) => {
              const out = join(dir, `${k}.svg`), j = JSON.parse(readFileSync(rel(`skills/muffy/templates/diagram-examples/${k}.json`), 'utf8'));
              if (exp(save(`exp-${k}`, j), '--svg', out).status !== 0) return true;
              const t = readFileSync(out, 'utf8'), first = (j.nodes ?? j.entities ?? j.stories)[0];
              return !(t.startsWith('<svg xmlns=') && t.includes('<rect') && !/<script|foreignObject|<pre/.test(t) && t.includes(`>${first.label ?? first.name}<`));
            });
            check(`export: every other kind exports as native SVG with its labels as text${bad.length ? ` (failed: ${bad.join(', ')})` : ''}`, bad.length === 0);
          }
        } finally { rmSync(dir, { recursive: true, force: true }); }
      }
    }
    {
      const st = JSON.parse(readFileSync(rel('skills/muffy/templates/diagram-examples/state.json'), 'utf8'));
      const noStart = { ...st, nodes: st.nodes.map((n) => (n.type === 'initial' ? { ...n, type: 'state' } : n)) };
      check('diagram: a state diagram needs exactly one initial node and a state/deployment type is checked', diagramErrors(withJson(noStart)).some((e) => e.includes('exactly one node of type initial')) && diagramErrors(withJson({ ...st, nodes: [...st.nodes.slice(1), { ...st.nodes[0], type: 'host' }] })).some((e) => e.includes('type must be one of')));
    }
    {
      // importer: Mermaid / draw.io / Excalidraw -> a draft muffy diagram (labels are untrusted text, styling is dropped)
      const imp = (f, ...extra) => { const r = spawnSync(process.execPath, [rel('skills/muffy/scripts/diagram-import.mjs'), rel(`evals/diagram-import/${f}`), '--json', ...extra], { encoding: 'utf8' }); const i = r.stdout.indexOf('\n{'); return { code: r.status, out: r.stdout, d: i < 0 ? null : JSON.parse(r.stdout.slice(i + 1)) }; };
      const fl = imp('flow.mmd'), st = imp('state.mmd'), er = imp('er.mmd'), sq = imp('seq.mmd'), dx = imp('sample.drawio'), ex = imp('sample.excalidraw');
      check('import: a Mermaid flowchart keeps nodes, labels and shapes, and drops styling and click targets', fl.d?.kind === 'architecture' && fl.d.nodes.length === 6 && fl.d.nodes.find((n) => n.label === 'Postgres')?.type === 'store' && fl.d.edges.some((e) => e.label === 'enqueue') && fl.out.includes('1 click targets') && !fl.out.includes('evil.example'));
      check('import: a Mermaid state diagram gets one initial node and a final one', st.d?.kind === 'state' && st.d.nodes.filter((n) => n.type === 'initial').length === 1 && st.d.nodes.some((n) => n.type === 'final') && st.d.edges.some((e) => e.label === 'retry [once]') && st.out.includes('draft passes'));
      check('import: a Mermaid ER diagram keeps keys and cardinality', er.d?.kind === 'erd' && er.d.entities.find((e) => e.name === 'CUSTOMER')?.fields.some((f) => f.key === 'pk') && er.d.relations.some((r) => r.label === '1 : 0..N'));
      check('import: a Mermaid sequence diagram becomes a flow', sq.d?.kind === 'flow' && sq.d.actors.length === 2 && sq.d.steps.length === 2 && sq.d.actors[0].label === 'Browser');
      check('import: draw.io strips label markup and reads the cylinder as a store', dx.d?.nodes.find((n) => n.label === 'Web app') && dx.d.nodes.find((n) => n.label === 'Postgres')?.type === 'store' && dx.d.edges[0].label === 'SQL');
      check('import: Excalidraw bound text becomes labels and free text is reported dropped', ex.d?.edges[0]?.label === 'HTTPS' && ex.d.nodes.length === 2 && ex.out.includes('1 free-floating text'));
      {
        // realistic files (diagram-design fixtures and files written for muffy)
        const rf = imp('real/sample-flowchart.mmd'), ra = imp('real/sample-adversarial.mmd'), rd = imp('real/sample-architecture.drawio'), rc = imp('real/compressed.drawio'), rc1 = imp('real/compressed.drawio', '--diagram', '1'), rcBad = spawnSync(process.execPath, [rel('skills/muffy/scripts/diagram-import.mjs'), rel('evals/diagram-import/real/compressed.drawio'), '--diagram', '5'], { encoding: 'utf8' });
        const re = imp('real/sample-adversarial.excalidraw'), rw = imp('real/sample-whiteboard.excalidraw'), rs = imp('real/stress.mmd'), rg = imp('real/gantt.mmd'), rj = imp('real/journey.mmd');
        check('import real: a Mermaid flowchart drops the self link, keeps groups, and says it has a decision', rf.d?.nodes.length === 7 && rf.d.edges.length === 6 && rf.out.includes('1 self links') && rf.out.includes('2 groups') && rf.out.includes('1 decision node'));
        check('import real: adversarial Mermaid and Excalidraw text stays plain text, is flagged and never reaches the draft as a link', [ra, re].every((r) => r.out.includes('read like instructions') && !/example\.invalid/.test(r.out)) && ra.d.nodes.some((n) => n.label === 'Bold text') && !JSON.stringify(ra.d).includes('"odd"'));
        check('import real: a draw.io file keeps its counts compressed or not, and a missing page exits 2', rd.d?.nodes.length === 10 && rd.d.edges.length === 8 && rc.d?.nodes.length === 10 && rc1.d?.nodes.length === 10 && rc.out.includes('2 pages') && rcBad.status === 2);
        check('import real: an Excalidraw whiteboard keeps its shapes and arrows and reports drawings it dropped', rw.d?.nodes.length === 6 && rw.d.edges.length === 6 && /drawings and images/.test(rw.out));
        check('import real: Mermaid @{ shape } nodes, ~~~ links, edge ids and --text--> labels parse', rs.d?.nodes.some((n) => n.label === 'Orders DB') && rs.d.edges.some((e) => e.label === 'text') && rs.d.edges.some((e) => e.label === 'yes, and') && rs.out.includes('1 invisible layout links') && !rs.out.includes('unparsed'));
        check('import real: a Mermaid gantt becomes whole units with dependencies kept, a journey becomes a story map', rg.d?.kind === 'gantt' && rg.d.unit === 'week' && rg.d.tasks.find((t) => t.id === 'pay')?.start === 3 && rg.d.tasks.find((t) => t.id === 'pay')?.length === 3 && rg.d.tasks.find((t) => t.id === 'go')?.milestone === true && rg.out.includes('draft passes') && rj.d?.kind === 'story-map' && rj.d.activities.length === 3 && rj.d.stories.length === 4 && rj.out.includes('draft passes'));
      }
      check('import: an unsupported file type exits 2, and the draft never carries a link the source lacks', spawnSync(process.execPath, [rel('skills/muffy/scripts/diagram-import.mjs'), rel('package.json')], { encoding: 'utf8' }).status === 2 && fl.d.edges.length === 5);
      check('guard-bash: the architect may read an import but not write one with --html', guard(A, 'architect', 'node .claude/skills/muffy/scripts/diagram-import.mjs evals/diagram-import/flow.mmd --json') === 0 && guard(A, 'architect', 'node .claude/skills/muffy/scripts/diagram-import.mjs a.mmd --html docs/architecture/overview.html') === 2);
    }
    {
      const ex = (k) => JSON.parse(readFileSync(rel(`skills/muffy/templates/diagram-examples/${k}.json`), 'utf8')), errsOf = (j) => diagramErrors(withJson(j)).join(' | ');
      const { warnings } = await import('../skills/muffy/scripts/check-diagram.mjs'); const qb = ex('pattern-queue-bottleneck'), tb = ex('pattern-trust-boundary'), lc = ex('state');
      check('pattern queue-bottleneck: a capacity unit, two producers and a consumer are required', errsOf({ ...qb, nodes: qb.nodes.map((n) => (n.id === 'q' ? { ...n, note: 'high' } : n)) }).includes('capacity or rate with a unit') && errsOf({ ...qb, edges: qb.edges.filter((e) => e.from !== 'api' && e.from !== 'sched') }).includes('two or more producers') && errsOf({ ...qb, edges: qb.edges.filter((e) => e.from !== 'q') }).includes('its consumer'));
      check('pattern trust-boundary: zones on every node, a crossing and a blocked crossing are required', errsOf({ ...tb, nodes: tb.nodes.map((n) => (n.id === 'api' ? { id: n.id, label: n.label, type: n.type, col: n.col, row: n.row } : n)) }).includes('needs a zone on every node') && errsOf({ ...tb, edges: tb.edges.map((e) => ({ ...e, blocked: undefined })) }).includes('forbidden crossing') && errsOf({ ...tb, edges: [...tb.edges, { from: 'api', to: 'db', label: 'x', blocked: true }] }).includes('stays inside one zone'));
      const dl = ex('pattern-delta');
      check('pattern delta: a change needs a why, a kept link to a removed component fails, an unmarked diagram fails', errsOf({ ...dl, nodes: dl.nodes.map((n) => (n.id === 'q' ? { ...n, why: undefined } : n)) }).includes('every change needs a why') && errsOf({ ...dl, nodes: dl.nodes.map((n) => (n.id === 'pay' ? { ...n, delta: 'removed', why: 'gone' } : n)) }).includes('touches a removed component') && errsOf({ ...dl, nodes: dl.nodes.map(({ delta, why, ...n }) => n), edges: dl.edges.map(({ delta, why, ...e }) => e) }).includes('at least one node or link marked') && errsOf({ ...dl, nodes: [{ ...dl.nodes[0], delta: 'new' }, ...dl.nodes.slice(1)] }).includes('delta must be one of'));
      const ds = ex('pattern-db-schema'), withField = (tid, fid, patch) => ({ ...ds, entities: ds.entities.map((t) => (t.id === tid ? { ...t, fields: t.fields.map((f) => (f.name === fid ? { ...f, ...patch } : f)) } : t)) });
      check('pattern db-schema: a foreign key needs a ref to a real column, a primary key and a drawn relation', errsOf(withField('order', 'customer_id', { ref: undefined })).includes('needs ref') && errsOf(withField('order', 'customer_id', { ref: 'customer.nope' })).includes('not in this diagram') && errsOf({ ...ds, entities: ds.entities.map((t) => (t.id === 'line' ? { ...t, fields: t.fields.map(({ key, ...f }) => (key === 'pk' ? f : { key, ...f })) } : t)) }).includes('needs a primary key') && errsOf({ ...ds, relations: ds.relations.slice(0, 1) }).includes('no relation is drawn') && errsOf({ ...ds, entities: ds.entities.map((t) => (t.id === 'order' ? { ...t, indexes: [{ columns: ['missing'] }] } : t)) }).includes('columns that exist'));
      const gt = ex('gantt'), sm = ex('story-map');
      check('gantt: a task may not start before its dependency ends, needs a unit, a real phase and a valid AC id', errsOf({ ...gt, tasks: gt.tasks.map((t) => (t.id === 'pay' ? { ...t, start: 2 } : t)) }).includes('start no earlier than its dependencies end') && errsOf({ ...gt, unit: 'fortnight' }).includes('unit must be one of') && errsOf({ ...gt, tasks: gt.tasks.map((t) => (t.id === 'api' ? { ...t, phase: 'nope' } : t)) }).includes('phase must be one of the phases') && errsOf({ ...gt, tasks: gt.tasks.map((t) => (t.id === 'api' ? { ...t, ac: ['story-1'] } : t)) }).includes('ac must be ids like AC-3') && errsOf({ ...gt, tasks: gt.tasks.map((t) => (t.id === 'go' ? { ...t, length: 2 } : t)) }).includes('a milestone has no length') && errsOf({ ...gt, tasks: gt.tasks.map((t) => (t.id === 'go' ? { ...t, start: 40 } : t)) }).includes('ends after unit'));
      check('story-map: a story needs a real activity and release; a first release that is not end-to-end only warns', errsOf({ ...sm, stories: sm.stories.map((s) => (s.id === 's1' ? { ...s, activity: 'nope' } : s)) }).includes('activity must be one of the activities') && errsOf({ ...sm, cut: 'r9' }).includes('cut must be a release id') && warnings(withJson({ ...sm, stories: sm.stories.filter((s) => s.id !== 's3') })).some((w) => w.includes('not an end-to-end slice')) && warnings(withJson({ ...sm, stories: sm.stories.map((s) => (s.id === 's1' ? { ...s, ac: undefined } : s)) })).some((w) => w.includes('links no acceptance criteria')) && warnings(withJson(sm)).length === 0);
      const stuck = { ...lc, nodes: [...lc.nodes, { id: 'lost', label: 'Lost', type: 'state', col: 4, row: 2 }] };
      check('pattern lifecycle: a state nobody can reach or leave fails with the pattern and only warns without it', errsOf(stuck).includes('lost cannot be reached') && errsOf(stuck).includes('lost is a dead end') && diagramErrors(withJson({ ...stuck, pattern: undefined })).length === 0 && warnings(withJson({ ...stuck, pattern: undefined })).some((w) => w.includes('lost is a dead end')));
      check('pattern: an unknown pattern, or one on the wrong kind, fails', errsOf({ ...qb, pattern: 'magic' }).includes('pattern must be one of') && errsOf({ ...qb, pattern: 'lifecycle' }).includes('is for kind state'));
    }
    check('diagram: a caption is rejected (the one sentence goes in subtitle) and the template has no caption in its JSON', diagramErrors(withJson({ ...arch, caption: 'x' })).some((e) => e.includes('caption was removed')) && !/"caption"/.test(tpl) && ['architecture', 'flow', 'gantt'].every((k) => !readFileSync(rel(`skills/muffy/templates/diagram-examples/${k}.json`), 'utf8').includes('"caption"')));
    check('diagram: a valid architecture passes', diagramErrors(withJson(arch)).length === 0);
    check('diagram: an edge through another card fails', diagramErrors(withJson({ ...arch, edges: [{ from: 'a', to: 'c', label: 'x' }] })).some((e) => e.includes('passes through')));
    check('diagram: an unknown node, a missing edge label and a shared cell fail', [{ ...arch, edges: [{ from: 'a', to: 'z', label: 'x' }] }, { ...arch, edges: [{ from: 'a', to: 'b' }] }, { ...arch, nodes: [...arch.nodes.slice(0, 2), { ...arch.nodes[2], col: 2 }] }].every((j) => diagramErrors(withJson(j)).length > 0));
    check('diagram: a changed template shell fails', diagramErrors(withJson(arch).replace('--paper: #f7f8fa', '--paper: #000')).some((e) => e.includes('differs from templates')));
  }
  check('guard-bash: product-manager (present mode) and designer may run the presentation check, nothing else', ['product-manager', 'designer'].every((r) => guard(A, r, 'node .claude/skills/muffy/scripts/check-presentation.mjs --content docs/presentations/q3') === 0 && guard(A, r, 'npm run build') === 2));
  {
    const { checkDeck, checkHtml, checkFolder, checkTheme } = await import('../skills/muffy/scripts/check-presentation.mjs');
    const tokens = readFileSync(join(fixtureDir, 'docs/design-system/tokens.css'), 'utf8');
    check('presentation theme: values copied from tokens.css pass, light and dark', checkTheme(':root { --accent: #0b7a5c; --font: "Inter", system-ui, sans-serif; } @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --accent: #3fd1a6; } } :root[data-theme="dark"] { --accent: #3fd1a6; }', tokens).length === 0);
    check('presentation theme: a value not in tokens.css fails', checkTheme(':root { --accent: #ff0000; }', tokens).some((e) => e.includes('not in docs/design-system/tokens.css')));
    check('presentation theme: no design system allows only the requester accent', checkTheme(':root { --accent: #ff0000; }', null).length === 0 && checkTheme(':root { --ink: #000000; }', null).some((e) => e.includes('has no source')));
    check('presentation theme: other selectors, unknown variables and url() fail', [':root { --accent: #0b7a5c; } body { color: red; }', ':root { --shadow: none; }', ':root { --font: url(x.woff); }', ':root { color: #0b7a5c; }'].every((c) => checkTheme(c, tokens).length > 0));
    const deckDir = join(fixtureDir, 'presentations', 'login-launch');
    const deck = readJson(join(deckDir, 'deck.json'));
    const tpl = readFileSync(rel('skills/muffy/templates/presentation.html'), 'utf8');
    const tplDeck = JSON.parse(tpl.match(/<script type="application\/json" id="deck">([\s\S]*?)<\/script>/)[1]);
    const withSlide = (i, patch) => ({ ...deck, slides: deck.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
    const chartAt = deck.slides.findIndex((s) => s.type === 'chart'), metricAt = deck.slides.findIndex((s) => s.type === 'metric');
    check('presentation: the fixture folder passes, with source files resolved', checkFolder(deckDir, { root: fixtureDir }).length === 0, checkFolder(deckDir, { root: fixtureDir }).join('; '));
    check('presentation: the shipped template sample passes', checkDeck(tplDeck).length === 0 && checkHtml(tpl, tplDeck).length === 0);
    check('presentation: a number with no source fails', checkDeck(withSlide(metricAt, { values: [{ value: '5', label: 'tries' }] })).some((e) => e.includes('source is required')));
    check('presentation: a source file that does not exist fails', checkDeck(withSlide(chartAt, { source: 'data/nope.csv' }), { root: fixtureDir }).some((e) => e.includes('does not exist')));
    check('presentation: a headline number not in the data needs derived', checkDeck(withSlide(chartAt, { derived: undefined })).some((e) => e.includes('add derived')));
    check('presentation: a series with the wrong length, a negative value and an unknown kind fail', [{ series: [{ name: 'T', values: [1] }] }, { series: [{ name: 'T', values: [-1, 2] }] }, { kind: 'pie' }].every((p) => checkDeck(withSlide(chartAt, p)).length > 0));
    check('presentation: internal names in the deck fail', ['see AC-2', 'built on be/login-flow', 'the backend-dev said', 'from .team/x'].every((t) => checkDeck(withSlide(1, { takeaway: t })).some((e) => e.includes('internal names'))));
    check('presentation: a source path is not scanned for internal names', checkDeck(withSlide(1, { source: '.team/login-flow/ac.md' })).every((e) => !e.includes('internal names')));
    check('presentation: a long caption and a caption number with no source fail', checkDeck(withSlide(deck.slides.findIndex((s) => s.type === 'diagram'), { caption: 'x'.repeat(121) })).some((e) => e.includes('caption is over')) && checkDeck(withSlide(deck.slides.findIndex((s) => s.type === 'diagram'), { caption: 'Takes 2 seconds' })).some((e) => e.includes('caption (shows a number)')));
    check('presentation headline: a question, a label and an over-long headline fail; Thai is not word-counted', [{ headline: 'Is sign-in faster now?' }, { headline: 'Sign-in' }, { headline: Array(16).fill('word').join(' ') }].every((p) => checkDeck(withSlide(1, p)).some((e) => e.includes('headline is'))) && checkDeck(withSlide(1, { headline: 'เข้าสู่ระบบด้วยอีเมลได้แล้ว' })).every((e) => !e.includes('headline is')));
    const stepsAt = deck.slides.findIndex((s) => s.type === 'steps');
    check('presentation steps: a wrong count in the headline, a numbered label and too few steps fail', checkDeck(withSlide(stepsAt, { headline: 'Getting in takes four steps' })).some((e) => e.includes('says 4 steps')) && checkDeck(withSlide(stepsAt, { steps: [{ label: '1. Open the app' }, { label: 'Press Sign in' }, { label: 'Enter details' }] })).some((e) => e.includes('starts with a number')) && checkDeck(withSlide(stepsAt, { steps: [{ label: 'Open the app' }] })).some((e) => e.includes('3 to 6')));
    check('presentation chart: highlight must be a category the headline names; note numbers need a source', checkDeck(withSlide(chartAt, { highlight: { category: 'Before' } })).some((e) => e.includes('must name the highlighted')) && checkDeck(withSlide(chartAt, { highlight: { category: 'Later' } })).some((e) => e.includes('one of the categories')) && checkDeck(withSlide(chartAt, { note: { text: 'Launched 2026-03-04' } })).some((e) => e.includes('note (shows a number')));
    const stmt = { type: 'statement', headline: 'Your team stops re-keying orders by hand' };
    const withSlides = (extra) => ({ ...deck, slides: [deck.slides[0], ...extra, ...deck.slides.slice(1)] });
    check('presentation statement: one passes; two in a row and three per deck fail', checkDeck(withSlides([stmt])).length === 0 && checkDeck(withSlides([stmt, stmt])).some((e) => e.includes('in a row')) && checkDeck(withSlides([stmt, deck.slides[1], stmt, deck.slides[1], stmt])).some((e) => e.includes('at most 2 statement')));
    check('presentation section: needs 10+ slides and an agenda', checkDeck(withSlides([{ type: 'section', headline: 'Phase one gets you signed in', number: 1 }])).some((e) => e.includes('10 or more')) && checkDeck(withSlides([{ type: 'section', headline: 'Phase one gets you signed in', number: 1 }])).some((e) => e.includes('needs an agenda')));
    const live = { ...deck.audience, setting: 'live' };
    check('presentation background: optional (the designer picks); unknown fails; read-alone needs plain when set; live allows any', checkDeck({ ...deck, background: undefined }).every((e) => !e.includes('background')) && checkDeck({ ...deck, background: 'neon' }).some((e) => e.includes('background must be')) && checkDeck({ ...deck, background: 'blueprint' }).some((e) => e.includes('read-alone deck uses background plain')) && ['blueprint', 'soft', 'plain'].every((b) => checkDeck({ ...deck, audience: live, background: b }).length === 0));
    check('presentation audience: the old string form, an unknown role and a missing field fail', checkDeck({ ...deck, audience: 'end-user' }).some((e) => e.includes('old form') && e.includes('role use')) && checkDeck({ ...deck, audience: { ...deck.audience, role: 'investor' } }).some((e) => e.includes('audience.role')) && checkDeck({ ...deck, audience: { ...deck.audience, who: undefined } }).some((e) => e.includes('audience.who')) && checkDeck({ ...deck, audience: { ...deck.audience, cares: ['cost', 'time', 'risk'] } }).some((e) => e.includes('audience.cares')));
    const ctaAt = deck.slides.length - 1, decider = { ...live, role: 'decide' };
    check('presentation cta: kind must follow the role, and a decide ask names when', checkDeck({ ...deck, audience: decider, background: 'plain' }).some((e) => e.includes('needs decide')) && checkDeck({ ...withSlide(ctaAt, { kind: 'decide', ask: 'Approve the sign-in rollout' }), audience: decider, background: 'plain' }).some((e) => e.includes('names when')) && checkDeck({ ...withSlide(ctaAt, { kind: 'decide', ask: 'Approve the sign-in rollout by the next steering meeting' }), audience: decider, background: 'plain' }).length === 0);
    // regressions from the first real run (an informed-executive Thai deck): long Thai bullets, mostly bullets, a TBD close, a labelled source
    const thai = { headline: 'หน้าแรกใหม่ทำให้เห็นปัญหาได้ทันที', items: ['เปิดระบบแล้วเห็นรายการแจ้งเตือน อุปกรณ์ และตัวเก็บข้อมูลที่ต้องดูก่อนเป็นอันดับแรกของวัน'] };
    check('presentation run 1: a Thai bullet over 60 characters fails, a short one passes', checkDeck(withSlide(1, thai)).some((e) => e.includes('characters in Thai')) && checkDeck(withSlide(1, { ...thai, items: ['เห็นปัญหาทันทีที่เปิดระบบ'] })).every((e) => !e.includes('characters in Thai')));
    const bul = { type: 'bullets', headline: 'Sign-in works the same on every device', items: ['Phone', 'Tablet'] };
    check('presentation run 1: more than half the deck as bullets fails', checkDeck({ ...deck, slides: [deck.slides[0], bul, bul, bul, bul, bul, deck.slides.at(-1)] }).some((e) => e.includes('slides are bullets')));
    check('presentation run 1: a TBD in the cta fails', checkDeck(withSlide(ctaAt, { next: ['กรอบเวลาของแต่ละระยะ: TBD'] })).some((e) => e.includes('is a TBD')) && checkDeck(withSlide(ctaAt, { ask: 'Dates: TBD' })).some((e) => e.includes('ask is a TBD')));
    check('presentation run 1: a label after the source path fails', checkDeck(withSlide(chartAt, { source: 'data/support.csv#weekly [assumed]' })).some((e) => e.includes('is not path#section')) && checkDeck(withSlide(1, { source: 'ac.md#Acceptance criteria [assumed]' })).some((e) => e.includes('is not path#section')) && checkDeck(withSlide(chartAt, { source: 'docs/plan/a.md#Phase 1 (P0): Overview MVP' })).every((e) => !e.includes('is not path#section')));
    // explainer-level decks: feature grids, long grouped workflows, narration for read-alone
    const featAt = deck.slides.findIndex((s) => s.type === 'features');
    const card = (i) => ({ title: `Role ${'abcdefghijk'[i]}`, text: 'Does one job well' });
    check('presentation features: 3-10 cards, the headline count must match, Thai text is capped', checkDeck(withSlide(featAt, { items: [card(0), card(1)] })).some((e) => e.includes('items must be 3 to 10')) && checkDeck(withSlide(featAt, { headline: 'The team has 10 roles', items: [card(0), card(1), card(2)] })).some((e) => e.includes('headline count 10')) && checkDeck(withSlide(featAt, { headline: 'The team has 10 roles', items: [...Array(10)].map((_, i) => card(i)) })).every((e) => !e.includes('headline count')) && checkDeck(withSlide(featAt, { items: [card(0), card(1), { title: 'ตรวจ', text: 'ก'.repeat(111) }] })).some((e) => e.includes('text is over')));
    check('presentation features: a time or percent in the headline is no card count and still needs a source', checkDeck(withSlide(featAt, { headline: 'Sign-in in under 30 seconds', items: [card(0), card(1), card(2)] })).every((e) => !e.includes('headline count')) && checkDeck(withSlide(featAt, { headline: 'Cuts sign-in by 3 percent', items: [card(0), card(1), card(2)], source: undefined })).some((e) => e.includes('source')));
    const grp = (label, n) => ({ label, steps: [...Array(n)].map((_, i) => ({ label: `Do part ${'abcdef'[i]}` })) });
    check('presentation steps groups: a 12-step workflow in groups passes; 13, one group, or both forms fail', checkDeck(withSlide(stepsAt, { headline: 'Work moves through 12 ขั้น from idea to release', steps: undefined, groups: [grp('Plan', 4), grp('Build', 4), grp('Ship', 4)] })).length === 0 && checkDeck(withSlide(stepsAt, { steps: undefined, groups: [grp('Plan', 6), grp('Build', 6), grp('Ship', 1)] })).some((e) => e.includes('at most 12')) && checkDeck(withSlide(stepsAt, { steps: undefined, groups: [grp('Plan', 4)] })).some((e) => e.includes('groups must be 2 to 4')) && checkDeck(withSlide(stepsAt, { groups: [grp('Plan', 2), grp('Ship', 2)] })).some((e) => e.includes('not both')));
    check('presentation narration: too long, a number with no source and a bad duration fail', checkDeck(withSlide(featAt, { narration: Array(41).fill('word').join(' ') })).some((e) => e.includes('narration is over')) && checkDeck(withSlide(1, { source: undefined, narration: 'It takes 2 minutes' })).some((e) => e.includes('narration (says a number)')) && checkDeck(withSlide(1, { duration: 2 })).some((e) => e.includes('duration must be')));
    check('presentation template: narration adds the Auto-play controls', tpl.includes("btn('Auto-play'") && tpl.includes('.ctrl, .narr { display: none !important; }'));
    // the designer's deck (templates/presentation-stage.html): free layout, checked on content
    {
      const { checkDesigned } = await import('../skills/muffy/scripts/check-presentation.mjs');
      const designed = readFileSync(join(deckDir, 'deck.html'), 'utf8');
      const stageTpl = readFileSync(rel('skills/muffy/templates/presentation-stage.html'), 'utf8');
      check('presentation designed: the fixture passes; the stage skeleton keeps its frame, controls and print rules', checkDesigned(designed, deck).length === 0 && ['id="stage"', 'class="ui"', 'id="caption"', 'class="sheet"', '@media print', 'prefers-reduced-motion'].every((x) => stageTpl.includes(x)));
      const lastSlide = designed.lastIndexOf('<section class="slide">'), lastEnd = designed.lastIndexOf('</section>') + '</section>'.length;
      check('presentation designed: a changed headline, an invented number and a dropped slide fail', checkDesigned(designed.replace('<em>password</em>', '<em>passkey</em>'), deck).some((e) => e.includes('word for word')) && checkDesigned(designed.replace('</section>', '<p>99% faster</p></section>'), deck).some((e) => e.includes('does not hold: 99')) && checkDesigned(designed.slice(0, lastSlide) + designed.slice(lastEnd), deck).some((e) => e.includes('slide sections')));
      check('presentation designed: CDN scripts, images and lost controls fail; Google Fonts pass', checkDesigned(designed.replace('</head>', '<script src="https://cdn.example.com/x.js"></script></head>'), deck).some((e) => e.includes('outside requests')) && checkDesigned(designed.replace('</section>', '<img src="a.png"></section>'), deck).some((e) => e.includes('no images')) && checkDesigned(designed.replace('class="ui"', 'class="toolbar"'), deck).some((e) => e.includes('lost the controls')) && checkDesigned(designed.replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet"></head>'), deck).length === 0);
      check('presentation designed: numeric entities (arrows, dashes) are not read as numbers', checkDesigned(designed.replace('</section>', '<p>&#8212; a &#x2192; b</p></section>'), deck).length === 0);
      check('presentation: --content checks the product-manager\'s files without deck.html', checkFolder(deckDir, { root: fixtureDir, contentOnly: true }).length === 0);
    }
    check('presentation: title must be first and cta last', checkDeck({ ...deck, slides: [...deck.slides].reverse() }).some((e) => e.includes('title slide')) && checkDeck({ ...deck, slides: deck.slides.slice(0, -1) }).some((e) => e.includes('cta slide')));
    check('presentation: a changed template shell and a JSON that drifted from deck.json fail', checkHtml(readFileSync(join(deckDir, 'deck.html'), 'utf8').replace('--accent: #2f6df6', '--accent: #000'), deck).some((e) => e.includes('differs from templates')) && checkHtml(readFileSync(join(deckDir, 'deck.html'), 'utf8'), withSlide(1, { headline: 'Changed' })).some((e) => e.includes('differs from deck.json')));
  }
  check('guard-bash: Orchestrator and other roles are untouched', guard(A, undefined, 'npm test') === 0 && guard(A, 'backend-dev', 'npm test') === 0);
  const F = 'guard-full-regression.mjs';
  check('guard-regression: whole-system runs are blocked for qa-tester', ['npm test', 'npx vitest run', 'pytest', 'go test ./...', 'cd app && npm run test:e2e', 'flutter test', 'xcodebuild test -scheme App', './gradlew :app:testDebugUnitTest', 'dotnet test', 'maestro test'].every((c) => guard(F, 'qa-tester', c) === 2));
  check('guard-regression: scoped runs are allowed', ['npm test -- src/a.test.ts', 'npx vitest run src/a.test.ts', 'pytest tests/a.py -k login', 'npx playwright test e2e/a.spec.ts', 'go test ./pkg/auth', 'flutter test test/a_test.dart', './gradlew :app:testDebugUnitTest --tests Foo', 'xcodebuild -scheme App test -only-testing:AppTests/Foo', 'dotnet test --filter Login'].every((c) => guard(F, 'qa-tester', c) === 0));
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

/* 7c. write-scope guard, contract/deploy/checkpoint checks, preflight toolchain */
{
  const W = rel('skills/muffy/scripts/guard-write-scope.mjs');
  const write = (agent_type, file_path, tool_name = 'Write') => spawnSync(process.execPath, [W], { input: JSON.stringify({ tool_name, agent_type, tool_input: { file_path } }), encoding: 'utf8' }).status;
  check('write-scope: only the product-manager writes docs/strategy.md', write('product-manager', 'docs/strategy.md') === 0 && ['architect', 'devops', 'backend-dev', 'muffy:researcher'].every((r) => write(r, 'E:\\repo\\docs\\strategy.md', 'Edit') === 2));
  check('write-scope: the Orchestrator (no agent_type) is never blocked', write(undefined, 'docs/strategy.md') === 0);
  check('write-scope: the diagrammer draws every architecture diagram; the architect writes ADRs and specs, never a diagram file or baseline.md; the designer cannot draw them', write('diagrammer', 'docs/architecture/overview.html') === 0 && write('diagrammer', 'docs/architecture/flows/login.html') === 0 && write('diagrammer', 'docs/architecture/states/order.html') === 0 && write('diagrammer', 'docs/architecture/changes/payments.html') === 0 && write('diagrammer', 'docs/architecture/data-models/coupon.html') === 0 && write('designer', 'docs/architecture/overview.html') === 2 && write('designer', 'docs/architecture/flows/login.html') === 2 && write('architect', 'docs/architecture/data-models/coupon.html') === 2 && write('diagrammer', 'docs/architecture/deployment.html') === 0 && write('architect', 'docs/architecture/overview.html') === 2 && write('architect', 'docs/architecture/flows/login.html') === 2 && write('architect', 'docs/architecture/deployment.html') === 2 && write('frontend-dev', 'docs/architecture/changes/payments.html') === 2 && write('frontend-dev', 'docs/architecture/states/order.html') === 2 && write('architect', 'docs/adr/0002-x.md') === 0 && write('architect', 'docs/architecture/baseline.md') === 2 && write('architect', 'docs/architecture/notes.md') === 2);
  check('write-scope: only the diagrammer writes architecture diagrams, only the researcher the baseline; the diagrammer writes no baseline, design system or strategy', write('frontend-dev', 'docs/architecture/data-model.html') === 2 && write('researcher', 'docs/architecture/baseline.md') === 0 && write('researcher', 'docs/architecture/overview.html') === 2 && write('diagrammer', 'docs/architecture/baseline.md') === 2 && write('diagrammer', 'docs/design-system/README.md') === 2 && write('diagrammer', 'docs/strategy.md') === 2);
      check('write-scope: only the diagrammer writes plan diagrams; the product-manager specs their facts and cannot write the file', write('diagrammer', 'docs/plan/pay-gantt.html') === 0 && write('designer', 'docs/plan/pay-gantt.html') === 2 && write('product-manager', 'docs/plan/pay-gantt.html') === 2 && write('architect', 'docs/plan/pay-story-map.html') === 2 && write('architect', 'docs/plan/pay.md') === 0);
  check('write-scope: other files and non-write tools pass', write('backend-dev', 'src/a.ts') === 0 && write('architect', 'docs/strategy.md', 'Read') === 0);
}
{
  const tmp = mkdtempSync(join(tmpdir(), 'muffy-checks-'));
  const copy = () => { const d = mkdtempSync(join(tmp, 't-')); cpSync(fixtureDir, d, { recursive: true }); return d; };
  const patch = (d, file, fn) => writeFileSync(join(d, file), fn(readFileSync(join(d, file), 'utf8')));
  check('check-artifacts: the fixture passes the Budget, Platform and deploy.md checks', checkTask(fixtureDir).length === 0, checkTask(fixtureDir).join('; '));
  let d = copy(); patch(d, 'contract.md', (t) => t.replace('Budget: none. ', ''));
  check('check-artifacts: a Cost line without a Budget verdict fails', checkTask(d).some((e) => e.includes('Budget:')));
  d = copy(); patch(d, 'contract.md', (t) => t.replace('Budget: none.', 'Budget: over, 300/mo vs ceiling 200.'));
  check('check-artifacts: Budget over without a cheaper option fails, with one passes', checkTask(d).some((e) => e.includes('cheaper')) && checkTask((patch(d, 'contract.md', (t) => t.replace('vs ceiling 200.', 'vs ceiling 200; cheaper option: 150/mo.')), d)).length === 0);
  d = copy(); patch(d, 'contract.md', (t) => t.replace('Existing codebase.', 'Existing codebase. Platform: cli.'));
  check('check-artifacts: Platform cli needs contract/cli.md; an unknown Platform fails', checkTask(d).some((e) => e.includes('cli.md')) && (patch(d, 'contract.md', (t) => t.replace('Platform: cli.', 'Platform: toaster.')), checkTask(d).some((e) => e.includes('toaster'))));
  d = copy(); patch(d, 'deploy.md', (t) => t.replace('## Infra cost', '## Costs'));
  check('check-artifacts: deploy.md missing ## Infra cost fails', checkTask(d).some((e) => e.includes('Infra cost')));
  d = copy(); patch(d, 'checkpoint.md', (t) => t.replace('infra: later', 'infra: propose'));
  check('check-artifacts: infra: propose needs ## Infra options; options without propose fail', checkTask(d).some((e) => e.includes('Infra options')) && (patch(d, 'checkpoint.md', (t) => t.replace('infra: propose', 'infra: later')), patch(d, 'deploy.md', (t) => `${t}\n## Infra options\nA or B\n`), checkTask(d).some((e) => e.includes('only for infra: propose'))));
  d = copy(); patch(d, 'deploy.md', (t) => t.replace('Gap: no restore drill for Postgres yet.', 'Nothing else.'));
  check('check-artifacts: a practice gap missing from ## Risks fails', checkTask(d).some((e) => e.includes('not listed under ## Risks')));
  const { checkTask: checkpoint } = await import('../skills/muffy/scripts/check-checkpoint.mjs');
  check('check-checkpoint: the fixture passes', checkpoint(fixtureDir).length === 0, checkpoint(fixtureDir).join('; '));
  d = copy(); patch(d, 'checkpoint.md', (t) => t.replace('infra: later · budget: ok', 'infra: maybe · budget: fine · diagrams: 2 published'));
  const bad = checkpoint(d);
  check('check-checkpoint: unknown infra and budget values fail, a valid diagrams item passes', bad.some((e) => e.includes('infra: maybe')) && bad.some((e) => e.includes('budget: fine')) && !bad.some((e) => e.includes('diagrams')), bad.join('; '));
  const spawnLine = (step, agent, note) => [step, agent, 'sonnet', 'low', '1', 'pass', '0', note].join('\t');
  d = copy(); writeFileSync(join(d, 'spawns.tsv'), `${[spawnLine('1', 'researcher', 'L2 brief tok:95290'), spawnLine('2', 'product-manager', '22 AC tok:n/a')].join('\n')}\n`);
  const tokOk = checkpoint(d);
  writeFileSync(join(d, 'spawns.tsv'), `${spawnLine('1', 'researcher', 'L2 brief, 95k tokens')}\n`);
  const tokMissing = checkpoint(d);
  check('check-checkpoint: a spawn note must end with tok:<n> or tok:n/a', tokOk.length === 0 && tokMissing.some((e) => e.includes('tok:<n>')), [...tokOk, ...tokMissing].join('; '));
  writeFileSync(join(d, 'spawns.tsv'), `${['1', '2', '3'].map((s, i) => spawnLine(s, 'architect', i ? 'contract tok:n/a' : 'contract tok:4100')).join('\n')}\n`);
  const open = checkpoint(d);
  patch(d, 'checkpoint.md', (t) => t.replace('Step 6 approved.', 'Step 12 closed.'));
  const closed = checkpoint(d);
  writeFileSync(join(d, 'spawns.tsv'), `${['1', '2', '3'].map((s, i) => spawnLine(s, 'architect', i === 2 ? 'contract tok:n/a' : 'contract tok:4100')).join('\n')}\n`);
  check('check-checkpoint: tok:n/a on most spawns fails only once the task is closed', open.length === 0 && closed.some((e) => e.includes('2 of 3')) && checkpoint(d).length === 0, [...open, ...closed].join('; '));
  const pre = (...a) => spawnSync(process.execPath, [rel('skills/muffy/scripts/devops-preflight.mjs'), ...a], { cwd: tmp, encoding: 'utf8' });
  check('preflight: --toolchain node passes with no .nvmrc (a non-Node repo), a wrong version fails, an unknown name is a usage error', pre('--toolchain', 'node').status === 0 && pre('--toolchain', 'node=0.0.1').status === 1 && pre('--toolchain', 'toaster').status === 2 && pre().status === 1);
  rmSync(tmp, { recursive: true, force: true });
}

/* 7d. baseline freshness (references/baseline-freshness.md) */
{
  const repo = mkdtempSync(join(tmpdir(), 'muffy-baseline-'));
  const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  const put = (file, text) => { mkdirSync(dirname(join(repo, file)), { recursive: true }); writeFileSync(join(repo, file), text); };
  const run = (...a) => spawnSync(process.execPath, [rel('skills/muffy/scripts/check-baseline.mjs'), repo, ...a], { encoding: 'utf8' });
  git('init', '-q'); git('config', 'user.email', 't@t.t'); git('config', 'user.name', 't'); git('config', 'core.autocrlf', 'false');
  put('package.json', JSON.stringify({ dependencies: { next: '^14.1.0' } })); put('.nvmrc', 'v22.14.0\n'); put('src/a.ts', 'export const a = 1\n');
  git('add', '-A'); git('commit', '-qm', 'init');
  const sha = git('rev-parse', '--short', 'HEAD').stdout.trim();
  check('baseline: no baseline file is exit 3', run().status === 3);
  put('docs/architecture/baseline.md', `---\ncommit: ${sha}\n---\n## Stack\nNode 22, next 14. Entry \`src/a.ts:1\`, layout \`src/\`.\n`);
  git('add', '-A'); git('commit', '-qm', 'baseline');
  const green = run();
  check('baseline: a fresh baseline is green (exit 0)', green.status === 0 && green.stdout.startsWith('baseline: green'), green.stdout);
  put('package.json', JSON.stringify({ dependencies: { next: '^15.0.0' } }));
  const red = run();
  check('baseline: a dependency major that differs from the manifest is red (exit 2)', red.status === 2 && red.stdout.includes('next'), red.stdout);
  put('package.json', JSON.stringify({ dependencies: { next: '^14.1.0' } }));
  rmSync(join(repo, 'src/a.ts'));
  const yellow = run('--json');
  check('baseline: a cited path that is gone is yellow (exit 1)', yellow.status === 1 && yellow.stdout.includes('src/a.ts'), yellow.stdout);
  put('src/a.ts', 'export const a = 1\n');
  for (const n of [1, 2, 3]) put(`src/b${n}.ts`, `export const b = ${n}\n`);
  git('add', '-A'); git('commit', '-qm', 'more');
  check('baseline: covered changes under the threshold stay green; over --yellow they turn yellow, over --red red', run().status === 0 && run('--yellow', '3').status === 1 && run('--yellow', '1', '--red', '3').status === 2);
  put('.team/baseline-thresholds.json', JSON.stringify({ yellow: 2, red: 50 }));
  check('baseline: .team/baseline-thresholds.json sets the thresholds', run().status === 1);
  put('docs/architecture/baseline.md', 'no commit line here\n');
  check('baseline: a baseline with no commit line is yellow, never an error', run().status === 1);
  check('baseline: an unknown flag is a usage error (exit 3)', run('--nope').status === 3);
  const { checkTask: cp } = await import('../skills/muffy/scripts/check-checkpoint.mjs');
  const d = mkdtempSync(join(repo, 'cp-')); cpSync(fixtureDir, d, { recursive: true });
  const status = (v) => { const f = join(d, 'checkpoint.md'); writeFileSync(f, readFileSync(f, 'utf8').replace(/infra: later(?: · baseline: \w+)?/, `infra: later · baseline: ${v}`)); return cp(d); };
  check('check-checkpoint: baseline: green|yellow|red pass, another value fails', status('yellow').length === 0 && status('purple').some((e) => e.includes('baseline: purple')));
  rmSync(repo, { recursive: true, force: true });
}

/* 7e. one source for manifests and skipped folders (scripts/repo-facts.mjs) */
{
  const read = (f) => readFileSync(rel('skills/muffy/scripts', f), 'utf8');
  check('repo-facts: scan-repo and check-baseline import the shared lists instead of keeping their own', ['scan-repo.mjs', 'check-baseline.mjs'].every((f) => read(f).includes("./repo-facts.mjs") && !/const (SKIP|MANIFEST) = /.test(read(f))));
  const repo = mkdtempSync(join(tmpdir(), 'muffy-facts-'));
  const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  const put = (file, text) => { mkdirSync(dirname(join(repo, file)), { recursive: true }); writeFileSync(join(repo, file), text); };
  git('init', '-q'); git('config', 'user.email', 't@t.t'); git('config', 'user.name', 't'); git('config', 'core.autocrlf', 'false');
  put('.gitignore', 'generated/\n');
  put('src/a.ts', 'a\n'); put('src/b.ts', 'b\n');
  put('Pods/Dep/x.swift', 'x\n'); put('.dart_tool/y.dart', 'y\n'); put('generated/g1.ts', 'g\n'); put('generated/g2.ts', 'g\n');
  const scan = JSON.parse(spawnSync(process.execPath, [rel('skills/muffy/scripts/scan-repo.mjs'), repo], { encoding: 'utf8' }).stdout);
  check('scan-repo: skips dependency folders by name and folders .gitignore keeps out of git, counts the rest', scan.sourceFiles.byExtension['.ts'] === 2 && !scan.sourceFiles.byExtension['.swift'] && !scan.sourceFiles.byExtension['.dart'], JSON.stringify(scan.sourceFiles));
  put('App.csproj', '<Project/>\n'); put('pubspec.yaml', 'name: x\n');
  const scan2 = JSON.parse(spawnSync(process.execPath, [rel('skills/muffy/scripts/scan-repo.mjs'), repo], { encoding: 'utf8' }).stdout);
  check('scan-repo: lists Flutter, .NET and Xcode manifests from the shared list', scan2.manifests.includes('pubspec.yaml') && scan2.manifests.includes('App.csproj'), JSON.stringify(scan2.manifests));
  git('add', '-A', '-f'); git('commit', '-qm', 'init');
  const sha = git('rev-parse', '--short', 'HEAD').stdout.trim();
  put('docs/architecture/baseline.md', `---\ncommit: ${sha}\n---\n## Stack\nLayout \`src/\`.\n`);
  git('add', '-A'); git('commit', '-qm', 'baseline');
  put('node_modules/dep/package.json', '{}\n'); put('Pods/Dep/Package.resolved', '{}\n'); put('vendor/lib/go.sum', 'x\n');
  git('add', '-A', '-f'); git('commit', '-qm', 'someone committed dependency folders');
  const r = spawnSync(process.execPath, [rel('skills/muffy/scripts/check-baseline.mjs'), repo, '--yellow', '1'], { encoding: 'utf8' });
  check('check-baseline: manifests committed inside dependency folders do not age the baseline', r.status === 0 && r.stdout.startsWith('baseline: green'), r.stdout);
  put('package.json', '{}\n'); git('add', '-A'); git('commit', '-qm', 'real manifest');
  check('check-baseline: a real manifest change still counts', spawnSync(process.execPath, [rel('skills/muffy/scripts/check-baseline.mjs'), repo, '--yellow', '1'], { encoding: 'utf8' }).status === 1);
  rmSync(repo, { recursive: true, force: true });
}

/* 7f. learning a stack (references/stack-learning.md): stale notes, guard entries, project extensions */
{
  const repo = mkdtempSync(join(tmpdir(), 'muffy-stack-'));
  const put = (file, text) => { mkdirSync(dirname(join(repo, file)), { recursive: true }); writeFileSync(join(repo, file), text); };
  const notes = (...a) => spawnSync(process.execPath, [rel('skills/muffy/scripts/check-stack-notes.mjs'), repo, ...a], { encoding: 'utf8' });
  put('package.json', JSON.stringify({ dependencies: { next: '^15.0.0', 'solid-js': '1.8.1' } }));
  put('docs/stacks/next.md', '## Next\nSource: https://example.test/next, version 14.2, 2026-01-01\n- Whole-suite: `npx vitest run --coverage`\n');
  put('docs/stacks/solid-js.md', '## Solid\nSource: https://example.test/solid, version 1.8, 2026-01-01\n');
  put('docs/stacks/odd.md', '## Odd\nno source line\n');
  const all = notes();
  check('stack-notes: a note for another major version is stale (exit 1), a matching one fresh, one without a version unchecked', all.status === 1 && /next: stale \(note is for 14\.2, the repo uses 15\.0\.0\)/.test(all.stdout) && /solid-js: fresh/.test(all.stdout) && /odd: unchecked/.test(all.stdout), all.stdout);
  check('stack-notes: a named framework with no note is missing (exit 1); a fresh one alone exits 0', notes('svelte').status === 1 && /svelte: missing/.test(notes('svelte').stdout) && notes('solid-js').status === 0);
  const entries = JSON.parse(notes('--guard-entries').stdout);
  check('stack-notes: --guard-entries turns a Whole-suite line into an anchored regex the full-regression guard reads', entries.length === 1 && new RegExp(entries[0]).test('npx vitest run --coverage') && !new RegExp(entries[0]).test('npx vitest run --coverage src/a.test.ts'), JSON.stringify(entries));
  check('stack-notes: an unknown flag is a usage error (exit 3)', notes('--nope').status === 3);
  put('mix.exs', 'defmodule X do\nend\n'); put('deps/lib/a.ex', 'a\n'); put('lib/a.ex', 'a\n');
  put('.team/stack-extensions.json', JSON.stringify({ manifests: ['mix.exs', '../evil'], skipDirs: ['deps'], platforms: ['Game'] }));
  const scan = JSON.parse(spawnSync(process.execPath, [rel('skills/muffy/scripts/scan-repo.mjs'), repo], { encoding: 'utf8' }).stdout);
  check('extensions: .team/stack-extensions.json adds a manifest and a skipped folder, and ignores names with path tricks', scan.manifests.includes('mix.exs') && !scan.manifests.includes('../evil'), JSON.stringify(scan.manifests));
  const task = join(repo, '.team', 'game-task'); mkdirSync(task, { recursive: true });
  put('.team/game-task/contract.md', '# Contract\n\n## Stack\nPlatform: game. Runtime: Elixir 1.17.\n\n## Cost\nBudget: none. No new recurring cost\n');
  const listed = checkTask(task);
  rmSync(join(repo, '.team', 'stack-extensions.json'));
  check('extensions: a Platform listed under platforms passes the contract check; unlisted it fails', !listed.some((e) => e.includes('Platform')) && checkTask(task).some((e) => e.includes('Platform "game"')), listed.join('; '));
  rmSync(repo, { recursive: true, force: true });
}

/* 7g. designer: design-system intake questions, screen map, write scope for design files */
{
  // the intake never stops the run: the designer finishes on the starter and returns done with one non-blocking question
  const intakeQ = { id: 'Q-1', question: 'Do you have a brand or a reference for how it should look?', why: 'Sets the colors, type and tone of every screen; can be changed later', options: ['not yet, choose a sensible starter style for me', 'yes, I will share it', 'I want to pick a personality', 'make it resemble a product I will describe'], default: 'not yet, choose a sensible starter style for me', blocking: false };
  const handoff = { role: 'designer', task: 't', step: '3', round: 1, status: 'done', paths_written: ['docs/design-system/tokens.css', 'docs/design-system/README.md'], blockers: [], quality_checks: { passed: true, failed: [] }, summary: 'design on the starter style; asks for a brand', questions: [intakeQ] };
  const handoffSchema = JSON.parse(readFileSync(rel('skills/muffy/schemas/handoff.schema.json'), 'utf8'));
  check('schema: the designer may carry the intake question on a done hand-off; a frontend-dev may not', validate(handoffSchema, handoff).length === 0 && validate(handoffSchema, { ...handoff, role: 'frontend-dev' }).length > 0, validate(handoffSchema, handoff).join('; '));
  check('schema: a question on a done, blocked or not-ready hand-off must be blocking: false; needs-input may block', ['done', 'blocked', 'not-ready'].every((status) => validate(handoffSchema, { ...handoff, status, blockers: status === 'done' ? [] : handoff.blockers, questions: [{ ...intakeQ, blocking: true }] }).length > 0) && validate(handoffSchema, { ...handoff, status: 'needs-input', questions: [{ ...intakeQ, blocking: true }] }).length === 0);
  {
    const R = (f) => readFileSync(rel(f), 'utf8');
    const intake = R('agents/references/designer/design-system-intake.md');
    check('designer: the intake returns status done with one blocking: false question, never needs-input for it', intake.includes('return `status: done` with exactly one entry in `questions[]`, `blocking: false`') && !intake.includes('Return `status: needs-input` with exactly one'));
    const step0 = intake.split('### Step 0')[1]?.split('###')[0] ?? '';
    check('designer: by default Step 0 reads the stack from baseline or manifests, not the contract written in the same parallel message', !step0.includes("the contract's Stack") && step0.includes('do not wait for its Stack'));
    check('requirements: a done hand-off\'s non-blocking questions go to the next human gate without resuming the agent', R('skills/muffy/references/requirements.md').includes('Do not resume the agent for them: add them to the next human question (`pause:design-review`'));
    const review = R('skills/muffy/references/design-review.md');
    check('design-review: the 3c question links the screen map and carries the intake question', review.includes('docs/design/screen-map.html') && review.includes('non-blocking intake question'));
    const row3e = R('skills/muffy/references/steps.md').split('\n').find((l) => l.startsWith('| 3e |')) ?? '';
    check('steps: 3e has the diagrammer draw the architect\'s, the product-manager\'s and the designer\'s screen-map specs', row3e.includes('`diagrammer`') && row3e.includes("designer's screen-map spec"));
    const waits = intake.split(/\r?\n/).filter((l) => /^- \*\*(New project|Platform not named|The UI stack changes|A provider with its own UI|Monorepo with several apps)/.test(l));
    check('designer: the design system waits for the contract in exactly five named cases', /### When the design system waits for the contract/.test(intake) && waits.length === 5, waits.join(' | '));
    check('designer: while it waits, step 3 is wireframes with a marker line and no design-system file, and the intake question still rides on done', intake.includes('`Design system: after contract (<which condition>)` as the first line of `design.md`') && intake.includes('write no `docs/design-system/` file') && intake.includes('still return `done` with the intake question'));
    check('designer: the align round must clear the marker (quality check), and the starter otherwise still runs in parallel', R('agents/references/designer/quality-checks.md').includes('No `Design system: after contract` line is left in `design.md`') && intake.includes('do not wait for its Stack (a mismatch is fixed'));
    const row3b = R('skills/muffy/references/steps.md').split('\n').find((l) => l.startsWith('| 3b |')) ?? '';
    check('steps: 3b skips the first publish of wireframes and publishes once after the align round', row3b.includes('skip the first publish') && row3b.indexOf('skip the first publish') > row3b.indexOf('designer aligns fields'));
    const gd = (c) => spawnSync(process.execPath, [rel('skills/muffy/scripts/guard-bash-allowlist.mjs')], { input: JSON.stringify({ tool_name: 'Bash', agent_type: 'diagrammer', cwd: process.cwd(), tool_input: { command: c } }), encoding: 'utf8' }).status;
    check('diagrammer: the Bash guardrail names the diagram checks, and the guard allows exactly those', R('agents/references/diagrammer/rules-and-guardrails.md').includes('`check-diagram.mjs`, `check-diagram-render.mjs`, `diagram-import.mjs` (never with `--html`)') && ['node .claude/skills/muffy/scripts/check-diagram.mjs docs/design/screen-map.html', 'node .claude/skills/muffy/scripts/check-diagram-render.mjs docs/design/screen-map.html', 'node .claude/skills/muffy/scripts/diagram-import.mjs a.mmd --json'].every((c) => gd(c) === 0) && ['node .claude/skills/muffy/scripts/diagram-import.mjs a.mmd --html out.html', 'node .claude/skills/muffy/scripts/check-diagram.mjs a.html; rm -rf .', 'npm test', 'git commit -m x'].every((c) => gd(c) === 2));
    check('designer: the guardrail no longer claims every diagram, and still allows the checks it needs', !R('agents/references/designer/rules-and-guardrails.md').includes('You draw every diagram muffy produces'));
  }
  const { check: diagramErrors } = await import('../skills/muffy/scripts/check-diagram.mjs');
  const tpl = readFileSync(rel('skills/muffy/templates/diagram.html'), 'utf8');
  const withJson = (j) => tpl.replace(/(<script type="application\/json" id="diagram">)[\s\S]*?(<\/script>)/, `$1${JSON.stringify(j)}$2`);
  const map = { kind: 'screenmap', title: 'App screens', nodes: [{ id: 'in', label: 'Sign in', type: 'entry', col: 1, row: 1 }, { id: 'home', label: 'Home', type: 'screen', note: 'all roles', col: 2, row: 1 }, { id: 'set', label: 'Settings', type: 'modal', col: 3, row: 1 }], edges: [{ from: 'in', to: 'home', label: 'tap Sign in' }, { from: 'home', to: 'set', label: 'tap gear' }] };
  check('diagram: a valid screen map passes', diagramErrors(withJson(map)).length === 0, diagramErrors(withJson(map)).join('; '));
  check('diagram: a screen map edge without an action label, an unknown node type, or an edge over another screen fails', [{ ...map, edges: [{ from: 'in', to: 'home' }] }, { ...map, nodes: [{ ...map.nodes[0], type: 'service' }, ...map.nodes.slice(1)] }, { ...map, edges: [{ from: 'in', to: 'set', label: 'deep link' }] }].every((j) => diagramErrors(withJson(j)).length > 0));
  const W = rel('skills/muffy/scripts/guard-write-scope.mjs');
  const write = (agent_type, file_path) => spawnSync(process.execPath, [W], { input: JSON.stringify({ tool_name: 'Write', agent_type, tool_input: { file_path } }), encoding: 'utf8' }).status;
  check('write-scope: only the diagrammer writes the screen map; the designer and the architect write the design system, nobody else', write('diagrammer', 'docs/design/screen-map.html') === 0 && write('designer', 'docs/design/screen-map.html') === 2 && write('architect', 'docs/design/screen-map.html') === 2 && write('designer', 'docs/design-system/README.md') === 0 && write('architect', 'docs/design-system/README.md') === 0 && write('frontend-dev', 'docs/design-system/tokens.css') === 2 && write('frontend-dev', 'src/Login.tsx') === 0);
}

/* 7h. review fixes for fc42674: guards, baseline, diagram, stack notes, preflight, repo facts, artifact scope, docs order */
{
  const S = (f) => rel('skills/muffy/scripts', f);
  const node = (script, args, opts = {}) => spawnSync(process.execPath, [S(script), ...args], { encoding: 'utf8', ...opts });
  const hook = (script, payload) => spawnSync(process.execPath, [S(script)], { input: JSON.stringify(payload), encoding: 'utf8' }).status;

  // guard-bash: stack-note mode and the architect's stack ladder start with check-stack-notes
  const bash = (agent_type, command) => hook('guard-bash-allowlist.mjs', { tool_name: 'Bash', agent_type, tool_input: { command } });
  check('guard-bash: researcher and architect may run check-stack-notes', bash('researcher', 'node .claude/skills/muffy/scripts/check-stack-notes.mjs next') === 0 && bash('muffy:architect', 'node .claude/skills/muffy/scripts/check-stack-notes.mjs') === 0);
  // the guard's block message lists what it allows; §9 must name each of those scripts
  const allowed = readFileSync(rel('skills/muffy/scripts/guard-bash-allowlist.mjs'), 'utf8').match(/scripts\/\{([^}]+)\}\.mjs/)[1].split(',').map((s) => s.replace(/\s*\(.*\)$/, ''));
  const rule9 = readFileSync(rel('skills/muffy/references/hooks-enforcement.md'), 'utf8').split(/^## 9\./m)[1].split(/^## /m)[0];
  check('guard-bash: the documented allowlist names every script the guard allows', allowed.length >= 8 && allowed.every((s) => new RegExp(`[{,\`]${s}[,}.]`).test(rule9)));

  // write-scope: anchored at the project root, case-folded where the file system ignores case
  const ws = (agent_type, file_path, cwd = 'E:\\repo') => hook('guard-write-scope.mjs', { tool_name: 'Write', agent_type, cwd, tool_input: { file_path } });
  check('write-scope: a monorepo package\'s own docs/architecture/ is not the shared one', ws('docs-writer', 'E:\\repo\\packages\\sdk\\docs\\architecture\\README.md') === 0 && ws('docs-writer', 'packages/sdk/docs/strategy.md') === 0);
  check('write-scope: root files are still guarded by absolute and relative path', ws('frontend-dev', 'E:\\repo\\docs\\strategy.md') === 2 && ws('frontend-dev', './docs/strategy.md') === 2 && ws('product-manager', 'E:\\repo\\docs\\strategy.md') === 0);
  check('write-scope: a path outside the project root falls back to matching anywhere', ws('architect', 'E:\\other\\docs\\strategy.md') === 2);
  if (process.platform === 'win32' || process.platform === 'darwin') check('write-scope: Docs/Strategy.md is the same file on a case-insensitive file system', ws('frontend-dev', 'E:\\repo\\Docs\\Strategy.md') === 2 && ws('frontend-dev', 'e:\\REPO\\docs\\strategy.md') === 2);
  // guard-env: .env is never printed, including through inline interpreter code
  const env = (command, tool_name = 'Bash') => hook('guard-env.mjs', { tool_name, tool_input: { command } });
  check('guard-env: printing .env and an unquiet grep are blocked; a NAME= presence check passes', env('cat .env') === 2 && env('Get-Content .env.local', 'PowerShell') === 2 && env('grep API .env') === 2 && env("grep -q '^API_KEY=sk-' .env.local && echo present") === 0);
  check('guard-env: inline code that names .env or dotenv is blocked',
    [`node -e "console.log(require('fs').readFileSync('.env','utf8'))"`, `node -p "require('dotenv').config().parsed"`, `python3 -c "print(open('.env.local').read())"`, `python -c "from dotenv import dotenv_values; print(dotenv_values())"`, `ruby -e 'puts File.read(".env")'`, `perl -ne print .env`, `node --env-file=.env -e "console.log(process.env)"`, `python - <<'EOF'\nprint(open('.env').read())\nEOF`, `pwsh -Command "Get-Content .env"`].every((c) => env(c) === 2));
  check('guard-env: inline code without .env, a script run with --env-file, and .env.example pass',
    [`node -e "console.log(process.version)"`, `python -c "import sys; print(sys.version)"`, 'node --env-file=.env server.js', 'npm run migrate', `node -e "require('fs').readFileSync('.env.example','utf8')"`, 'python -m pytest tests/unit'].every((c) => env(c) === 0));
  check('guard-env: every role with free Bash is told to run env-loading code through a project script, not inline',
    ['backend-dev', 'frontend-dev', 'devops', 'qa-tester'].every((r) => { const t = readFileSync(rel(`agents/references/${r}/rules-and-guardrails.md`), 'utf8'); return t.includes('`.env*`') && /never inline `node -e`/.test(t) && t.includes('hooks-enforcement.md](../../../skills/muffy/references/hooks-enforcement.md) §6'); }));
  // guard-git: subagents never change git config, remotes, hooks or .git/; the Orchestrator is never blocked
  const gitBash = (agent_type, command, tool_name = 'Bash') => hook('guard-git.mjs', { tool_name, agent_type, tool_input: { command } });
  const gitWrite = (agent_type, file_path) => hook('guard-git.mjs', { tool_name: 'Edit', agent_type, tool_input: { file_path } });
  check('guard-git: config writes, -c overrides, remote changes and core.hooksPath are blocked for subagents',
    ['git config core.hooksPath x', 'git config --global user.name bot', 'git -C .worktrees/be-x config remote.origin.url u', 'git -c commit.gpgsign=false commit -m x', 'git remote set-url origin https://evil', 'git remote add up u', 'git status && git config --unset core.bare'].every((c) => gitBash('backend-dev', c) === 2) && gitBash('devops', 'git config alias.x "!sh"', 'PowerShell') === 2);
  check('guard-git: git reads and everyday commands pass',
    ['git config --get remote.origin.url', 'git config --list', 'git remote -v', 'git remote get-url origin', 'git status', 'git commit -m "add .gitignore"', 'cp .gitignore .gitignore.bak', 'cat .git/HEAD', 'git log --oneline -5'].every((c) => gitBash('backend-dev', c) === 0));
  check('guard-git: writes into .git/ by tool or shell are blocked, .github/ is not', gitWrite('frontend-dev', 'E:\\repo\\.git\\config') === 2 && gitWrite('qa-tester', '.worktrees/qa-x/.git') === 2 && gitWrite('devops', '.github/workflows/ci.yml') === 0 && gitBash('devops', 'echo "#!/bin/sh" > .git/hooks/pre-push') === 2 && gitBash('backend-dev', 'rm -rf .git/hooks') === 2 && gitBash('backend-dev', 'Set-Content .git\\config x', 'PowerShell') === 2);
  check('guard-git: the Orchestrator (no agent_type) is never blocked', gitBash(undefined, 'git remote set-url origin u') === 0 && gitWrite(undefined, '.git/config') === 0);
  check('install: the git guard is installed with --with-guard and documented in §13', readFileSync(rel('install.mjs'), 'utf8').includes("'guard-git.mjs', matcher: 'Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit'") && /^## 13\. Git setup/m.test(readFileSync(rel('skills/muffy/references/hooks-enforcement.md'), 'utf8')));
  check('install: write-scope hook matches NotebookEdit, and an older narrower matcher is widened', readFileSync(rel('install.mjs'), 'utf8').includes("'guard-write-scope.mjs', matcher: 'Write|Edit|MultiEdit|NotebookEdit'") && readFileSync(rel('install.mjs'), 'utf8').includes('update matcher'));

  // check-baseline: code identifiers are not paths; prose numbers outside Stack/Runtime are not versions
  {
    const repo = mkdtempSync(join(tmpdir(), 'muffy-review-baseline-'));
    const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
    const put = (file, text) => { mkdirSync(dirname(join(repo, file)), { recursive: true }); writeFileSync(join(repo, file), text); };
    git('init', '-q'); git('config', 'user.email', 't@t.t'); git('config', 'user.name', 't'); git('config', 'core.autocrlf', 'false');
    put('package.json', JSON.stringify({ dependencies: { next: '^14.1.0', ms: '^2.1.3', debug: '^4.3.0' } })); put('src/a.ts', 'a\n');
    git('add', '-A'); git('commit', '-qm', 'init');
    const sha = git('rev-parse', '--short', 'HEAD').stdout.trim();
    const baseline = (stack) => put('docs/architecture/baseline.md', `---\ncommit: ${sha}\n---\n## Stack\n${stack}\n## Conventions\nAuth reads \`req.user\`, config \`process.env\`, replies with \`res.json\`, starts with \`app.listen\`, logs \`console.error\`. Entry \`src/a.ts\`.\nLatency 200 ms, p99 400 ms. Next steps: 2. debug 9 calls per request.\n`);
    baseline('Node 22, Next.js 14, ms 2, debug 4.');
    const fresh = node('check-baseline.mjs', [repo]);
    check('check-baseline: req.user, process.env, res.json are code, not missing paths; prose numbers outside ## Stack are not versions', fresh.status === 0 && fresh.stdout.startsWith('baseline: green'), fresh.stdout);
    baseline('Node 22, Next.js 13, ms 2.');
    const red = node('check-baseline.mjs', [repo]);
    check('check-baseline: "Next.js 13" in ## Stack against next ^14 is still red', red.status === 2 && red.stdout.includes('next: baseline 13'), red.stdout);
    baseline('Node 22, next 14. Gone: `src/gone.ts`, `lib/old/`.');
    check('check-baseline: a cited source file that is gone still counts', node('check-baseline.mjs', [repo]).stdout.includes('src/gone.ts'));
    rmSync(repo, { recursive: true, force: true });
  }

  // repo-facts: non-ASCII ignored folders, path tricks in stack-extensions names
  {
    const repo = mkdtempSync(join(tmpdir(), 'muffy-review-facts-'));
    const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
    const put = (file, text) => { mkdirSync(dirname(join(repo, file)), { recursive: true }); writeFileSync(join(repo, file), text); };
    git('init', '-q');
    put('.gitignore', 'gen-ทด/\n'); put('src/a.ts', 'a\n'); put('gen-ทด/b.ts', 'b\n');
    const { gitIgnoredDirs, loadExtensions } = await import('../skills/muffy/scripts/repo-facts.mjs');
    check('repo-facts: an ignored folder with a non-ASCII name comes back as its real name', gitIgnoredDirs(repo)?.has('gen-ทด'), JSON.stringify([...(gitIgnoredDirs(repo) ?? [])]));
    const scan = JSON.parse(node('scan-repo.mjs', [repo]).stdout);
    check('scan-repo: files inside that ignored folder are not counted', scan.sourceFiles.byExtension['.ts'] === 1, JSON.stringify(scan.sourceFiles));
    put('.team/stack-extensions.json', JSON.stringify({ manifests: ['mix.exs', '../evil', 'a/../b', '/etc/passwd'], skipDirs: ['deps'] }));
    check('repo-facts: stack-extensions names with "..", or starting with "/", are dropped by the filter itself', JSON.stringify(loadExtensions(repo).manifests) === '["mix.exs"]', JSON.stringify(loadExtensions(repo).manifests));
    rmSync(repo, { recursive: true, force: true });
  }

  // check-diagram: script injection in any case, plain-string labels, flow actor ids, overview commit, CLI through any path
  {
    const { check: diagramErrors } = await import('../skills/muffy/scripts/check-diagram.mjs');
    const tpl = readFileSync(rel('skills/muffy/templates/diagram.html'), 'utf8');
    const withJson = (j) => tpl.replace(/(<script type="application\/json" id="diagram">)[\s\S]*?(<\/script>)/, () => `<script type="application/json" id="diagram">${JSON.stringify(j)}</script>`);
    const arch = { kind: 'architecture', title: 'T', commit: 'abc1234', nodes: [{ id: 'a', label: 'A', type: 'app', col: 1, row: 1 }, { id: 'b', label: 'B', type: 'service', col: 2, row: 1 }], edges: [{ from: 'a', to: 'b', label: 'x' }] };
    const label = (l) => withJson({ ...arch, nodes: [{ ...arch.nodes[0], label: l }, arch.nodes[1]] });
    check('diagram: "</SCRIPT>", "<script" and "<!--" in a label fail in any case', ['x</SCRIPT><img src=x onerror=alert(1)>', 'x<Script>', 'x<!--'].every((l) => diagramErrors(label(l)).some((e) => e.includes('</script'))));
    check('diagram: a "<" written as \\u003c passes', diagramErrors(withJson(arch).replace('"label":"A"', '"label":"a \\u003c b"')).length === 0, diagramErrors(withJson(arch).replace('"label":"A"', '"label":"a \\u003c b"')).join('; '));
    check('diagram: a label that is not a string fails', diagramErrors(label({ x: 1 })).some((e) => e.includes('plain string')));
    const flow = { kind: 'flow', title: 'F', actors: [{ id: 'u', label: 'User', type: 'app' }, { id: 'u', label: 'Again', type: 'app' }], steps: [{ from: 'u', to: 'u', label: 'x' }] };
    check('diagram: duplicate flow actor ids fail', diagramErrors(withJson(flow)).some((e) => e.includes('duplicate')));
    const noCommit = withJson({ ...arch, commit: undefined });
    check('diagram: the architecture overview needs commit; another diagram does not', diagramErrors(noCommit, 'docs/architecture/overview.html').some((e) => e.includes('commit')) && diagramErrors(noCommit, 'docs/architecture/flows/x.html').length === 0 && diagramErrors(withJson(arch), 'docs\\architecture\\overview.html').length === 0);
    const tmp = mkdtempSync(join(tmpdir(), 'muffy-review-diagram-'));
    writeFileSync(join(tmp, 'bad.html'), label('x</SCRIPT>'));
    const cli = node('check-diagram.mjs', [join(tmp, 'bad.html')]);
    check('diagram: the CLI runs by file name and exits 1 on a FAIL', cli.status === 1 && cli.stdout.includes('FAIL'), cli.stdout);
    rmSync(tmp, { recursive: true, force: true });
  }

  // check-stack-notes: Ruby, Rust, .NET and composer manifests; a framework named like a folder stays a framework
  {
    const repo = mkdtempSync(join(tmpdir(), 'muffy-review-stack-'));
    const put = (file, text) => { mkdirSync(dirname(join(repo, file)), { recursive: true }); writeFileSync(join(repo, file), text); };
    put('Gemfile', "gem 'rails', '~> 7.1.3'\n");
    put('Cargo.toml', '[dependencies]\ntokio = { version = "1.37", features = ["full"] }\n');
    put('App.csproj', '<Project><ItemGroup><PackageReference Include="Serilog" Version="3.1.0" /></ItemGroup></Project>\n');
    put('composer.json', '{"require":{"laravel/framework":"^11.0"}}\n');
    put('package.json', '{"dependencies":{"prisma":"^5.0.0"}}\n');
    put('prisma/schema.prisma', 'x\n');
    for (const [n, v] of [['rails', '6.0'], ['tokio', '1.30'], ['Serilog', '2.0'], ['laravel', '11.0'], ['prisma', '4.0']]) put(`docs/stacks/${n}.md`, `Source: https://example.org, version ${v}, 2026-01-01\n`);
    const out = node('check-stack-notes.mjs', [repo]).stdout;
    check('stack-notes: versions are read from Gemfile, Cargo tables, .csproj and composer vendor names', /rails: stale/.test(out) && /tokio: fresh/.test(out) && /Serilog: stale/.test(out) && /laravel: fresh/.test(out), out);
    const named = node('check-stack-notes.mjs', ['prisma'], { cwd: repo });
    check('stack-notes: "prisma" with a prisma/ folder in the repo is the framework, not the repo root', named.status === 1 && /prisma: stale/.test(named.stdout), named.stdout);
    rmSync(repo, { recursive: true, force: true });
  }

  // devops-preflight: versions compared by leading parts, prototype names rejected
  {
    const [maj, min] = process.versions.node.split('.');
    const pre = (...a) => node('devops-preflight.mjs', a).status;
    check('preflight: --toolchain node=<major> and node=<major.minor> pass; a number that only appears inside the version fails', pre('--toolchain', `node=${maj}`) === 0 && pre('--toolchain', `node=${maj}.${min}`) === 0 && (min === maj || pre('--toolchain', `node=${min}`) === 1));
    check('preflight: --toolchain toString or constructor is a usage error, not a crash', pre('--toolchain', 'toString') === 2 && pre('--toolchain', 'constructor') === 2);
  }

  // check-artifacts: a hook checks only the written artifact; the infra line must be in the checkpoint
  {
    const tmp = mkdtempSync(join(tmpdir(), 'muffy-review-artifacts-'));
    const d = join(tmp, '.team', 'login-flow'); cpSync(fixtureDir, d, { recursive: true });
    writeFileSync(join(d, 'deploy.md'), '# Deploy\n\nhalf written\n');
    check('check-artifacts: the contract scope ignores a half-written deploy.md, the deploy scope reports it', checkTask(d, 'contract').length === 0 && checkTask(d, 'deploy').some((e) => e.includes('deploy.md')), checkTask(d, 'contract').join('; '));
    const viaHook = (file) => spawnSync(process.execPath, [S('check-artifacts.mjs'), '--hook'], { input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: join(d, file) } }), encoding: 'utf8' }).status;
    check('check-artifacts --hook: writing contract.md passes while deploy.md is half written; writing deploy.md fails', viaHook('contract.md') === 0 && viaHook('deploy.md') === 2);
    cpSync(join(fixtureDir, 'deploy.md'), join(d, 'deploy.md'));
    writeFileSync(join(d, 'checkpoint.md'), readFileSync(join(d, 'checkpoint.md'), 'utf8').replace(/infra: [a-z-]+ ?·? ?/, ''));
    check('check-artifacts: a checkpoint with no infra: line fails the deploy.md check instead of skipping it', checkTask(d).some((e) => e.includes('no infra: line')), checkTask(d).join('; '));
    rmSync(tmp, { recursive: true, force: true });
  }

  // schemas and docs: PM cost envelopes, the documented no-cost line, step 3 order, the infra copy at setup
  {
    const env = { goal: 'Record the cost of login-flow', task: 'login-flow', brain: 'B', mode: 'cost-record', read: ['.team/login-flow/contract.md'], write: ['docs/strategy.md'], dont_touch: [] };
    check('envelope: product-manager cost-record and cost-reconcile modes are valid', validate(envSchema, env).length === 0 && validate(envSchema, { ...env, mode: 'cost-reconcile' }).length === 0 && validate(envSchema, { ...env, mode: 'cost-whatever' }).length > 0);
    const arch = readFileSync(rel('agents/references/architect/workflow.md'), 'utf8');
    const d = mkdtempSync(join(tmpdir(), 'muffy-review-cost-')); cpSync(fixtureDir, d, { recursive: true });
    const noCost = arch.match(/one line, `([^`]+)`/)?.[1] ?? '';
    writeFileSync(join(d, 'contract.md'), readFileSync(join(d, 'contract.md'), 'utf8').replace(/^Budget: none\. No new recurring cost$/m, noCost));
    check('docs: the architect\'s documented no-cost line passes check-artifacts', noCost.startsWith('Budget: none') && checkTask(d).length === 0, `${noCost} → ${checkTask(d).join('; ')}`);
    rmSync(d, { recursive: true, force: true });
    const row3 = readFileSync(rel('skills/muffy/references/steps.md'), 'utf8').split('\n').find((l) => l.startsWith('| 3 |')) ?? '';
    check('docs: step 3 aligns the contract with deploy.md before the Budget verdict is read, and records the chosen infra', row3.indexOf('aligns the contract') > -1 && row3.indexOf('aligns the contract') < row3.indexOf('`pause:budget`') && row3.includes('infra: existing: <chosen>'));
    check('docs: setup copies a recorded infra: answer into every task checkpoint', readFileSync(rel('skills/muffy/references/setup.md'), 'utf8').includes('still copy that `infra:` line'));
    check('docs: the designer defaults a missing Platform to web instead of asking every time', readFileSync(rel('agents/references/designer/workflow.md'), 'utf8').includes('none named → `web`'));
  }
}

/* 8. fix lane (references/fix-profile.md): triage examples, fix.md fixture, diagnosis hand-offs */
runFixLaneEvals({ check, root });
runOwnershipEvals({ check, root });
runLiteLaneEvals({ check, root });

/* 8b. routing (references/route.md): decision order, Examples table, intake rows */
runRouteEvals({ check, root });

/* 9. analyze mode (references/analyze.md): pending-work scan, privacy filters */
runPendingEvals({ check, root });

console.log(`eval: ${pass} passed, ${failures.length} failed`);
if (failures.length) { console.error(failures.map((x) => `  FAIL ${x}`).join('\n')); process.exit(1); }
