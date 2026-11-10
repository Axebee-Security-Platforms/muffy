// Offline checks for the fix lane (skills/muffy/references/fix-profile.md):
//   - triage examples: the doc table, evals/triage-scenarios.json and triage() in skills/muffy/scripts/next-action.mjs agree
//   - golden fix.md and its 4a / 4 hand-offs satisfy the lane's invariants
//   - the diagnosis block (debugger) and the audit block (auditor) in the hand-off schema reject what they should
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from '../../skills/muffy/scripts/schema.mjs';
import { checkTask } from '../../skills/muffy/scripts/check-artifacts.mjs';
import { FIX_MAX_FILES, EVIDENCE_LEVELS, SEVERITIES } from '../../skills/muffy/scripts/next-action.mjs';
import { triage } from '../../skills/muffy/scripts/next-action.mjs';

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

  const h4a = readJson(join(dir, 'handoff/4a-debugger-r1.json'));
  const h4b = readJson(join(dir, 'handoff/4b-auditor-r1.json'));
  const h4 = readJson(join(dir, 'handoff/4-backend-dev-r1.json'));
  const acIds = new Set(fix.match(/AC-\d+/g));
  const isTest = (p) => /(^|[\\/])(tests?|__tests__)[\\/]|\.(test|spec)\.[a-z]+$/i.test(p);
  check('fix lane: 4a, 4b and 4 hand-offs validate', [h4a, h4b, h4].every((h) => validate(handoffSchema, h).length === 0));
  check('fix lane: 4a is the debugger, 4b the auditor, 4 a dev', h4a.role === 'debugger' && h4b.role === 'auditor' && ['frontend-dev', 'backend-dev'].includes(h4.role));
  check('fix lane: the audit confirms with evidence at or above the severity', h4b.audit.verdict === 'confirm' && EVIDENCE_LEVELS.indexOf(h4b.audit.evidence_level) >= EVIDENCE_LEVELS.indexOf(h4a.diagnosis.severity));
  check('fix lane: the owner the debugger names is the dev who fixes', (h4a.diagnosis.owner === 'BE') === (h4.role === 'backend-dev'));
  check('fix lane: fix.md ## Cause carries the severity the debugger handed off', new RegExp('Severity: ' + h4a.diagnosis.severity).test(section(fix, 'Cause')));
  check('fix lane: fix.md has an ## Evidence section', section(fix, 'Evidence').length > 0);
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
  rejects('diagnosis from a non-debugger role is rejected', (h) => { h.role = 'code-reviewer'; h.verdict = 'Approve'; });
  rejects('diagnosis from a dev role is rejected (devs no longer diagnose)', (h) => { h.role = 'backend-dev'; h.ac_ids_done = []; });
  rejects('known without severity is rejected', (h) => { delete h.diagnosis.severity; });
  rejects('known without owner is rejected', (h) => { delete h.diagnosis.owner; });
  rejects('severity outside low/medium/high/critical is rejected', (h) => { h.diagnosis.severity = 'urgent'; });
  const unknown = structuredClone(h4a);
  unknown.diagnosis = { status: 'unknown', confidence: 'low', reason: 'cannot reproduce without the prod log' };
  check('diagnosis: unknown with a reason is accepted', validate(handoffSchema, unknown).length === 0);

  /* audit schema: negative controls */
  const auditRejects = (name, mutate) => {
    const h = structuredClone(h4b);
    mutate(h);
    check(`audit negative: ${name}`, validate(handoffSchema, h).length > 0);
  };
  auditRejects('step 4b without audit is rejected', (h) => { delete h.audit; });
  auditRejects('audit from a dev role is rejected', (h) => { h.role = 'backend-dev'; h.ac_ids_done = []; });
  auditRejects('audit on a step other than 4b is rejected', (h) => { h.step = '6'; });
  auditRejects('confirm with a green repro rerun is rejected', (h) => { h.audit.repro_rerun = 'green'; });
  auditRejects('confirm with evidence level none is rejected', (h) => { h.audit.evidence_level = 'none'; });
  auditRejects('need-validation without missing is rejected', (h) => { h.audit = { verdict: 'need-validation', evidence_level: 'low', repro_rerun: 'red' }; });
  auditRejects('need-validation with an empty missing list is rejected', (h) => { h.audit = { verdict: 'need-validation', evidence_level: 'low', repro_rerun: 'red', missing: [] }; });
  auditRejects('reject without a reason is rejected', (h) => { h.audit = { verdict: 'reject', evidence_level: 'none', repro_rerun: 'green' }; });
  auditRejects('an unknown verdict is rejected', (h) => { h.audit.verdict = 'block'; });
  const accepts = (name, audit) => {
    const h = structuredClone(h4b);
    h.audit = audit;
    check(`audit: ${name}`, validate(handoffSchema, h).length === 0);
  };
  accepts('need-validation with missing evidence is accepted', { verdict: 'need-validation', evidence_level: 'low', repro_rerun: 'red', missing: ['a second input'] });
  accepts('need-validation with a flaky rerun is accepted', { verdict: 'need-validation', evidence_level: 'low', repro_rerun: 'flaky', missing: ['loop the trigger'] });
  accepts('reject with a reason is accepted', { verdict: 'reject', evidence_level: 'none', repro_rerun: 'green', reason: 'the repro does not fail' });

  /* the severity table is kept in three places: fix-profile.md, debugger and auditor rules-and-guardrails.md */
  check('doc: every severity tier is named in fix-profile.md', SEVERITIES.every((s) => doc.includes(`\`${s}\``)));
  const tierRows = (name) => (readFileSync(rel('agent-references', name, 'rules-and-guardrails.md'), 'utf8').match(/^\| `(?:low|medium|high|critical)` \|.*$/gm) ?? []).map((r) => r.split('|').map((c) => c.trim()));
  const dbg = tierRows('debugger');
  const aud = tierRows('auditor');
  check('drift: debugger and auditor list the four severity tiers in order', dbg.map((r) => r[1]).join() === SEVERITIES.map((s) => `\`${s}\``).join() && aud.map((r) => r[1]).join() === dbg.map((r) => r[1]).join());
  check('drift: debugger and auditor state the same minimum evidence per tier', dbg.map((r) => r.at(-2)).join('|') === aud.map((r) => r.at(-2)).join('|'), 'the two rules-and-guardrails.md tables differ');
}
