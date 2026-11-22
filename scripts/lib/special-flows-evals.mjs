// Offline checks for the special flows (skills/muffy/references/verify-profile.md, upgrade-profile.md, fix-profile.md
// "Diagnose only"; route.md rows), on top of the loop scenarios in evals/mock-scenarios/:
//   - verify: the card says the requester's branch is never edited or merged; a verify task passes check-artifacts with
//     an Orchestrator-written ac.md and no contract; a reject asks before any fix
//   - upgrade: 2b is skipped on record, 3c (the ADR) cannot be skipped, devs wait for it, 3d always runs, the 3c summary
//     is the contract gate and reads the AC rows
//   - a gate line's free text naming another gate does not answer that gate (gateState)
//   - the references and the route name each flow where the router and the lane table look for it
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { LANES, STEP_LABELS, skipsOf, neverSkipOf, formatRunProfile, planCard } from '../../skills/muffy/scripts/lanes.mjs';
import { gateState, missingGates } from '../../skills/muffy/scripts/gate-rules.mjs';
import { recordGate } from '../../skills/muffy/scripts/checkpoint.mjs';
import { gate3c } from '../../skills/muffy/scripts/gate-summary.mjs';
import { checkAll } from '../../skills/muffy/scripts/check-all.mjs';
import { checkTask as checkArtifacts } from '../../skills/muffy/scripts/check-artifacts.mjs';
import { route } from './route-sim.mjs';

const CP = (lane, status = '- stage: x') => `# Checkpoint: t\n\nUpdated: step 3\n\n## Goal\n\nx\n\n## Run profile\n\n${lane}\n\n## Status\n\n${status}\n`;
const AC = (lane) => `# AC: t\nLane: ${lane}    Kind: refactor    Owner: BE\n## Goal\nx\n## AC\nAC-1 | the CSV export has a header row | test/export.test.ts\nAC-2 | existing tests pass | npm test\n## Out of scope\nNone.\n`;

