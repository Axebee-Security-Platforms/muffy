// Offline checks for the lane table (skills/muffy/scripts/lanes.mjs):
//   - every lane and scope round-trips through the Run profile line, and the older wordings still parse
//   - the lines the references used to prescribe (`fix: skipped …`, `lite: skipped …`) are read as their lane, so the
//     gate guard and the 4b audit guard act on them (they were read as the feature lane before)
//   - check-all reads gates with gateState: `gate 3c not passed` is not a pass
//   - checkpoint.mjs profile replaces the lane line and keeps the others; make-envelope carries Scope:
//   - each lane reference names the profile command and states the never-skip list the table holds
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { LANES, SCOPES, STEP_ORDER, skipsOf, neverSkipOf, laneSpec, formatRunProfile, parseRunProfile, isLaneLine } from '../../skills/muffy/scripts/lanes.mjs';
import { laneOf, redesignScope, missingGates, auditMissing } from '../../skills/muffy/scripts/gate-rules.mjs';
import { setProfile } from '../../skills/muffy/scripts/checkpoint.mjs';
import { checkAll } from '../../skills/muffy/scripts/check-all.mjs';
import { PROMOTE_ACTION } from '../../skills/muffy/scripts/next-action.mjs';
import { validate } from '../../skills/muffy/scripts/schema.mjs';

const CP = (profile, status = '- stage: x') =>
  `# Checkpoint: t\n\nUpdated: step 3\n\n## Goal\n\nx\n\n## Run profile\n\n${profile}\n\n## Status\n\n${status}\n`;

