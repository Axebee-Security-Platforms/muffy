// Offline checks for the headless gate mode (skills/muffy/references/headless.md):
//   - gatePolicy: interactive without MUFFY_HEADLESS, no self-answer without a policy, rule H2 with self-heal,
//     the Human gate never passes on its own
//   - checkpoint.mjs ask: gate.json written in the AskUserQuestion shape, one pause line (replaced, not appended),
//     an H2 pass recorded in ## Status, `muffy-status: waiting:<gate>` printed by the CLI
//   - checkpoint.mjs answer: consumes the answer once, clears the pause, removes gate.json, records gates 2b/3c and
//     the audit risk so guard-gates and auditMissing let the run go on
//   - the docs name the mode where the Orchestrator looks
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gatePolicy, validateGate, findAnswer, parseAnswer, gateAnswer, AUTO_REDIAGNOSE } from '../../skills/muffy/scripts/headless.mjs';
import { askGate, consumeAnswer, setPause, PAUSES } from '../../skills/muffy/scripts/checkpoint.mjs';
import { gateState, auditMissing } from '../../skills/muffy/scripts/gate-rules.mjs';

const CP = (status, profile = 'lane: fix (bug) · skipped 1, 2, 2b, 3, 3b, 3c, 3d') =>
  `# Checkpoint: t\n\nUpdated: step 4a\n\n## Goal\n\nx\n\n## Run profile\n\n${profile}\n\n## Status\n\n${status}\n`;
const QUESTIONS = {
  questions: [{
    question: 'Fix the 500 on /cart when the SKU is unknown?',
    header: 'Scope',
    multiSelect: false,
    options: [{ label: 'Go', description: 'Fix lane, AC as listed' }, { label: 'Change it', description: 'Edit the AC first' }],
  }],
};
const HEADLESS = { MUFFY_HEADLESS: '1' };
const SELF_HEAL = { MUFFY_HEADLESS: '1', MUFFY_HEADLESS_POLICY: 'self-heal', MUFFY_TRIGGERED_BY: 'oncall-dev' };
const SCOPE_OK = { triagePassed: true, acFromRequest: true };

