// Offline checks for the fix lane (skills/muffy/references/fix-profile.md):
//   - triage examples: the doc table, evals/triage-scenarios.json and triage-sim.mjs agree
//   - golden fix.md and its 4a / 4 hand-offs satisfy the lane's invariants
//   - the diagnosis block in the hand-off schema rejects what it should
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from '../../skills/muffy/scripts/schema.mjs';
import { checkTask } from '../../skills/muffy/scripts/check-artifacts.mjs';
import { FIX_MAX_FILES } from './loop-sim.mjs';
import { triage } from './triage-sim.mjs';

const unquote = (req) => req.replace(/^"|"$/g, '').replace(/"\s*\/\s*"/g, ' / ');

export function runFixLaneEvals({ check, root }) {
  const rel = (...p) => join(root, ...p);
  const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
  const handoffSchema = readJson(rel('skills/muffy/schemas/handoff.schema.json'));
  const doc = readFileSync(rel('skills/muffy/references/fix-profile.md'), 'utf8');

  /* triage */
  const scenarios = readJson(rel('evals/triage-scenarios.json'));
  for (const sc of scenarios) {
    const out = triage(sc.signals);
    check(`triage:${sc.id}`, out.lane === sc.expect, `expected ${sc.expect}, got ${out.lane} (${out.reasons})`);
  }
  check('triage: every lane (fix, full, ask, none) has a scenario', ['fix', 'full', 'ask', 'none'].every((l) => scenarios.some((x) => x.expect === l)));

  const rows = (doc.split(/^### Examples\s*$/m)[1] ?? '')
    .split(/^## /m)[0]
    .split(/\r?\n/)
    .filter((l) => /^\| /.test(l) && !/^\|[-| ]+\|$/.test(l) && !/^\| Request /.test(l))
    .map((l) => l.split('|').slice(1, 3).map((c) => c.trim()));
  check('triage-doc: Examples table found in fix-profile.md', rows.length >= 8, `rows=${rows.length}`);
  for (const [req, lane] of rows) {
    const sc = scenarios.find((x) => x.request === unquote(req));
    check(`triage-doc: "${req.slice(0, 50)}" has a scenario`, !!sc, 'add it to evals/triage-scenarios.json');
    if (sc) check(`triage-doc: lane of "${req.slice(0, 40)}" matches`, sc.doc_lane === lane, `doc "${lane}" vs scenario "${sc.doc_lane}"`);
  }
  check(
    'triage-doc: every scenario with a doc_lane is in the table',
    scenarios.filter((x) => x.doc_lane).every((x) => rows.some(([r]) => unquote(r) === x.request)),
  );
  check(`triage-doc: the ${FIX_MAX_FILES}-file limit is stated for triage and for promotion`, (doc.match(new RegExp(`${FIX_MAX_FILES} source files`, 'g')) ?? []).length >= 2);

  /* golden fix.md + hand-offs */
  const dir = rel('evals/fixtures/fix-login-redirect/.team/fix-login-redirect');
  const fix = readFileSync(join(dir, 'fix.md'), 'utf8');
  const section = (text, h) => (text.split(new RegExp(`^## ${h}\\s*$`, 'm'))[1] ?? '').split(/^## /m)[0].trim();
  for (const h of ['Goal', 'Symptom', 'Cause', 'Repro', 'AC', 'Out of scope']) check(`fix.md has non-empty ## ${h}`, section(fix, h).length > 0);
  check('fix.md: first lines give Kind and Owner', /^Kind: (bug|cosmetic)\s+Owner: (FE|BE|both)/m.test(fix));
  const problems = checkTask(dir);
  check('fix.md passes check-artifacts (<= 60 lines, links)', problems.length === 0, problems.join('; '));
  const blankCause = fix.replace(/(## Cause\r?\n)[\s\S]*?(?=\r?\n## )/, '$1');
  check('fix.md negative: a blank ## Cause is detected', section(blankCause, 'Cause').length === 0);

  const h4a = readJson(join(dir, 'handoff/4a-backend-dev-r1.json'));
  const h4 = readJson(join(dir, 'handoff/4-backend-dev-r1.json'));
  const acIds = new Set(fix.match(/AC-\d+/g));
  const isTest = (p) => /(^|[\\/])(tests?|__tests__)[\\/]|\.(test|spec)\.[a-z]+$/i.test(p);
  check('fix lane: 4a and 4 hand-offs validate', validate(handoffSchema, h4a).length === 0 && validate(handoffSchema, h4).length === 0);
  check('fix lane: step 4 ac_ids_done are AC ids from fix.md', h4.ac_ids_done.length > 0 && h4.ac_ids_done.every((a) => acIds.has(a)));
  check('fix lane: step 4 edits only diagnosed files plus tests', h4.paths_written.every((p) => isTest(p) || h4a.diagnosis.files.includes(p)), h4.paths_written.join(','));
  check('fix lane: step 4 adds or changes a regression test', h4.paths_written.some(isTest));
  check('fix lane: the diagnosed Repro appears in fix.md', fix.includes(h4a.diagnosis.repro.split(' ')[0]));

  /* diagnosis schema: negative controls */
  const rejects = (name, mutate) => {
    const h = structuredClone(h4a);
    mutate(h);
    check(`diagnosis negative: ${name}`, validate(handoffSchema, h).length > 0);
  };
  rejects('step 4a without diagnosis is rejected', (h) => { delete h.diagnosis; });
  rejects('known with low confidence is rejected', (h) => { h.diagnosis.confidence = 'low'; });
  rejects('known without repro is rejected', (h) => { delete h.diagnosis.repro; });
  rejects('known without files is rejected', (h) => { h.diagnosis.files = []; });
  rejects('unknown without reason is rejected', (h) => { h.diagnosis = { status: 'unknown', confidence: 'low' }; });
  rejects('needs-full-flow without reason is rejected', (h) => { h.diagnosis = { status: 'needs-full-flow', confidence: 'high' }; });
  rejects('diagnosis on a step other than 4a is rejected', (h) => { h.step = '4'; });
  rejects('diagnosis from a non-dev role is rejected', (h) => { h.role = 'code-reviewer'; h.verdict = 'Approve'; });
  const unknown = structuredClone(h4a);
  unknown.diagnosis = { status: 'unknown', confidence: 'low', reason: 'cannot reproduce without the prod log' };
  check('diagnosis: unknown with a reason is accepted', validate(handoffSchema, unknown).length === 0);
}
