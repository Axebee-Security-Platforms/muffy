// Offline checks for the human gates (skills/muffy/references/step-details.md 2b and 3c, hooks-enforcement.md §14):
//   - the rule set: which spawn needs which gate, what counts as answered, what a hand-off past an open gate is
//   - checkpoint.mjs gate: approval needs the pause saved, a skip of 3c is refused once design.md exists
//   - checkpoint.mjs unpause: refused for a gate's pause while the gate has no answer
//   - guard-gates.mjs: blocks the spawn before its gate, lets the rest through, fails closed without a Task header
//   - fix lane: a dev's step-4 spawn is blocked until the auditor's `confirm` or the user's accepted risk (auditMissing, guard-gates.mjs)
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gateState, gatesForSpawn, missingGates, gateErrors, auditMissing } from '../../skills/muffy/scripts/gate-rules.mjs';
import { recordGate, clearPause } from '../../skills/muffy/scripts/checkpoint.mjs';
import { gate10 } from '../../skills/muffy/scripts/gate-summary.mjs';
import { smallVerdict, docsText } from '../../skills/muffy/scripts/small-fix.mjs';
import { requestCost, orchestratorTokens } from '../../skills/muffy/scripts/task-usage.mjs';

const CP = (status, profile = 'lane: feature · skipped none') =>
  `# Checkpoint: t\n\nUpdated: step 3\n\n## Goal\n\nx\n\n## Run profile\n\n${profile}\n\n## Status\n\n${status}\n`;

