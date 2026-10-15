#!/usr/bin/env node
// Offline eval suite. No LLM calls: it checks that the specs (output-format / quality-checks /
// schemas) are enforceable, that golden fixtures satisfy them, and that the Orchestrator loop
// rules behave as documented on mock multi-agent scenarios.
//   node scripts/eval.mjs                 run everything
//   node scripts/eval.mjs --update-rubric re-sync evals/agents/*.eval.json `rubric` from quality-checks.md
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../skills/muffy/scripts/schema.mjs';
import { simulate } from './lib/loop-sim.mjs';
import { chooseEffort, defaultEffort, PROTECTED_ROLES, STALLED_AFTER } from './lib/effort-sim.mjs';
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
    .flatMap((l) => [...l.matchAll(/`([^`]*<task>[^`]*)`/g)].map((m) => m[1].replaceAll('<task>', TASK)));
  const absent = needed.filter((p) => !env.read.includes(p));
  check(`envelope:${role} reads every required input`, absent.length === 0, `missing ${absent.join(', ')}`);
  check(`envelope:${role} does not paste file contents`, JSON.stringify(env).length < 1200);
}

/* 2b. checkpoint format (references/memory-model.md#checkpoint) */
const cp = read('checkpoint.md');
for (const h of ['Goal', 'Run profile', 'Status', 'Decisions in force', 'Loop counters', 'Open blockers', 'History']) {
  check(`checkpoint has ## ${h}`, new RegExp(`^## ${h}\\s*$`, 'm').test(cp));
}
check('checkpoint is <= 40 lines', cp.trimEnd().split(/\r?\n/).length <= 40);
check('checkpoint loop counters are within the limit', !/\b[4-9]\/3\b/.test(cp));

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

console.log(`eval: ${pass} passed, ${failures.length} failed`);
if (failures.length) { console.error(failures.map((x) => `  FAIL ${x}`).join('\n')); process.exit(1); }