export function runLaneTableEvals({ check, root }) {
  const ref = (f) => readFileSync(join(root, 'skills/muffy/references', f), 'utf8').replace(/\r\n/g, '\n');

  /* the table */
  check('lanes: every skipped step is a step id', Object.values(LANES).every((l) => [l.skips, ...Object.values(l.scopes ?? {}).map((s) => s.skips ?? [])].flat().every((s) => STEP_ORDER.includes(s))));
  check('lanes: no lane or scope skips a step it must run', Object.keys(LANES).every((l) => [undefined, ...SCOPES].every((sc) => !skipsOf(l, sc).some((s) => neverSkipOf(l, sc).includes(s)))));
  check('lanes: the change lane has a skip list per scope', SCOPES.every((s) => LANES.change.scopes[s]?.skips));
  check('lanes: only the internal scope is ungated; a change line with no or an unknown scope fails closed (gated)', SCOPES.every((s) => laneSpec('change', s).gated === (s !== 'internal')) && laneSpec('change', null).gated && laneSpec('change', 'bogus').gated);
  check('lanes: steps 8 and 9 are gone', !STEP_ORDER.includes('8') && !STEP_ORDER.includes('9'));

  /* the Run profile line */
  const pairs = [...Object.keys(LANES).filter((l) => l !== 'change').map((l) => [l, null]), ...SCOPES.map((s) => ['change', s])];
  for (const [lane, scope] of pairs) {
    const line = formatRunProfile(lane, { scope: scope ?? undefined });
    const back = parseRunProfile(CP(line));
    check(`lanes: "${line}" reads back as ${lane}${scope ? ` (${scope})` : ''}`, back.lane === lane && back.scope === scope, JSON.stringify(back));
  }
  check('lanes: a run skip is merged in step order, a role is kept as written', formatRunProfile('change', { scope: 'ui-only', skip: ['3d', 'architect'] }) === 'lane: change (ui-only) · skipped 1, 2b, 3d, architect');
  let refused = '';
  try { formatRunProfile('change'); } catch (e) { refused = e.message; }
  check('lanes: a change line without a scope is refused', /needs a scope/.test(refused), refused);
  check('lanes: the old ids write the change lane line', formatRunProfile('lite') === formatRunProfile('change', { scope: 'internal' }) && formatRunProfile('redesign', { scope: 'logic-only' }) === formatRunProfile('change', { scope: 'logic-only' }));

  const legacy = [
    ['fix: skipped 1, 2, 3, 3b, 3c, 3d', 'fix', null],
    ['lite: skipped 1, 2, 3b, 3c', 'change', 'internal'],
    ['redesign lane (ui+logic): skipped 1', 'change', 'ui+logic'],
    // what PR1-3 wrote with checkpoint.mjs profile, before lite and redesign became the change lane
    ['lane: lite · skipped 1, 2, 2b, 3b, 3c, 3d', 'change', 'internal'],
    ['lane: redesign (ui-only) · skipped 1, 2b', 'change', 'ui-only'],
    ['lane: redesign (ui+logic) · skipped 1', 'change', 'ui+logic'],
    ['lane: redesign (logic-only) · skipped 1, 3b, 3e', 'change', 'logic-only'],
    ['fix lane: skipped 1, 2, 3, 3b, 3c, 3d, 8', 'fix', null],
    ['Fix lane.', 'fix', null],
    ['Full flow, feature lane.', 'feature', null],
    ['Full run; nothing skipped.', 'feature', null],
  ];
  for (const [line, lane, scope] of legacy) {
    check(`lanes: older line "${line}" still reads as ${lane}${scope ? ` (${scope})` : ''}`, laneOf(CP(line)) === lane && parseRunProfile(CP(line)).scope === scope);
  }
  check('lanes: the skipped steps on the lane line are read back, roles and removed steps dropped', JSON.stringify(parseRunProfile(CP('redesign lane (ui-only): skipped 1, 2b, architect, 3d')).skipped) === '["1","2b","3d"]' && JSON.stringify(parseRunProfile(CP('fix lane: skipped 1, 3d, 8')).skipped) === '["1","3d"]');

  /* the guards act on the lines the references prescribed */
  const fixLine = 'fix: skipped 1, 2, 3, 3b, 3c, 3d';
  const step4 = 'Task: t\nWrite: .worktrees/feature-t/.team/t/handoff/4-backend-dev-r1.json\n';
  check('lanes: a fix-lane dev waits on no plan or design gate', missingGates(CP(fixLine), 'backend-dev', step4).length === 0);
  check('lanes: a lite-lane architect waits on no gate', missingGates(CP('lite: skipped 1, 2, 3b, 3c'), 'architect', '').length === 0 && missingGates(CP('lane: lite · skipped 1, 2, 2b, 3b, 3c'), 'architect', '').length === 0);
  check('lanes: an old redesign line still gates its devs', missingGates(CP('lane: redesign (ui-only) · skipped 1, 2b'), 'frontend-dev', '').length === 2 && missingGates(CP('lane: redesign · skipped 1'), 'frontend-dev', '').length === 2);
  check('lanes: the fix-lane audit guard applies to `fix:` lines', auditMissing(CP(fixLine), 'backend-dev', step4, []) !== null && auditMissing(CP(fixLine), 'backend-dev', step4, [{ step: '4b', round: 1, audit: { verdict: 'confirm' } }]) === null);

  /* checkpoint.mjs profile, check-all and make-envelope */
  const tmp = mkdtempSync(join(tmpdir(), 'muffy-lanes-'));
  try {
    const dir = join(tmp, 't');
    mkdirSync(join(dir, 'handoff'), { recursive: true });
    writeFileSync(join(dir, 'checkpoint.md'), CP('lite: skipped 1, 2, 3b, 3c\n3:architect r1 · effort high (default) · model sonnet'));
    const line = setProfile(dir, 'redesign', { scope: 'logic-only', skip: ['3d'] });
    const rp = readFileSync(join(dir, 'checkpoint.md'), 'utf8').split('## Run profile')[1].split('## Status')[0].trim().split('\n');
    check('checkpoint profile: the lane line is replaced, other lines stay', rp[0] === line && rp.length === 2 && rp[1].startsWith('3:architect') && !rp.some((l) => l.startsWith('lite:')));
    check('checkpoint profile: the written line is a lane line', isLaneLine(line) && !isLaneLine(rp[1]));

    writeFileSync(join(dir, 'checkpoint.md'), CP(formatRunProfile('feature'), '- gate 2b passed · user: "ok"\n- gate 3c not passed · user: "change the header"\n- 3d passed'));
    writeFileSync(join(dir, 'handoff', '4-backend-dev-r1.json'), JSON.stringify({ role: 'backend-dev', task: 't', step: '4', round: 1, status: 'done', paths_written: ['x'], blockers: [], quality_checks: { passed: true, failed: [] }, summary: 'x' }));
    const loop = checkAll(dir, { step: '4', round: 1 }).results.find(([n]) => n === 'loop')?.[1] ?? [];
    check('check-all: `gate 3c not passed` does not count as passed', loop.some((e) => e.startsWith('block:gate-not-passed')), loop.join(' | '));

    writeFileSync(join(dir, 'checkpoint.md'), CP(formatRunProfile('lite', { skip: ['3d'] }), '- stage: build'));
    const liteLoop = checkAll(dir, { step: '4', round: 1 }).results.find(([n]) => n === 'loop')?.[1] ?? [];
    check('check-all: a 3d skip written on the lane line is honoured without --skip', !liteLoop.some((e) => e.startsWith('block:gate-not-passed')), liteLoop.join(' | '));

    writeFileSync(join(dir, 'checkpoint.md'), CP(fixLine, '- stage: fix'));
    const fixChecks = checkAll(dir, { step: '4', round: 1 }).results.find(([n]) => n === 'fix lane');
    check('check-all: the fix lane is read from the checkpoint when --profile is left out', !!fixChecks && fixChecks[1].some((e) => /4a diagnosis/.test(e)));
    check('check-all: a bug fix needs the 4b audit before step 4', fixChecks[1].some((e) => /4b audit/.test(e)));
    writeFileSync(join(dir, 'checkpoint.md'), CP(formatRunProfile('fix', { scope: 'cosmetic' }), '- stage: fix'));
    const cosChecks = checkAll(dir, { step: '4', round: 1 }).results.find(([n]) => n === 'fix lane')?.[1] ?? [];
    check('check-all: a cosmetic fix needs no 4b audit, still the 4a diagnosis', !cosChecks.some((e) => /4b audit/.test(e)) && cosChecks.some((e) => /4a diagnosis/.test(e)), cosChecks.join(' | '));

    // after a promote, the fix lane's 4a hand-off stays in handoff/ but belongs to the lane the task left
    const ok = { task: 't', round: 1, status: 'done', paths_written: ['src/pricing/round.ts'], blockers: [], quality_checks: { passed: true, failed: [] }, summary: 'done as asked' };
    const dec = { decisions: [{ id: 'D-1', decision: 'Round once per invoice', why: 'The contract names it; per-line rounding was the cause' }] };
    const diagnosis = (extra) => ({ ...ok, role: 'debugger', step: '4a', summary: 'diagnosed the cause', diagnosis: { confidence: 'high', ...extra } });
    for (const to of ['change-internal', 'change-visible', 'full']) {
      for (const f of readdirSync(join(dir, 'handoff'))) rmSync(join(dir, 'handoff', f));
      writeFileSync(join(dir, 'handoff', '4a-debugger-r1.json'), JSON.stringify(diagnosis({ status: 'needs-full-flow', reason: 'the rounding rule in the contract', promote_to: to })));
      const visible = to !== 'change-internal';
      const lane = to === 'change-internal' ? formatRunProfile('change', { scope: 'internal', skip: ['3d'] }) : to === 'change-visible' ? formatRunProfile('change', { scope: 'logic-only' }) : formatRunProfile('feature');
      writeFileSync(join(dir, 'checkpoint.md'), CP(lane, visible ? '- paused at pause:plan-review · resume when the user answers' : '- stage: build'));
      if (visible) writeFileSync(join(dir, 'handoff', '2-product-manager-r2.json'), JSON.stringify({ ...ok, ...dec, role: 'product-manager', step: '2', round: 2, paths_written: ['.team/t/ac.md'] }));
      else writeFileSync(join(dir, 'handoff', '4-backend-dev-r1.json'), JSON.stringify({ ...ok, ...dec, role: 'backend-dev', step: '4' }));
      const r = checkAll(dir, visible ? { step: '2', round: 2 } : { step: '4', round: 1 });
      const bad = r.results.filter(([n]) => n === 'loop' || n === 'gates').flatMap(([, e]) => e);
      check(`check-all: after a promote to ${to}, the old 4a hand-off neither promotes again nor trips the gates`, !bad.length && !r.next.startsWith('promote:'), `${r.next} | ${bad.join(' | ')}`);
    }

    // a cosmetic fix whose diagnosis is above low is a bug: the audit is required again
    for (const f of readdirSync(join(dir, 'handoff'))) rmSync(join(dir, 'handoff', f));
    writeFileSync(join(dir, 'checkpoint.md'), CP(formatRunProfile('fix', { scope: 'cosmetic' }), '- stage: fix'));
    writeFileSync(join(dir, 'handoff', '4a-debugger-r1.json'), JSON.stringify(diagnosis({ status: 'known', cause: 'the button hides when the cart is empty', files: ['src/ui/Submit.tsx'], repro: '/checkout with an empty cart', severity: 'medium', owner: 'FE' })));
    const medChecks = checkAll(dir, { step: '4', round: 1 }).results.find(([n]) => n === 'fix lane')?.[1] ?? [];
    check('check-all: a cosmetic fix diagnosed above low needs the audit and the bug scope', medChecks.some((e) => /is a bug/.test(e)) && medChecks.some((e) => /4b audit/.test(e)), medChecks.join(' | '));
    const sev = (s) => [{ step: '4a', round: 1, diagnosis: { status: 'known', severity: s } }];
    const cos = CP(formatRunProfile('fix', { scope: 'cosmetic' }));
    check('fix scope: the guard lets a cosmetic dev skip 4b only on a low diagnosis', auditMissing(cos, 'frontend-dev', step4.replace('backend', 'frontend'), sev('low')) === null && /is a bug/.test(auditMissing(cos, 'frontend-dev', step4.replace('backend', 'frontend'), sev('medium')) ?? '') && auditMissing(cos, 'frontend-dev', step4.replace('backend', 'frontend'), [...sev('medium'), { step: '4b', round: 1, audit: { verdict: 'confirm' } }]) === null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const head = (...extra) => {
    const r = spawnSync(process.execPath, [join(root, 'skills/muffy/scripts/make-envelope.mjs'), '--role', 'architect', '--step', '3', '--task', 't', '--brain', '.team/brain', '--goal', 'Write the contract for the change', '--read', 'ac.md', '--write', 'contract.md', ...extra], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.split('\n')[0] : `ERR ${r.stderr}`;
  };
  // one header scheme: fix → Profile: fix; change → Scope: <scope>; the older --profile lite → Scope: internal
  check('make-envelope: each scope gets exactly its Scope: header and no Profile:', ['internal', 'ui-only', 'ui+logic', 'logic-only'].every((s) => head('--scope', s).endsWith(`Scope: ${s}`) && !head('--scope', s).includes('Profile:')));
  check('make-envelope: --profile lite becomes Scope: internal; --profile fix stays Profile: fix', head('--profile', 'lite').endsWith('Scope: internal') && !head('--profile', 'lite').includes('Profile:') && head('--profile', 'fix').endsWith('Profile: fix'));
  const agentRef = (p) => readFileSync(join(root, 'agent-references', p), 'utf8');
  check('agents: the internal-scope refs key on Scope: internal, none on Profile: lite alone', ['architect/core.md', 'architect/workflow.md', 'devops/core.md', 'frontend-dev/core.md', 'qa-tester/core.md'].every((p) => agentRef(p).includes('Scope: internal')) && !['architect/core.md', 'devops/core.md', 'frontend-dev/core.md', 'qa-tester/core.md'].some((p) => agentRef(p).includes('Profile: lite')));

  /* the references name the command and the lists the table holds */
  for (const [f, cmd] of [['setup.md', 'feature'], ['fix-profile.md', 'fix'], ['change-profile.md', 'change --scope']]) {
    check(`docs: ${f} writes the lane line with checkpoint.mjs profile`, ref(f).includes(`checkpoint.mjs" profile .team/<task> ${cmd}`));
  }
  // a promotion switches the lane with the command too: a hand-written "promoted from the fix lane" still reads as fix
  for (const f of ['fix-profile.md', 'change-profile.md']) {
    const doc = ref(f);
    check(`docs: ${f} switches a promoted run with checkpoint.mjs profile … feature`, /checkpoint\.mjs"? profile \.team\/<task> feature/.test(doc) && !/rename the profile|change `## Run profile`/.test(doc));
  }
  const ids = (text) => [...new Set((text ?? '').match(/\b\d+[a-z]?\b/g) ?? [])].filter((s) => STEP_ORDER.includes(s));
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  check('drift: fix-profile.md never-skip list matches lanes.mjs', same(ids(ref('fix-profile.md').match(/^Never skipped: ([^.]+)\./m)?.[1]), neverSkipOf('fix')));
  const change = ref('change-profile.md');
  check('drift: change-profile.md internal never-skip list matches lanes.mjs', same(ids(change.match(/^Internal: Skipped: [^\n]*?Never skipped: ([^.]+)\./m)?.[1]), neverSkipOf('change', 'internal')));
  check('drift: change-profile.md visible never-skip list matches lanes.mjs', ['ui-only', 'ui+logic', 'logic-only'].every((s) => same(ids(change.match(/\*\*Never skipped:\*\* ([^\n]+)/)?.[1]), neverSkipOf('change', s))));
  check('drift: change-profile.md internal skip list matches lanes.mjs', same(ids(change.match(/^Internal: Skipped: ([^\n]+?)\. Never/m)?.[1]), skipsOf('change', 'internal').filter((s) => s !== '2b')));
  check('drift: change-profile.md Steps by scope marks 3b/3e skipped exactly for the scopes lanes.mjs skips them', ['internal', 'ui-only', 'ui+logic', 'logic-only'].every((s, i) => /skipped/.test(change.match(/^\| 3b, 3e \|[^\n]*$/m)?.[0].split('|').slice(1, -1)[i + 2] ?? '') === skipsOf('change', s).includes('3b')));
  check('docs: resume reads every lane from the lane line', /change-profile\.md/.test(ref('resume.md')) && ref('resume.md').includes('lane:'));
  /* a stop point on the lane line (diagnose only: fix --until 4b) */
  const stopLine = formatRunProfile('fix', { scope: 'bug', until: '4b' });
  check('until: the lane line carries the stop and reads it back, apart from the skips', parseRunProfile(CP(stopLine)).until === '4b' && !parseRunProfile(CP(stopLine)).skipped.includes('4b') && parseRunProfile(CP(formatRunProfile('fix'))).until === null);
  let badUntil = '';
  try { formatRunProfile('fix', { until: '3' }); } catch (e) { badUntil = e.message; }
  check('until: a step the lane skips cannot be its stop', /not a step this lane runs/.test(badUntil), badUntil);
  check('until: the guard refuses a dev spawn past the stop, even with a confirmed audit', /stops at step 4b/.test(auditMissing(CP(stopLine), 'backend-dev', step4, [{ step: '4b', round: 1, audit: { verdict: 'confirm' } }]) ?? ''));

  /* the fix lane's scope: a cosmetic fix skips the 4b audit, a bug never does */
  check('fix scope: cosmetic skips 4b and still runs 4a; bug and a missing or unknown scope run both', skipsOf('fix', 'cosmetic').includes('4b') && neverSkipOf('fix', 'cosmetic').includes('4a') && !neverSkipOf('fix', 'cosmetic').includes('4b') && ['bug', null, 'bogus'].every((s) => neverSkipOf('fix', s).includes('4b') && !skipsOf('fix', s).includes('4b')));
  const cosLine = formatRunProfile('fix', { scope: 'cosmetic' });
  check('fix scope: the audit guard lets a cosmetic dev start with no 4b, and still holds a bug', auditMissing(CP(cosLine), 'backend-dev', step4, []) === null && auditMissing(CP(formatRunProfile('fix', { scope: 'bug' })), 'backend-dev', step4, []) !== null && auditMissing(CP('lane: fix · skipped 1'), 'backend-dev', step4, []) !== null);
  check('drift: fix-profile.md cosmetic never-skip list matches lanes.mjs', same(ids(ref('fix-profile.md').match(/Never skipped for cosmetic: ([^.]+)\./)?.[1]), neverSkipOf('fix', 'cosmetic')));
  check('docs: fix-profile.md writes the fix scope with the profile command', ref('fix-profile.md').includes('checkpoint.mjs" profile .team/<task> fix --scope <bug | cosmetic>'));

  /* promote_to: the debugger names the smallest lane that fits */
  const hs = JSON.parse(readFileSync(join(root, 'skills/muffy/schemas/handoff.schema.json'), 'utf8'));
  const dx = (diagnosis) => ({ role: 'debugger', task: 't', step: '4a', round: 1, status: 'done', paths_written: ['x'], blockers: [], quality_checks: { passed: true, failed: [] }, summary: 'diagnosed', diagnosis });
  check('promote_to: the schema and the loop agree on the targets', JSON.stringify(hs.properties.diagnosis.properties.promote_to.enum) === JSON.stringify(Object.keys(PROMOTE_ACTION)));
  check('promote_to: a needs-full-flow diagnosis may name it, and only a known target', validate(hs, dx({ status: 'needs-full-flow', confidence: 'high', reason: 'a visible rounding rule', promote_to: 'change-visible' })).length === 0 && validate(hs, dx({ status: 'needs-full-flow', confidence: 'high', reason: 'a visible rounding rule', promote_to: 'lite' })).length > 0);
  check('docs: fix-profile.md says what each promote_to target does, with the profile command', ['change-internal', 'change-visible', 'full'].every((t) => ref('fix-profile.md').includes(`\`${t}\``)) && ref('fix-profile.md').includes('checkpoint.mjs profile .team/<task> change --scope internal'));
  check('docs: run-profile.md has the promotion ladder, up and one rung down', /^## Promotion ladder$/m.test(ref('run-profile.md')) && ref('run-profile.md').includes('one rung down'));
  check('docs: the debugger is told to set promote_to', readFileSync(join(root, 'agent-references/debugger/output-format.md'), 'utf8').includes('promote_to'));
  check('docs: an internal change that turns visible moves to a visible scope, not the full flow', /\*\*a visible scope\*\*/.test(ref('change-profile.md')));
  check('docs: the old lane references point at the change lane', ['lite-profile.md', 'redesign-profile.md'].every((f) => ref(f).includes('[change-profile.md](change-profile.md)')));
}