export function runSpecialFlowsEvals({ check, root }) {
  const ref = (f) => readFileSync(join(root, 'skills/muffy/references', f), 'utf8').replace(/\r\n/g, '\n');
  const ids = (text) => [...new Set((text ?? '').match(/\b\d+[a-z]?\b/g) ?? [])].filter((s) => s in STEP_LABELS || ['3b', '3e', '5', '5b', '12'].includes(s));
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

  /* verify */
  const vcard = planCard('verify');
  check('verify: the card runs review, the test gate, the Human gate and docs; no build', vcard[1].split(' → ').length === 4 && vcard[1].includes(STEP_LABELS['6'].th) && !vcard[1].includes(STEP_LABELS['4'].th));
  check('verify: 3d is skipped by definition (devops is retired; the test gate at 7 is the check)', skipsOf('verify').includes('3d'));
  check('verify: the card says the requester branch is never edited or merged', /ไม่แก้และไม่ merge/.test(vcard.at(-1)) && /never edited or merged/.test(planCard('verify', { lang: 'en' }).at(-1)));
  check('verify: ungated, quick baseline', LANES.verify.gated === false && LANES.verify.baseline === 'quick');
  check('verify: route sends review-and-test to verify, a bare review stays review', route({ outcome: 'verify' }).route === 'verify' && route({ outcome: 'review' }).route === 'review');
  const vp = ref('verify-profile.md');
  check('verify-doc: works on a copy, verify/<task>, and never edits or merges the requester branch', vp.includes('verify/<task>') && /never edited or merged/.test(vp) && vp.includes('checkpoint.mjs" profile .team/<task> verify'));
  check('verify-doc: a reject is reported and asked once (fix on the copy / report only)', vp.includes('ask:verify-fix') && /\*\*Fix on the copy/.test(vp) && /\*\*Report only\*\*/.test(vp));

  /* upgrade */
  check('upgrade: research, the ADR and its gate are never skipped; 3d is skipped', ['1', '3', '3c'].every((s) => neverSkipOf('upgrade').includes(s) && !skipsOf('upgrade').includes(s)) && skipsOf('upgrade').includes('3d'));
  check('upgrade: the card has no smoke step, and shows the ADR approval', !planCard('upgrade')[1].includes('ทดสอบ stack บน docker') && planCard('upgrade')[1].includes('คุณอนุมัติ ADR'));
  check('upgrade: route sends a version bump to the lane, before bug triage', route({ outcome: 'code', upgrade: true, bug: true, fix: { has_symptom: true, has_location: true } }).route === 'upgrade');
  const up = ref('upgrade-profile.md');
  check('drift: upgrade-profile.md never-skip list matches lanes.mjs', same(ids(up.match(/^Never skipped: ([^.]+)\./m)?.[1]), neverSkipOf('upgrade')));
  check('upgrade-doc: only a dependency already in the manifest; a new one is the full flow', /already in the manifest/.test(up) && /full flow/.test(up) && up.includes('checkpoint.mjs" profile .team/<task> upgrade'));
  check('upgrade-doc: regression is a human step (no qa-tester), baseline refreshed after', /the human runs regression/.test(up) && /silent refresh/.test(up));

  const tmp = mkdtempSync(join(tmpdir(), 'muffy-flows-'));
  try {
    // upgrade: gates on record
    let dir = join(tmp, 'u');
    mkdirSync(join(dir, 'handoff'), { recursive: true });
    writeFileSync(join(dir, 'checkpoint.md'), CP(formatRunProfile('upgrade')));
    let msg = '';
    try { msg = recordGate(dir, '2b', 'skip', { reason: 'no plan in an upgrade; the ADR is approved at 3c' }); } catch (e) { msg = `ERR ${e.message}`; }
    check('upgrade: gate 2b is skipped on record', /gate 2b skipped/.test(msg), msg);
    try { msg = recordGate(dir, '3c', 'skip', { reason: 'x' }); } catch (e) { msg = `ERR ${e.message}`; }
    check('upgrade: gate 3c (the ADR) cannot be skipped', msg.startsWith('ERR') && /upgrade/.test(msg), msg);
    const cp = readFileSync(join(dir, 'checkpoint.md'), 'utf8');
    check('upgrade: the architect starts after the 2b skip; devs wait for the ADR at 3c', missingGates(cp, 'architect', '').length === 0 && JSON.stringify(missingGates(cp, 'backend-dev', '')) === '["3c"]');
    writeFileSync(join(dir, 'ac.md'), AC('upgrade'));
    writeFileSync(join(dir, 'contract.md'), '# Contract\n\n## Upgrade: React 18 to 19\n\n[verify] the forwardRef removals\n');
    const g = gate3c(dir);
    check('upgrade: the 3c summary is the contract gate and reads the AC rows', g.notReady.length === 0 && g.lines.join('\n').includes('AC-1 the CSV export has a header row') && /Contract/.test(g.lines[0]), JSON.stringify(g.notReady));

    // upgrade: the researcher's brief lists breaking changes as must-not-miss items; ac.md maps them in ## Traceability
    const brief = '# Brief\n\n## Must-not-miss requirements\n\n- forwardRef is removed from function components\n- the legacy context API is gone\n';
    writeFileSync(join(dir, 'brief.md'), brief);
    check('upgrade: check-artifacts asks for ## Traceability when the brief lists breaking changes', checkArtifacts(dir).some((e) => /Traceability/.test(e)));
    writeFileSync(join(dir, 'ac.md'), AC('upgrade').replace('## Out of scope', '## Traceability\n\n| Requirement | AC |\n|---|---|\n| forwardRef is removed from function components | AC-1 |\n| the legacy context API is gone | AC-2 |\n\n## Out of scope'));
    writeFileSync(join(dir, 'contract.md'), '# Contract\n\n## Upgrade: React 18 to 19\n\nAC-1: drop forwardRef in src/ui. AC-2: move to createContext.\n');
    check('upgrade: an upgrade task with brief, traced ac.md and contract passes check-artifacts', checkArtifacts(dir).length === 0, checkArtifacts(dir).join(' | '));

    // verify: an Orchestrator-written ac.md, no contract, a reject
    dir = join(tmp, 'v');
    mkdirSync(join(dir, 'handoff'), { recursive: true });
    writeFileSync(join(dir, 'checkpoint.md'), CP(formatRunProfile('verify'), '- stage: review'));
    writeFileSync(join(dir, 'ac.md'), AC('verify'));
    writeFileSync(join(dir, 'handoff', '6-code-reviewer-r1.json'), JSON.stringify({ role: 'code-reviewer', task: 't', step: '6', round: 1, status: 'done', verdict: 'Reject', paths_written: [], blockers: [{ id: 'B-1', problem: 'empty exports have no header row', file: 'src/a.ts:12', owner: 'BE' }], quality_checks: { passed: true, failed: [] }, summary: 'one blocker' }));
    const r = checkAll(dir, { step: '6', round: 1 });
    check('verify: check-all answers ask:verify-fix on a reject, not fix:<owner>', r.next === 'ask:verify-fix', r.next);
    // the loop CLI as loops.md calls it reads the lane from the checkpoint beside the hand-offs, as check-all does
    const loop = (...a) => spawnSync(process.execPath, [join(root, 'skills/muffy/scripts/next-action.mjs'), 'loop', join(dir, 'handoff'), ...a], { encoding: 'utf8' }).stdout.split('\n')[0];
    check('verify: next-action loop with no --profile reads the lane from the checkpoint and asks first', /^next=ask:verify-fix /.test(loop()), loop());
    check('verify: next-action loop --profile overrides the checkpoint lane', /^next=fix:BE /.test(loop('--profile', 'feature')), loop('--profile', 'feature'));
    check('verify: check-artifacts accepts the Orchestrator-written ac.md with no contract', checkArtifacts(dir).length === 0, checkArtifacts(dir).join(' | '));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  /* gateState: a gate line's free text is that gate's */
  check('gates: a 2b skip whose reason names 3c does not answer 3c', gateState(CP('x', '- gate 2b skipped · the ADR is approved at 3c'), '3c') === 'open' && gateState(CP('x', '- gate 2b skipped · the ADR is approved at 3c'), '2b') === 'skipped');
  check('gates: the older loose wording still counts', gateState(CP('x', 'Gates 3c and 3d passed.'), '3c') === 'passed');

  /* the router and the references */
  const routeDoc = ref('route.md');
  check('route: verify and upgrade have a Routes row and a minimum-intake row', /^\| [^\n]*\| verify \(\[verify-profile\.md\]/m.test(routeDoc) && /^\| [^\n]*\| upgrade \(\[upgrade-profile\.md\]/m.test(routeDoc) && /^\| verify \|/m.test(routeDoc) && /^\| upgrade \|/m.test(routeDoc));
  check('route: smoke on a branch is the ops route; measuring first is offered in the internal triage', /does the stack boot on this branch\" \| ops/.test(routeDoc) && /\*\*measure it first\*\*/.test(ref('change-profile.md')));
  check('docs: SKILL.md, run-profile.md and setup.md point at both lanes', ['verify-profile.md', 'upgrade-profile.md'].every((f) => readFileSync(join(root, 'skills/muffy/SKILL.md'), 'utf8').includes(f) && ref('run-profile.md').includes(f) && ref('setup.md').includes(f)));
  check('docs: a stopped or reported run still writes closed in the checkpoint, so todo and the menu drop it', /still `closed` \(write `closed · diagnosed`\)/.test(ref('closing.md')) && /`closed · reported`/.test(ref('verify-profile.md')) && /when `## Status` says `closed`/.test(ref('todo.md')));
  check('docs: diagnose only and the stop-point close are described', /^## Diagnose only$/m.test(ref('fix-profile.md')) && ref('fix-profile.md').includes('--until 4b') && /\*\*Stopped at a stop point\*\*/.test(ref('closing.md')));
}