export function runHeadlessEvals({ check, root }) {
  const rel = (...p) => join(root, ...p);

  /* policy */
  check('headless: without MUFFY_HEADLESS every gate is interactive (behaviour unchanged)', ['scope', 'audit', 'human-gate', 'plan-review'].every((g) => gatePolicy(g, {}, SCOPE_OK).action === 'interactive') && gatePolicy('scope', { MUFFY_HEADLESS: '0', MUFFY_HEADLESS_POLICY: 'self-heal' }, SCOPE_OK).action === 'interactive');
  check('headless: without a policy no gate answers itself, need-validation included', PAUSES.every((g) => gatePolicy(g, HEADLESS, { ...SCOPE_OK, verdict: 'need-validation' }).action === 'ask'));
  check('headless: an unknown policy answers nothing either', gatePolicy('scope', { ...HEADLESS, MUFFY_HEADLESS_POLICY: 'yolo', MUFFY_TRIGGERED_BY: 'x' }, SCOPE_OK).action === 'ask');
  const scope = gatePolicy('scope', SELF_HEAL, SCOPE_OK);
  check('H2: pause:scope passes when triage passed and the AC come from the request, credited to MUFFY_TRIGGERED_BY', scope.action === 'auto' && scope.line === 'auto: approved by Investigate (@oncall-dev) · rule H2', JSON.stringify(scope));
  check('H2: pause:scope waits on a scope change or promotion', gatePolicy('scope', SELF_HEAL, { ...SCOPE_OK, scopeChange: true }).action === 'ask');
  check('H2: pause:scope waits when triage failed or the AC were invented', gatePolicy('scope', SELF_HEAL, { acFromRequest: true }).action === 'ask' && gatePolicy('scope', SELF_HEAL, { triagePassed: true }).action === 'ask');
  check('H2: pause:scope waits with no MUFFY_TRIGGERED_BY to credit', gatePolicy('scope', { ...SELF_HEAL, MUFFY_TRIGGERED_BY: '' }, SCOPE_OK).action === 'ask');
  check('H2: the first audit need-validation re-diagnoses on its own', gatePolicy('audit', SELF_HEAL, { verdict: 'need-validation', status: [] }).line === AUTO_REDIAGNOSE);
  check('H2: a second non-confirm stops', gatePolicy('audit', SELF_HEAL, { verdict: 'need-validation', status: [`- ${AUTO_REDIAGNOSE} · 2026-11-21T00:00:00.000Z`] }).action === 'ask');
  check('H2: audit reject always stops', gatePolicy('audit', SELF_HEAL, { verdict: 'reject', status: [] }).action === 'ask');
  check('H2: the Human gate never passes on its own', gatePolicy('human-gate', SELF_HEAL, SCOPE_OK).action === 'ask' && gatePolicy('plan-review', SELF_HEAL, SCOPE_OK).action === 'ask' && gatePolicy('design-review', SELF_HEAL, SCOPE_OK).action === 'ask');

  /* gate.json schema */
  const good = { gate: 'scope', task: 'fix-cart', created_at: '2026-11-21T03:04:05.000Z', ...QUESTIONS };
  check('gate.json: the AskUserQuestion shape plus gate, task and created_at validates', validateGate(good).length === 0, validateGate(good).join('; '));
  check('gate.json: a header over 12 characters, one option or five questions is refused',
    validateGate({ ...good, questions: [{ ...QUESTIONS.questions[0], header: 'Way too long header' }] }).length > 0
    && validateGate({ ...good, questions: [{ ...QUESTIONS.questions[0], options: [QUESTIONS.questions[0].options[0]] }] }).length > 0
    && validateGate({ ...good, questions: Array(5).fill(QUESTIONS.questions[0]) }).length > 0);
  check('gate.json: multiSelect must be a boolean and the pause id is required', validateGate({ ...good, questions: [{ ...QUESTIONS.questions[0], multiSelect: 'no' }] }).length > 0 && validateGate({ ...good, gate: undefined }).length > 0);

  /* answer lines */
  check('answer: the documented line parses', JSON.stringify(parseAnswer('- human-gate answered: Approve by @lead (Slack #prod-fix, via Terminus) 2026-11-21T04:00:00Z')) === JSON.stringify({ gate: 'human-gate', answer: 'Approve', by: '@lead', source: 'Slack #prod-fix, via Terminus', at: '2026-11-21T04:00:00Z' }));
  check('answer: the spike form (no time, pause: prefix allowed) parses', parseAnswer('pause:human-gate answered: APPROVE by @spike-tester (Slack ..., via Terminus)')?.answer === 'APPROVE');
  check('answer: one above the last consumed marker for its gate is ignored', findAnswer(['- scope answered: Go by @a (Slack) 2026-11-20T00:00:00Z', '- scope answer consumed · 2026-11-20T01:00:00Z'], 'scope') === null && findAnswer(['- scope answer consumed · x', '- scope answered: Go by @b (Slack)'], 'scope')?.by === '@b');
  check('answer: Thai and English labels map; "not now" is not a reject', gateAnswer('อนุมัติ') === 'approve' && gateAnswer('ไม่ผ่าน') === 'reject' && gateAnswer('Approve') === 'approve' && gateAnswer('Request changes') === 'reject' && gateAnswer('not now') === null);

  /* checkpoint.mjs ask / answer on a temp task */
  const tmp = mkdtempSync(join(tmpdir(), 'muffy-headless-'));
  try {
    const dir = join(tmp, '.team', 'fix-cart');
    mkdirSync(dir, { recursive: true });
    const cpPath = join(dir, 'checkpoint.md');
    const gateFile = join(dir, 'gate.json');
    const write = (t) => writeFileSync(cpPath, t);
    const read = () => readFileSync(cpPath, 'utf8');
    const draft = () => writeFileSync(gateFile, JSON.stringify(QUESTIONS));
    const pausedLines = () => (read().match(/paused at pause:/g) ?? []).length;
    const now = new Date('2026-11-21T05:00:00.000Z');

    write(CP('- stage: setup'));
    draft();
    check('ask: not headless writes nothing (AskUserQuestion as before)', askGate(dir, 'scope', { env: {}, facts: SCOPE_OK }).action === 'interactive' && !read().includes('paused at') && JSON.parse(readFileSync(gateFile, 'utf8')).gate === undefined);

    write(CP('- stage: setup\n- paused at pause:scope · resume when the user confirms scope'));
    const asked = askGate(dir, 'scope', { env: HEADLESS, facts: SCOPE_OK, now });
    const written = JSON.parse(readFileSync(gateFile, 'utf8'));
    check('ask: headless without a policy writes gate.json instead of answering itself', asked.action === 'ask' && !read().includes('rule H2') && written.gate === 'scope' && written.task === 'fix-cart' && written.created_at === now.toISOString());
    check('ask: gate.json is schema-valid', validateGate(written).length === 0, validateGate(written).join('; '));
    check('ask: the pause line is replaced, never a second one', pausedLines() === 1 && read().includes('paused at pause:scope · resume when a person answers gate.json'));
    setPause(dir, 'scope', 'a person answers gate.json');
    check('ask: saving the same pause again still leaves one line', pausedLines() === 1);

    let refused = '';
    rmSync(gateFile);
    try { askGate(dir, 'human-gate', { env: HEADLESS }); } catch (e) { refused = e.message; }
    check('ask: headless with no questions drafted is refused, not answered', /Write the AskUserQuestion input/.test(refused), refused);
    refused = '';
    try { askGate(dir, 'made-up', { env: HEADLESS }); } catch (e) { refused = e.message; }
    check('ask: an unnamed pause is refused', /not a named pause/.test(refused), refused);

    write(CP('- stage: setup\n- paused at pause:scope · resume when the user confirms scope'));
    draft();
    const auto = askGate(dir, 'scope', { env: SELF_HEAL, facts: SCOPE_OK, now });
    check('ask: H2 passes pause:scope with the policy, records the rule, clears the pause, leaves no gate.json', auto.action === 'auto' && read().includes('auto: approved by Investigate (@oncall-dev) · rule H2') && pausedLines() === 0 && !existsSync(gateFile));

    write(CP('- stage: audit'));
    const first = askGate(dir, 'audit', { env: SELF_HEAL, facts: { verdict: 'need-validation' }, now });
    draft();
    const second = askGate(dir, 'audit', { env: SELF_HEAL, facts: { verdict: 'need-validation' }, now });
    check('ask: H2 re-diagnoses once, the second need-validation writes gate.json', first.action === 'auto' && read().includes(AUTO_REDIAGNOSE) && second.action === 'ask' && existsSync(gateFile) && read().includes('paused at pause:audit'));

    write(CP('- stage: qa passed'));
    draft();
    const hg = askGate(dir, 'human-gate', { env: SELF_HEAL, facts: SCOPE_OK, now });
    check('ask: the Human gate waits even with the self-heal policy', hg.action === 'ask' && read().includes('paused at pause:human-gate') && !read().includes('rule H2'));

    /* resume */
    check('answer: no answer yet keeps waiting (nothing consumed, gate.json stays)', consumeAnswer(dir).state === 'waiting' && existsSync(gateFile) && pausedLines() === 1);
    write(read().replace('## Status\n\n', '## Status\n\n- human-gate answered: Approve by @old (Slack) 2026-11-20T00:00:00Z\n- human-gate answer consumed · 2026-11-20T01:00:00Z\n'));
    check('answer: an answer consumed at an earlier pause is not consumed again', consumeAnswer(dir).state === 'waiting');
    write(`${read().trimEnd()}\n- human-gate answered: Approve by @lead (Slack #prod-fix, via Terminus) 2026-11-21T06:00:00Z\n`);
    const done = consumeAnswer(dir);
    check('answer: consumes the answer, clears the pause line, removes gate.json', done.state === 'answered' && done.answer === 'Approve' && done.by === '@lead' && pausedLines() === 0 && !existsSync(gateFile));
    check('answer: the person line stays untouched, a consumed marker follows, not consumed twice', read().includes('- human-gate answered: Approve by @lead (Slack #prod-fix, via Terminus) 2026-11-21T06:00:00Z') && /human-gate answer consumed · /.test(read()) && consumeAnswer(dir).state === 'none');
    check('answer: with no gate.json resume does nothing headless', consumeAnswer(dir).state === 'none');

    write(CP('- stage: audit'));
    draft();
    askGate(dir, 'audit', { env: HEADLESS, facts: { verdict: 'reject' }, now });
    write(`${read().trimEnd()}\n- audit answered: Accept the risk by @lead (Slack) 2026-11-21T06:00:00Z\n`);
    const risk = consumeAnswer(dir);
    const step4 = 'Task: fix-cart\nWrite: .worktrees/feature-fix-cart/.team/fix-cart/handoff/4-backend-dev-r1.json\n';
    check('answer: an audit accept-risk records the risk so step 4 may start', risk.event === 'accept-risk' && auditMissing(read(), 'backend-dev', step4, [{ step: '4b', round: 1, audit: { verdict: 'reject' } }]) === null && pausedLines() === 0);

    const feature = 'lane: feature · skipped none';
    write(CP('- stage: plan', feature));
    writeFileSync(join(dir, 'ac.md'), '# AC\n');
    draft();
    askGate(dir, 'plan-review', { env: HEADLESS, now });
    write(`${read().trimEnd()}\n- plan-review answered: Reject by @pm (Slack) 2026-11-21T06:00:00Z\n`);
    const rej = consumeAnswer(dir);
    check('answer: a plan-review Reject is recorded as gate 2b not passed, the pause stays', rej.event === 'reject' && gateState(read(), '2b') === 'open' && read().includes('gate 2b not passed') && read().includes('paused at pause:plan-review'));
    rmSync(join(dir, 'ac.md'));

    // the CLI prints the machine-readable line last
    write(CP('- stage: qa passed'));
    draft();
    const cli = spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'checkpoint.mjs'), 'ask', dir, 'human-gate'], { encoding: 'utf8', env: { ...process.env, ...SELF_HEAL } });
    check('cli ask: headless ends with muffy-status: waiting:<gate>', cli.status === 0 && cli.stdout.trim().split(/\r?\n/).at(-1) === 'muffy-status: waiting:human-gate', cli.stdout + cli.stderr);
    write(`${read().trimEnd()}
- human-gate answered: Approve by @lead (Slack) 2026-11-21T07:00:00Z
`);
    const ans = spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'checkpoint.mjs'), 'answer', dir], { encoding: 'utf8' });
    check('cli answer: consumes through the CLI and the checkpoint still checks', ans.status === 0 && ans.stdout.includes('next=continue') && !existsSync(gateFile), ans.stdout + ans.stderr);
    const env = { ...process.env };
    delete env.MUFFY_HEADLESS;
    const inter = spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'checkpoint.mjs'), 'ask', dir, 'scope', '--triage-passed', '--ac-from-request'], { encoding: 'utf8', env });
    check('cli ask: not headless prints next=ask-user', inter.status === 0 && inter.stdout.startsWith('next=ask-user'), inter.stdout + inter.stderr);

    /* several questions in one gate.json: one answer line, parts joined by " | " in question order */
    const q = (header, multiSelect = false) => ({ question: `${header}?`, header, multiSelect, options: [{ label: 'A', description: '' }, { label: 'B', description: '' }] });
    const multi = () => writeFileSync(gateFile, JSON.stringify({ questions: [q('Plan'), q('Roles', true), q('Target')] }));
    const cliAnswer = () => spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'checkpoint.mjs'), 'answer', dir], { encoding: 'utf8' });
    write(CP('- stage: setup'));
    multi();
    askGate(dir, 'scope', { env: HEADLESS, facts: SCOPE_OK, now });
    write(`${read().trimEnd()}\n- scope answered: Go | FE + devops | Confirm by @kanata (Slack, via Terminus) 2026-11-21T14:00+07:00\n`);
    const many = consumeAnswer(dir);
    check('multi: each part maps to its question by position', many.state === 'answered' && many.answers.map((x) => `${x.header}=${x.answer}`).join(';') === 'Plan=Go;Roles=FE + devops;Target=Confirm' && pausedLines() === 0 && !existsSync(gateFile), JSON.stringify(many.answers));

    write(CP('- stage: setup'));
    multi();
    askGate(dir, 'scope', { env: HEADLESS, facts: SCOPE_OK, now });
    write(`${read().trimEnd()}\n- scope answered: Go | FE, devops | Confirm by @kanata (Slack) 2026-11-21T14:00+07:00\n`);
    const ms = consumeAnswer(dir);
    check('multi: multiSelect labels stay joined with ", " inside one part', ms.answers[1].answer === 'FE, devops' && JSON.stringify(ms.answers[1].labels) === '["FE","devops"]' && ms.answers.length === 3);

    write(CP('- stage: setup'));
    multi();
    askGate(dir, 'scope', { env: HEADLESS, facts: SCOPE_OK, now });
    write(`${read().trimEnd()}\n- scope answered: Go | Confirm by @kanata (Slack) 2026-11-21T14:00+07:00\n`);
    const before = read();
    const short = cliAnswer();
    check('multi: a part count that does not match the questions exits 2, pause and gate.json stay', short.status === 2 && /2 part\(s\).*3 question\(s\)/.test(short.stderr) && existsSync(gateFile) && read() === before && pausedLines() === 1, short.stdout + short.stderr);
    write(`${read().trimEnd()}\n- scope answered: Go | FE | Confirm by @kanata (Slack) 2026-11-21T14:05+07:00\n`);
    const ok3 = cliAnswer();
    check('multi: the CLI prints one answer.<n> line per question', ok3.status === 0 && ok3.stdout.includes('answer.1=Plan: Go') && ok3.stdout.includes('answer.3=Target: Confirm'), ok3.stdout + ok3.stderr);

    write(CP('- stage: setup'));
    draft();
    askGate(dir, 'scope', { env: HEADLESS, facts: SCOPE_OK, now });
    write(`${read().trimEnd()}\n- scope answered: Go by @kanata (Slack) 2026-11-21T14:00+07:00\n`);
    const one = cliAnswer();
    check('multi: a single-question gate is unchanged (no pipe, answer=<label>)', one.status === 0 && one.stdout.includes('answer=Go') && !one.stdout.includes('answer.1='), one.stdout + one.stderr);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  /* docs */
  const R = (p) => readFileSync(rel(p), 'utf8');
  const runProfile = R('skills/muffy/references/run-profile.md');
  check('docs: every pause in checkpoint.mjs has a row in run-profile.md Named pauses', PAUSES.every((p) => runProfile.includes(`| \`pause:${p}\` |`)), PAUSES.filter((p) => !runProfile.includes(`| \`pause:${p}\` |`)).join(', '));
  check('docs: SKILL.md loads headless.md when MUFFY_HEADLESS=1', R('skills/muffy/SKILL.md').includes('references/headless.md') && R('skills/muffy/SKILL.md').includes('MUFFY_HEADLESS=1'));
  const doc = R('skills/muffy/references/headless.md');
  check('docs: headless.md names the commands, the status line and rule H2', ['checkpoint.mjs" ask', 'checkpoint.mjs" answer', 'muffy-status: waiting:<gate>', 'rule H2', 'MUFFY_HEADLESS_POLICY=self-heal', 'MUFFY_TRIGGERED_BY'].every((s) => doc.includes(s)));
  check('docs: resume.md consumes a headless answer before anything else', R('skills/muffy/references/resume.md').includes('checkpoint.mjs" answer'));
  check('docs: fix-profile.md routes the audit through checkpoint.mjs ask in headless', R('skills/muffy/references/fix-profile.md').includes('checkpoint.mjs" ask .team/<task> audit'));
}
