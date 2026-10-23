// Offline checks for the lite lane (skills/muffy/references/lite-profile.md):
//   - triage examples: the doc table, evals/lite-triage-scenarios.json and triageLite agree
//   - the lane never skips a step the whole team never skips, and states its file limit
//   - promote owners exist in the hand-off schema; the envelope accepts Profile: lite
//   - route, SKILL and the architect's workflow point at the lane
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from '../../skills/muffy/scripts/schema.mjs';
import { LITE_MAX_FILES, NEVER_SKIP } from '../../skills/muffy/scripts/next-action.mjs';
import { triageLite } from '../../skills/muffy/scripts/next-action.mjs';

const unquote = (req) => req.replace(/^"|"$/g, '');

export function runLiteLaneEvals({ check, root }) {
  const rel = (...p) => join(root, ...p);
  const read = (...p) => readFileSync(rel(...p), 'utf8');
  const readJson = (...p) => JSON.parse(read(...p));
  const doc = read('skills/muffy/references/lite-profile.md');

  /* triage */
  const scenarios = readJson('evals/lite-triage-scenarios.json');
  for (const sc of scenarios) {
    const out = triageLite(sc.signals);
    check(`lite-triage:${sc.id}`, out.lane === sc.expect, `expected ${sc.expect}, got ${out.lane} (${out.reasons})`);
  }
  check('lite-triage: every outcome (lite, full, ask) has a scenario', ['lite', 'full', 'ask'].every((l) => scenarios.some((x) => x.expect === l)));

  const rows = (doc.split(/^### Examples\s*$/m)[1] ?? '')
    .split(/^## /m)[0]
    .split(/\r?\n/)
    .filter((l) => /^\| /.test(l) && !/^\|[-| ]+\|$/.test(l) && !/^\| Request /.test(l))
    .map((l) => l.split('|').slice(1, 3).map((c) => c.trim()));
  check('lite-doc: Examples table found in lite-profile.md', rows.length >= 8, `rows=${rows.length}`);
  for (const [req, lane] of rows) {
    const sc = scenarios.find((x) => x.request === unquote(req));
    check(`lite-doc: "${req.slice(0, 50)}" has a scenario`, !!sc, 'add it to evals/lite-triage-scenarios.json');
    if (sc) check(`lite-doc: lane of "${req.slice(0, 40)}" matches`, sc.doc_lane === lane, `doc "${lane}" vs scenario "${sc.doc_lane}"`);
  }
  check('lite-doc: every scenario with a doc_lane is in the table', scenarios.filter((x) => x.doc_lane).every((x) => rows.some(([r]) => unquote(r) === x.request)));
  check(`lite-doc: the ${LITE_MAX_FILES}-file limit is stated for triage and for promotion`, (doc.match(new RegExp(`${LITE_MAX_FILES} source files`, 'g')) ?? []).length >= 2);

  /* steps */
  const skipped = (doc.match(/`lite: skipped ([^`]+)`/)?.[1] ?? '').split(/,\s*/);
  check('lite-doc: the run profile line names what the lane skips', skipped.length >= 4, skipped.join(','));
  check('lite-doc: the lane never skips review, QA, staging or the Human gate', NEVER_SKIP.every((s) => !skipped.includes(s)) && NEVER_SKIP.every((s) => new RegExp(`Never skipped:[^\\n]*\\b${s}\\b`).test(doc)));
  check('lite-doc: the architect step (3) is never skipped', !skipped.includes('3') && /Never skipped: 3,/.test(doc));

  /* promote signals use existing hand-off fields */
  const owners = readJson('skills/muffy/schemas/handoff.schema.json').properties.blockers.items.properties.owner.enum;
  const promoteOwners = [...(doc.split(/^## Promote to the full flow/m)[1] ?? '').matchAll(/`owner: (\w+)`/g)].map((m) => m[1]);
  check('lite-doc: every promote owner is a hand-off blocker owner', promoteOwners.length >= 4 && promoteOwners.every((o) => owners.includes(o)), promoteOwners.join(','));
  const arch = read('agents/references/architect/workflow.md');
  check('lite: the architect workflow names the promote owners and links the lane', /\*\*Lite profile\*\*/.test(arch) && ['Researcher', 'PM', 'Designer'].every((o) => arch.includes(`\`${o}\``)) && arch.includes('lite-profile.md#promote-to-the-full-flow'));

  /* envelope and wiring */
  const envSchema = readJson('skills/muffy/schemas/prompt-envelope.schema.json');
  const env = { goal: 'Write the contract for lite-orders-index', task: 'lite-orders-index', brain: 'B', read: ['.team/lite-orders-index/ac.md'], write: ['.team/lite-orders-index/contract.md'], dont_touch: [] };
  check('lite: the envelope accepts profile lite and fix, rejects another', validate(envSchema, { ...env, profile: 'lite' }).length === 0 && validate(envSchema, { ...env, profile: 'fix' }).length === 0 && validate(envSchema, { ...env, profile: 'medium' }).length > 0);
  check('lite: route.md has a lite route row and a lite intake row', /^\| Internal work[^\n]*\| lite \(\[lite-profile\.md\]/m.test(read('skills/muffy/references/route.md')) && /^\| lite \|/m.test(read('skills/muffy/references/route.md')));
  check('lite: SKILL.md names /muffy lite and links the lane', /`\/muffy lite`/.test(read('skills/muffy/SKILL.md')) && read('skills/muffy/SKILL.md').includes('references/lite-profile.md'));
  check('lite: test-levels.md gives the lane its levels', /Lite lane[^\n]*L2[^\n]*L3/.test(read('skills/muffy/references/test-levels.md')));
}
