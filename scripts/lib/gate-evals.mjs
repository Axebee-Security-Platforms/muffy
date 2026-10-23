// Offline checks for the human gates (skills/muffy/references/step-details.md 2b and 3c, hooks-enforcement.md §14):
//   - the rule set: which spawn needs which gate, what counts as answered, what a hand-off past an open gate is
//   - checkpoint.mjs gate: approval needs the pause saved, a skip of 3c is refused once design.md exists
//   - guard-gates.mjs: blocks the spawn before its gate, lets the rest through
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gateState, gatesForSpawn, missingGates, gateErrors } from '../../skills/muffy/scripts/gate-rules.mjs';
import { recordGate } from '../../skills/muffy/scripts/checkpoint.mjs';

const CP = (status, profile = 'Full flow, feature lane.') =>
  `# Checkpoint: t\n\nUpdated: step 3\n\n## Goal\n\nx\n\n## Run profile\n\n${profile}\n\n## Status\n\n${status}\n`;

export function runGateEvals({ check, root }) {
  const rel = (...p) => join(root, ...p);

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
    check('guard: a prompt with no Task header is not a muffy spawn', spawn('frontend-dev', 'go').status === 0);
    check('guard: missing checkpoint blocks a gated role', spawn('designer', hdr, join(tmp, 'elsewhere')).status === 2);
    write(CP('- gate 2b passed · user: "ok" · 2026-10-23'));
    check('guard: designer allowed once 2b passed', spawn('designer', `${hdr}go`).status === 0);
    check('guard: frontend-dev still blocked until 3c', spawn('frontend-dev', `${hdr}go`).status === 2);
    write(CP('- gate 2b passed · user: "ok"\n- gate 3c passed · user: "ok"'));
    check('guard: frontend-dev allowed once 3c passed', spawn('frontend-dev', `${hdr}go`).status === 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