export function runGateEvals({ check, root }) {
  const rel = (...p) => join(root, ...p);

  /* token rules: one paragraph, copied into every agent definition, so no agent spends a turn reading it */
  {
    const para = readFileSync(rel('agent-references', 'shared', 'token-rules.md'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('**Token rules (every agent):**'));
    const agents = readdirSync(rel('agents')).filter((n) => n.endsWith('.md'));
    const missing = agents.filter((n) => !readFileSync(rel('agents', n), 'utf8').includes(para ?? '\0'));
    check('token rules: the shared paragraph exists and every agent definition carries it word for word', !!para && agents.length >= 13 && missing.length === 0, `missing in: ${missing.join(', ')}`);
    check('token rules: the debugger caps `## Evidence` by severity without cutting the minimum evidence', /at most 8 lines for `low`, 15 for `medium`, 25 for `high`, 40 for `critical`/.test(readFileSync(rel('agent-references', 'debugger', 'rules-and-guardrails.md'), 'utf8')) && /never cuts a minimum/.test(readFileSync(rel('agent-references', 'debugger', 'rules-and-guardrails.md'), 'utf8')));
    check('token rules: token-discipline.md tells the Orchestrator to batch independent calls and names the dollar target', /Fewer turns \(the Orchestrator\)/.test(readFileSync(rel('skills', 'muffy', 'references', 'token-discipline.md'), 'utf8')) && /US\$1\.00/.test(readFileSync(rel('skills', 'muffy', 'references', 'token-discipline.md'), 'utf8')));
  }

  /* rule set */
  check('gates: product-manager and researcher need no gate', gatesForSpawn('product-manager').length === 0 && gatesForSpawn('researcher').length === 0);
  check('gates: designer needs 2b only', JSON.stringify(gatesForSpawn('designer')) === '["2b"]');
  check('gates: backend-dev needs 2b and 3c', JSON.stringify(gatesForSpawn('backend-dev')) === '["2b","3c"]');
  check('gates: devops mode 1 needs 2b only, mode 2 needs 3c too', JSON.stringify(gatesForSpawn('devops', 'Mode 1 plan')) === '["2b"]' && JSON.stringify(gatesForSpawn('devops', 'mode 2 smoke')) === '["2b","3c"]');
  check('gates: fix and lite lanes have no gates', gatesForSpawn('backend-dev', '', 'fix').length === 0 && gatesForSpawn('designer', '', 'lite').length === 0);

  const open = CP('- paused at pause:plan-review · resume when the user answers');
  check('gates: open when nothing is recorded', gateState(open, '2b') === 'open');
  check('gates: a later approval after a rejection passes', gateState(CP('- gate 2b not passed · user: "change it"\n- gate 2b passed · user: "approve"'), '2b') === 'passed');
  check('gates: a rejection after an approval reopens', gateState(CP('- gate 3c passed · user: "ok"\n- gate 3c not passed · user: "no"'), '3c') === 'open');
  check('gates: skipped counts as answered', gateState(CP('- gate 3c skipped · no UI'), '3c') === 'skipped');
  check('gates: "Gates 3c and 3d passed" (manual line) still passes 3c', gateState(CP('- Gates 3c and 3d passed'), '3c') === 'passed');

  check('gates: missing checkpoint leaves every gate open', JSON.stringify(missingGates(null, 'frontend-dev')) === '["2b","3c"]');
  check('gates: spawn with the gate recorded goes through', missingGates(CP('- gate 2b passed · user: "ok"\n- gate 3c passed · user: "ok"'), 'frontend-dev').length === 0);
  check('gates: spawn after 2b but before 3c is blocked for frontend-dev', JSON.stringify(missingGates(CP('- gate 2b passed · user: "ok"'), 'frontend-dev')) === '["3c"]');

  check('gates: hand-off at step 3 with 2b open is an error', gateErrors(open, ['2']).length === 0 && gateErrors(open, ['3']).length === 1);
  check('gates: hand-off at step 4 with 3c open is an error', gateErrors(CP('- gate 2b passed · user: "ok"'), ['3', '4']).length === 1);
  check('gates: skipped 3c with design.md present is an error', gateErrors(CP('- gate 2b passed · user: "ok"\n- gate 3c skipped · no UI'), ['4'], { designExists: true }).length === 1);
  check('gates: fix lane is never gated post-hoc', gateErrors(open, ['4'], { lane: 'fix' }).length === 0);

  /* fix lane: no step 4 before the audit confirms */
  const FIXCP = (status) => CP(status, 'lane: fix · skipped 1, 2, 2b, 3, 3b, 3c, 3d');
  const step4 = 'Task: t\nWrite: .worktrees/feature-t/.team/t/handoff/4-backend-dev-r1.json\n';
  const audit = (verdict, round = 1) => ({ step: '4b', round, audit: { verdict } });
  check('audit gate: a dev step-4 spawn with no audit is refused', auditMissing(FIXCP('- stage: fix'), 'backend-dev', step4, []) !== null);
  check('audit gate: a confirm lets step 4 start', auditMissing(FIXCP('- stage: fix'), 'backend-dev', step4, [audit('confirm')]) === null);
  check('audit gate: need-validation and reject do not', auditMissing(FIXCP('- stage: fix'), 'backend-dev', step4, [audit('need-validation')]) !== null && auditMissing(FIXCP('- stage: fix'), 'frontend-dev', step4.replace('backend', 'frontend'), [audit('reject')]) !== null);
  check('audit gate: the latest round decides', auditMissing(FIXCP('- stage: fix'), 'backend-dev', step4, [audit('confirm', 1), audit('reject', 2)]) !== null && auditMissing(FIXCP('- stage: fix'), 'backend-dev', step4, [audit('reject', 1), audit('confirm', 2)]) === null);
  check('audit gate: the accepted risk in ## Status lets step 4 start after a reject', auditMissing(FIXCP('- audit 4b: risk accepted · user: "go ahead"'), 'backend-dev', step4, [audit('reject')]) === null);
  check('audit gate: the debugger, the auditor and a step-6 spawn are not held', auditMissing(FIXCP('- stage: fix'), 'debugger', 'Write: handoff/4a-debugger-r1.json', []) === null && auditMissing(FIXCP('- stage: fix'), 'auditor', 'Write: handoff/4b-auditor-r1.json', []) === null && auditMissing(FIXCP('- stage: fix'), 'code-reviewer', 'Write: handoff/6-code-reviewer-r1.json', []) === null);
  check('audit gate: the feature lane is not held by it', auditMissing(CP('- gate 2b passed'), 'backend-dev', step4, []) === null);

  /* checkpoint.mjs gate */
  const tmp = mkdtempSync(join(tmpdir(), 'muffy-gates-'));
  try {
    const dir = join(tmp, '.team', 't');
    mkdirSync(dir, { recursive: true });
    const cpPath = join(dir, 'checkpoint.md');
    const write = (t) => writeFileSync(cpPath, t);
    const read = () => readFileSync(cpPath, 'utf8');

    write(CP('- stage: setup'));
    let refused = '';
    try { recordGate(dir, '2b', 'approve', { by: 'ok' }); } catch (e) { refused = e.message; }
    check('gate approve: refused without the pause saved', /save the pause first/.test(refused), refused);

    write(CP('- paused at pause:design-review · resume when the user answers'));
    refused = '';
    try { recordGate(dir, '3c', 'approve', { by: 'ok' }); } catch (e) { refused = e.message; }
    check('gate approve 3c: refused while the design summary is not ready (no design.md)', /not ready/.test(refused), refused);

    write(CP('- paused at pause:design-review · resume when the user answers'));
    recordGate(dir, '3c', 'reject', { by: 'move the filter' });
    check('gate reject: keeps the pause and records not passed', read().includes('paused at pause:design-review') && gateState(read(), '3c') === 'open');

    refused = '';
    write(CP('- stage: design'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'design.md'), '# Design\n');
    try { recordGate(dir, '3c', 'skip', { reason: 'no UI' }); } catch (e) { refused = e.message; }
    check('gate skip 3c: refused once design.md exists', /cannot be skipped/.test(refused), refused);

    rmSync(join(dir, 'design.md'));
    recordGate(dir, '3c', 'skip', { reason: 'backend only, no UI' });
    check('gate skip 3c: allowed with a reason when no designer ran', gateState(read(), '3c') === 'skipped');

    refused = '';
    try { recordGate(dir, '2b', 'skip', { reason: 'no plan' }); } catch (e) { refused = e.message; }
    check('gate skip 2b: refused in the feature lane', /cannot be skipped in the feature lane/.test(refused), refused);

    // checkpoint.mjs unpause: a gate's pause is cleared by recording the answer, not bare
    write(CP('- paused at pause:plan-review · resume when the user answers'));
    refused = '';
    try { clearPause(dir); } catch (e) { refused = e.message; }
    check('unpause: refused for plan-review while 2b has no answer', /no recorded answer/.test(refused) && read().includes('paused at pause:plan-review'), refused);

    write(CP('- gate 2b passed · user: "ok"\n- paused at pause:design-review · resume when the user answers'));
    refused = '';
    try { clearPause(dir); } catch (e) { refused = e.message; }
    check('unpause: refused for design-review while 3c has no answer', /gate 3c/.test(refused), refused);

    write(CP('- gate 2b not passed · user: "change it"\n- paused at pause:plan-review · resume when the revision is answered'));
    refused = '';
    try { clearPause(dir); } catch (e) { refused = e.message; }
    check('unpause: refused after a rejection, until the revision is answered', /no recorded answer/.test(refused), refused);

    write(CP('- paused at pause:full-regression · resume when the user approves'));
    clearPause(dir);
    check('unpause: other pauses clear as before', !read().includes('paused at'));

    write(CP('- paused at pause:plan-review · resume when the user answers', 'Fix lane.'));
    clearPause(dir);
    check('unpause: fix lane has no gates, so plan-review clears', !read().includes('paused at'));

    // guard-gates.mjs: stdin is the PreToolUse payload of an Agent call
    const guard = rel('skills', 'muffy', 'scripts', 'guard-gates.mjs');
    const spawn = (role, prompt, cwd = tmp) => spawnSync(process.execPath, [guard], {
      input: JSON.stringify({ tool_name: 'Agent', tool_input: { subagent_type: role, prompt }, cwd }),
      encoding: 'utf8',
    });
    write(CP('- stage: design'));
    const hdr = 'Task: t\nBrain: .team/brain\n';
    check('guard: frontend-dev blocked before any gate', spawn('frontend-dev', `${hdr}go`).status === 2);
    check('guard: product-manager never blocked', spawn('product-manager', `${hdr}go`).status === 0);
    check('guard: no Task header, gated muffy role, a run exists: blocked', spawn('frontend-dev', 'go').status === 2);
    check('guard: no Task header, the task is read from a .team path in the prompt', spawn('designer', 'Read: .team/t/ac.md').status === 2);
    check('guard: no Task header, the task is read from a feature worktree path', spawn('designer', 'Worktree: E:\\r\\.worktrees\\feature-t').status === 2);
    check('guard: no Task header, product-manager never blocked', spawn('product-manager', 'go').status === 0);
    check('guard: no Task header, a role outside muffy is not checked', spawn('general-purpose', 'go').status === 0);
    check('guard: no Task header, no run in this repo: allowed', spawn('frontend-dev', 'go', join(tmp, 'elsewhere')).status === 0);
    check('guard: missing checkpoint blocks a gated role', spawn('designer', hdr, join(tmp, 'elsewhere')).status === 2);
    write(CP('- gate 2b passed · user: "ok" · 2026-10-23'));
    check('guard: designer allowed once 2b passed', spawn('designer', `${hdr}go`).status === 0);
    check('guard: no Task header, designer allowed once 2b passed for the task its prompt names', spawn('designer', 'Read: .team/t/ac.md').status === 0);
    check('guard: frontend-dev still blocked until 3c', spawn('frontend-dev', `${hdr}go`).status === 2);
    write(CP('- gate 2b passed · user: "ok"\n- gate 3c passed · user: "ok"'));
    check('guard: frontend-dev allowed once 3c passed', spawn('frontend-dev', `${hdr}go`).status === 0);

    check('guard: retired qa-tester is blocked', spawn('qa-tester', `${hdr}go`).status === 2);
    check('guard: retired devops is blocked, with no Task header and no run too', spawn('devops', 'go').status === 2 && spawn('devops', 'go', join(tmp, 'elsewhere')).status === 2);
    check('guard: the namespaced name muffy:qa-tester is blocked too', spawn('muffy:qa-tester', `${hdr}go`).status === 2);
    check('guard: MUFFY_ALLOW_RETIRED=1 lifts the block', spawnSync(process.execPath, [guard], { input: JSON.stringify({ tool_name: 'Agent', tool_input: { subagent_type: 'devops', prompt: `${hdr}go` }, cwd: tmp }), encoding: 'utf8', env: { ...process.env, MUFFY_ALLOW_RETIRED: '1' } }).status === 0);
    // init-config.mjs + test-gate.mjs
    {
      const proj = join(tmp, 'proj');
      mkdirSync(proj, { recursive: true });
      const init = () => spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'init-config.mjs'), proj], { encoding: 'utf8' });
      const cfg = () => { try { return JSON.parse(readFileSync(join(proj, '.team', 'config.json'), 'utf8')); } catch { return null; } };
      writeFileSync(join(proj, 'package.json'), JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }));
      init();
      check('init-config: npm placeholder test script writes nothing', cfg() === null);
      writeFileSync(join(proj, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }));
      init();
      check('init-config: scripts.test with no lockfile writes npm test', cfg()?.test_command === 'npm test');
      writeFileSync(join(proj, '.team', 'config.json'), JSON.stringify({ test_command: 'make check', other: 1 }));
      writeFileSync(join(proj, 'pnpm-lock.yaml'), '');
      init();
      check('init-config: an existing test_command is never overwritten', cfg()?.test_command === 'make check' && cfg()?.other === 1);
      rmSync(join(proj, '.team'), { recursive: true });
      init();
      check('init-config: pnpm lockfile gives pnpm test', cfg()?.test_command === 'pnpm test');
      mkdirSync(join(proj, '.team', 'tk'), { recursive: true });
      const gate = spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'test-gate.mjs'), join(proj, '.team', 'tk'), '--cwd', proj], { encoding: 'utf8' });
      check('test-gate: reads the command init-config wrote (pnpm test is not installed here, so it fails, not skipped)', gate.status === 1 || gate.status === 0, String(gate.status));
      rmSync(join(proj, '.team', 'config.json'));
      check('test-gate: no config is exit 3, skipped', spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'test-gate.mjs'), join(proj, '.team', 'tk'), '--cwd', proj], { encoding: 'utf8' }).status === 3);
    }
    // the first real run of the flow (scratch-cart) found these: a loose AC table, raw test output in Results, a retried 4a, a reviewer and a brain note
    {
      const proj = join(tmp, 'run');
      const task = join(proj, '.team', 'tk');
      mkdirSync(task, { recursive: true });
      writeFileSync(join(proj, '.team', 'config.json'), JSON.stringify({ test_command: 'node -e "console.log(\'ℹ pass 1\'); console.log(\'ℹ fail 0\')"' }));
      writeFileSync(join(task, 'fix.md'), ['# Fix: tk', '## AC', '| AC-1 | total applies the discount | unit test |', ''].join('\n'));
      writeFileSync(join(task, 'ac-tests-be.md'), ['# AC tests (BE)', '', '| AC | Test | File |', '|---|---|---|', '| AC-1 | total applies a percentage discount | test/cart.test.js |', ''].join('\n'));
      const run = spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'test-gate.mjs'), task, '--cwd', proj], { encoding: 'utf8' });
      const report = readFileSync(join(task, 'qa-report.md'), 'utf8');
      check('test-gate: an AC table under any heading and any columns is merged', run.status === 0 && /\| AC-1 \| total applies a percentage discount/.test(report.split('## AC id')[1] ?? ''), report.slice(0, 300));
      writeFileSync(join(task, 'ac-tests-fe.md'), ['AC-2 | the total shows the discount | test/ui.test.js', 'AC-3 | no outer pipes either | manual', ''].join('\n'));
      const noPipes = spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'test-gate.mjs'), task, '--cwd', proj], { encoding: 'utf8' });
      const rep2 = readFileSync(join(task, 'qa-report.md'), 'utf8').split('## AC id')[1] ?? '';
      check('test-gate: an AC row with no outer pipes is read too (a dev wrote it that way)', noPipes.status === 0 && /\| AC-2 \| the total shows the discount/.test(rep2) && /\| AC-3 \|/.test(rep2) && /\| AC-1 \|/.test(rep2), rep2);
      rmSync(join(task, 'ac-tests-fe.md'));
      spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'test-gate.mjs'), task, '--cwd', proj], { encoding: 'utf8' }); // back to the one-AC report the next checks read
      check('test-gate: Results is one summary line; the raw output sits under ## Output', !/```/.test(report.split('## Bugs')[0]) && /## Output/.test(report));
      const g10 = gate10(task);
      check('gate 10: a test runner line like "fail 0" is not a failure, and the loose AC table closes the coverage gap', g10.notReady.length === 0, JSON.stringify(g10.notReady));
      const env = (role, extra = []) => spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'make-envelope.mjs'), '--role', role, '--step', '4', '--round', '1', '--task', 'tk', '--brain', '.team/brain', '--goal', 'goal text', '--done-when', 'done text', '--read', 'fix.md', ...extra], { encoding: 'utf8' });
      const rv = env('code-reviewer', []);
      check('make-envelope: code-reviewer needs no --write (the saved review is its path)', rv.status === 0 && /review-1\.md/.test(rv.stdout), rv.stderr);
      check('make-envelope: the reviewer hand-off shape carries verdict Approve, capitalised (a lower-case one cost a turn in a real run)', /"verdict":"Approve"/.test(rv.stdout) && /exactly `Approve` or `Reject`/.test(rv.stdout), rv.stdout.slice(-300));
      const be = env('backend-dev', ['--write', 'cart.js']);
      check('make-envelope: a dev gets its brain note in Write', be.status === 0 && /\.team\/brain\/agents\/backend-dev\/tk\.md/.test(be.stdout), be.stderr);
      // check-all: step 4 round 1 after a retried 4a (round 2) still sees the diagnosis
      const cp = join(task, 'checkpoint.md');
      writeFileSync(cp, CP('- base: master', 'lane: fix (bug) · skipped 1, 2, 2b, 3, 3b, 3c, 3d'));
      mkdirSync(join(task, 'handoff'), { recursive: true });
      const hand = (step, role, round, extra) => writeFileSync(join(task, 'handoff', `${step}-${role}-r${round}.json`), JSON.stringify({ role, task: 'tk', step, round, status: 'done', paths_written: ['x'], blockers: [], quality_checks: { passed: true, failed: [] }, summary: 'summary text', ...extra }));
      hand('4a', 'debugger', 2, { diagnosis: { status: 'known', confidence: 'high', cause: 'the discount is never read', files: ['cart.js'], repro: 'npm test is red', severity: 'high', owner: 'BE' } });
      hand('4b', 'auditor', 1, { audit: { verdict: 'confirm', evidence_level: 'high', repro_rerun: 'red' } });
      hand('4', 'backend-dev', 1, { ac_ids_done: ['AC-1'], decisions: [{ id: 'D-1', decision: 'reuse the test', why: 'it covers the AC' }] });
      const all = spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'check-all.mjs'), task, '--step', '4', '--round', '1'], { encoding: 'utf8' });
      check('check-all: a retried 4a (round 2) is still read at step 4 round 1', !/block:no-diagnosis/.test(all.stdout), all.stdout.slice(0, 200));
    }
    // small-fix.mjs: a small fix gets script-written release notes, anything bigger keeps the docs-writer
    {
      const v = (o) => smallVerdict({ files: ['cart.js', 'test/cart.test.js', '.team/t/fix.md'], lines: 2, severity: 'medium', ...o });
      check('small-fix: one file, 2 lines, medium severity is small (tests and .team/ do not count)', v({}).small === true, JSON.stringify(v({}).reasons));
      check('small-fix: severity high is not small', v({ severity: 'high' }).small === false && /severity high/.test(v({ severity: 'high' }).reasons.join()));
      check('small-fix: an unknown severity (no 4a hand-off) is not small', v({ severity: null }).small === false);
      check('small-fix: 3 source files, or 21 source lines, is not small', v({ files: ['a.js', 'b.js', 'c.js'] }).small === false && v({ lines: 21 }).small === false);
      check('small-fix: a migration, a dependency, a config file or an API spec is not small', ['db/migrations/001.sql', 'package.json', 'config/app.yaml', 'openapi.yaml'].every((f) => v({ files: ['cart.js', f] }).small === false));
      check('small-fix: a doc that names the changed file is not small', v({ docsText: 'See cart.js for the total.' }).small === false && v({ docsText: 'Nothing about it.' }).small === true);
      // the real 1.4.8 run: the onboard baseline names every file, so every fix in an onboarded project needed the docs-writer
      const onboarded = join(tmp, 'onboarded');
      mkdirSync(join(onboarded, 'docs', 'architecture'), { recursive: true });
      mkdirSync(join(onboarded, 'docs', 'plan'), { recursive: true });
      mkdirSync(join(onboarded, 'docs', 'adr'), { recursive: true });
      writeFileSync(join(onboarded, 'docs', 'architecture', 'baseline.md'), '# Baseline\n- cart.js: the cart functions\n');
      writeFileSync(join(onboarded, 'docs', 'plan', 'cart.md'), 'cart.js is rewritten in phase 2\n');
      writeFileSync(join(onboarded, 'docs', 'adr', '0001-cart.md'), 'We keep cart.js flat\n');
      check('small-fix: the baseline, plans and ADRs name every file and do not count as a doc about the fix', !docsText(onboarded).includes('cart.js') && v({ docsText: docsText(onboarded) }).small === true, docsText(onboarded));
      writeFileSync(join(onboarded, 'README.md'), 'Call maxPrice from cart.js to get the top price.\n');
      writeFileSync(join(onboarded, 'docs', 'usage.md'), 'Other docs under docs/ still count.\n');
      check('small-fix: a README or another docs/ page that names the file still counts', docsText(onboarded).includes('cart.js') && v({ docsText: docsText(onboarded) }).small === false && docsText(onboarded).includes('Other docs under docs/'));
      const proj = join(tmp, 'sf');
      const g = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: proj, encoding: 'utf8' });
      mkdirSync(join(proj, 'test'), { recursive: true });
      mkdirSync(join(proj, '.team', 'tk', 'handoff'), { recursive: true });
      writeFileSync(join(proj, 'cart.js'), 'export const total = (i) => 0;\n');
      writeFileSync(join(proj, 'test', 'cart.test.js'), '// t\n');
      g('init', '-b', 'main'); g('add', '.'); g('commit', '-m', 'base');
      g('checkout', '-b', 'feature/tk');
      writeFileSync(join(proj, 'cart.js'), 'export const total = (i, d = 0) => i - d;\n');
      writeFileSync(join(proj, '.team', 'tk', 'fix.md'), '# Fix: tk\n## Symptom\ntotal ignores the discount\n## Cause\ncart.js never reads d\nseverity: medium\n');
      writeFileSync(join(proj, '.team', 'tk', 'qa-report.md'), '# QA\n## Results\n`npm test` in /x/y: exit 0, tests passed\n## AC id -> test name\n| AC | test |\n|---|---|\n| AC-1 | applies the discount |\n');
      writeFileSync(join(proj, '.team', 'tk', 'handoff', '4a-debugger-r1.json'), JSON.stringify({ diagnosis: { severity: 'medium' } }));
      g('add', '.'); g('commit', '-m', 'fix');
      const sf = (...a) => spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'small-fix.mjs'), join(proj, '.team', 'tk'), '--base', 'main', '--cwd', proj, ...a], { encoding: 'utf8' });
      const small = sf();
      const notes = readFileSync(join(proj, '.team', 'tk', 'release-notes.md'), 'utf8');
      check('small-fix: a small fix writes release-notes.md from fix.md, qa-report.md and the diff, exit 0', small.status === 0 && /next=script-notes/.test(small.stdout) && /## Deploy hand-off/.test(notes) && /Revert `[0-9a-f]+`/.test(notes) && /AC-1: applies the discount/.test(notes) && !/\/x\/y/.test(notes), small.stdout + small.stderr + notes.slice(0, 400));
      writeFileSync(join(proj, '.team', 'tk', 'handoff', '4a-debugger-r2.json'), JSON.stringify({ diagnosis: { severity: 'high' } }));
      rmSync(join(proj, '.team', 'tk', 'release-notes.md'));
      const big = sf();
      check('small-fix: a later round that raises the severity to high sends the task to the docs-writer, exit 1, no notes written', big.status === 1 && /next=spawn-docs-writer/.test(big.stdout) && !/release-notes/.test(readdirSync(join(proj, '.team', 'tk')).join()), big.stdout);
      // the real 1.4.6 run: started from another checkout (HEAD there is the base), so the diff was empty and the verdict "small"
      rmSync(join(proj, '.team', 'tk', 'handoff', '4a-debugger-r2.json'));
      const elsewhere = spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'small-fix.mjs'), join(proj, '.team', 'tk'), '--base', 'main', '--check'], { cwd: tmp, encoding: 'utf8' });
      check('small-fix: with no --cwd it reads the repo of the task folder, whatever folder it is started from', elsewhere.status === 0 && /1 source/.test(elsewhere.stdout), elsewhere.stdout + elsewhere.stderr);
      const empty = sf('--head', 'main');
      check('small-fix: a diff with no source file is exit 2 and writes nothing, never "small"', empty.status === 2 && /no source file changed/.test(empty.stderr) && !/next=/.test(empty.stdout), empty.stdout + empty.stderr);
    }
    // task-usage.mjs: what the task cost, in dollars, from the transcripts
    {
      const rec = (id, ts, usage, extra = {}, model = 'claude-sonnet-5-5') => ({ type: 'assistant', requestId: id, timestamp: ts, message: { model, usage }, ...extra });
      const u = (i, cc, o, cr = 0, split) => ({ input_tokens: i, cache_creation_input_tokens: cc, output_tokens: o, cache_read_input_tokens: cr, ...(split ? { cache_creation: split } : {}) });
      const near = (a, b) => Math.abs(a - b) < 1e-9;
      // sonnet 5.5: $2 in, $10 out, $0.10 cache read, $2.50 write (5 minutes), $4 write (1 hour) per million tokens
      check('task-usage: a request is priced by its model: input, cache write, cache read and output', near(requestCost('claude-sonnet-5-5', u(2, 500, 40, 9000)), (2 * 2 + 500 * 2.5 + 9000 * 0.1 + 40 * 10) / 1e6), String(requestCost('claude-sonnet-5-5', u(2, 500, 40, 9000))));
      check('task-usage: a 1-hour cache write is priced at its own rate', near(requestCost('claude-sonnet-5-5', u(0, 1000, 0, 0, { ephemeral_1h_input_tokens: 1000, ephemeral_5m_input_tokens: 0 })), 0.004));
      check('task-usage: a model that is not in pricing.json has no price, never a guess', requestCost('claude-unknown-9', u(1, 1, 1)) === null && requestCost(undefined, u(1, 1, 1)) === null);
      check('task-usage: a dated model id is priced as its family', requestCost('claude-sonnet-5-5-20261101', u(10, 0, 0)) === requestCost('claude-sonnet-5-5', u(10, 0, 0)));
      check('task-usage: haiku 5.5 is five times dearer above a 100K prompt', near(requestCost('claude-haiku-5-5', u(1000, 0, 0, 150000)), (5 * (1000 * 0.1 + 150000 * 0.01)) / 1e6));
      const o = orchestratorTokens([
        rec('r0', '2026-01-01T09:00:00Z', u(1, 1000, 100)), // before the task
        rec('r1', '2026-01-01T10:00:00Z', u(2, 500, 10, 9000)),
        rec('r1', '2026-01-01T10:00:01Z', u(2, 500, 40, 9000)), // the same request logged again: counted once, the larger one
        rec('r2', '2026-01-01T10:05:00Z', u(1, 0, 20, 9500), { isSidechain: true }), // not the Orchestrator
        rec('r3', '2026-01-01T11:00:00Z', u(3, 0, 7, 9800)),
        rec('r4', '2026-01-01T12:00:00Z', u(1, 0, 1)), // after --until
      ], Date.parse('2026-01-01T10:00:00Z'), Date.parse('2026-01-01T11:30:00Z'));
      check('task-usage: Orchestrator requests count once each, inside the window, with their dollars and the cache reads apart', o.fresh === 542 + 10 && o.cacheRead === 9000 + 9800 && o.requests === 2 && o.unpriced === 0 && near(o.usd, 2554e-6 + 1056e-6), JSON.stringify(o));
      // a session file with its subagents next to it (<session>/subagents/*.jsonl)
      const sess = join(tmp, 'sess');
      mkdirSync(join(sess, 'subagents'), { recursive: true });
      const jl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n');
      writeFileSync(`${sess}.jsonl`, jl([rec('m1', '2026-01-01T10:10:00Z', u(1, 400, 100))]));
      writeFileSync(join(sess, 'subagents', 'agent-a.jsonl'), jl([rec('s1', '2026-01-01T10:20:00Z', u(1, 900, 100), { isSidechain: true }), rec('s1', '2026-01-01T10:20:01Z', u(1, 900, 150), { isSidechain: true })]));
      writeFileSync(join(sess, 'subagents', 'agent-a.meta.json'), JSON.stringify({ agentType: 'muffy:debugger' }));
      const tdir = join(tmp, 'usage-task');
      mkdirSync(tdir, { recursive: true });
      const usage = (...a) => spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'task-usage.mjs'), tdir, '--transcript', `${sess}.jsonl`, '--since', '2026-01-01T10:00:00Z', ...a], { encoding: 'utf8' }).stdout;
      const full = usage('--budget-usd', '1');
      check('task-usage: dollars for the Orchestrator and the subagents, the total and the target', /^usage: \$0\.006 · orchestrator \$0\.002 · subagents \$0\.004 · target \$1\.00: under/.test(full) && /debugger \$0\.004/.test(full) && /2026-11-03 list prices/.test(full), full);
      writeFileSync(join(tdir, 'spawns.tsv'), '4\tbackend-dev\tsonnet\tmedium\t1\tpass\t0\tdone tok:500\n');
      check('task-usage: spawns.tsv is no source of dollars (it has token counts only), so it changes nothing', usage('--budget-usd', '1') === full);
      rmSync(join(tdir, 'spawns.tsv'));
      rmSync(join(sess, 'subagents'), { recursive: true });
      const none = usage('--budget-usd', '1');
      check('task-usage: with no subagent transcripts the subagents are n/a, the total "at least" and the target "cannot tell"', /^usage: at least \$0\.002 · orchestrator \$0\.002 · subagents n\/a/.test(none) && /cannot tell/.test(none) && !/: under/.test(none), none);
      check('task-usage: a partial total already over the target is still over', /: over/.test(usage('--budget-usd', '0.001')));
      writeFileSync(`${sess}.jsonl`, jl([rec('m1', '2026-01-01T10:10:00Z', u(1, 400, 100), {}, 'claude-unknown-9')]));
      const unknown = usage();
      check('task-usage: requests on an unpriced model are left out and said so; the total is "at least"', /usage: at least \$0\.000/.test(unknown) && /1 request\(s\) on a model with no price/.test(unknown), unknown);
      check('task-usage: a bad --budget-usd is exit 2', spawnSync(process.execPath, [rel('skills', 'muffy', 'scripts', 'task-usage.mjs'), tdir, '--budget-usd', 'abc'], { encoding: 'utf8' }).status === 2);
    }
    // fix lane: the debugger and the auditor are muffy roles, ungated; a dev step-4 spawn waits for the audit
    const fixHandoff = join(dir, 'handoff');
    mkdirSync(fixHandoff, { recursive: true });
    write(FIXCP('- stage: fix'));
    const devPrompt = `${hdr}Write: .worktrees/feature-t/.team/t/handoff/4-backend-dev-r1.json\n`;
    check('guard: fix lane, debugger spawn with the Task header is allowed', spawn('debugger', `${hdr}go`).status === 0);
    check('guard: fix lane, auditor spawn with the Task header is allowed', spawn('auditor', `${hdr}go`).status === 0);
    check('guard: fix lane, debugger and auditor spawns without a Task header fail closed like every muffy role', spawn('debugger', 'go').status === 2 && spawn('auditor', 'go').status === 2);
    check('guard: fix lane, backend-dev step 4 is blocked before the audit', spawn('backend-dev', devPrompt).status === 2);
    writeFileSync(join(fixHandoff, '4b-auditor-r1.json'), JSON.stringify({ step: '4b', round: 1, audit: { verdict: 'reject' } }));
    check('guard: fix lane, backend-dev step 4 is blocked after a reject', spawn('backend-dev', devPrompt).status === 2);
    write(FIXCP('- audit 4b: risk accepted · user: "go ahead"'));
    check('guard: fix lane, backend-dev step 4 is allowed once the user accepted the risk', spawn('backend-dev', devPrompt).status === 0);
    write(FIXCP('- stage: fix'));
    writeFileSync(join(fixHandoff, '4b-auditor-r2.json'), JSON.stringify({ step: '4b', round: 2, audit: { verdict: 'confirm' } }));
    check('guard: fix lane, backend-dev step 4 is allowed after a confirm', spawn('backend-dev', devPrompt).status === 0);
    check('guard: fix lane, a step-6 spawn is not held by the audit', spawn('code-reviewer', `${hdr}Write: .worktrees/feature-t/.team/t/handoff/6-code-reviewer-r1.json\n`).status === 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
