// Offline checks for the lane table (skills/muffy/scripts/lanes.mjs):
//   - every lane and scope round-trips through the Run profile line, and the older wordings still parse
//   - the lines the references used to prescribe (`fix: skipped …`, `lite: skipped …`) are read as their lane, so the
//     gate guard and the 4b audit guard act on them (they were read as the feature lane before)
//   - check-all reads gates with gateState: `gate 3c not passed` is not a pass
//   - checkpoint.mjs profile replaces the lane line and keeps the others; make-envelope carries Scope:
//   - each lane reference names the profile command and states the never-skip list the table holds
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { LANES, SCOPES, STEP_ORDER, skipsOf, neverSkipOf, formatRunProfile, parseRunProfile, isLaneLine } from '../../skills/muffy/scripts/lanes.mjs';
import { laneOf, redesignScope, missingGates, auditMissing } from '../../skills/muffy/scripts/gate-rules.mjs';
import { setProfile } from '../../skills/muffy/scripts/checkpoint.mjs';
import { checkAll } from '../../skills/muffy/scripts/check-all.mjs';

const CP = (profile, status = '- stage: x') =>
  `# Checkpoint: t\n\nUpdated: step 3\n\n## Goal\n\nx\n\n## Run profile\n\n${profile}\n\n## Status\n\n${status}\n`;

export function runLaneTableEvals({ check, root }) {
  const ref = (f) => readFileSync(join(root, 'skills/muffy/references', f), 'utf8').replace(/\r\n/g, '\n');

  /* the table */
  check('lanes: every skipped step is a step id', Object.values(LANES).every((l) => [l.skips, ...Object.values(l.scopes ?? {}).map((s) => s.skips)].flat().every((s) => STEP_ORDER.includes(s))));
  check('lanes: no lane skips a step it must run', Object.keys(LANES).every((l) => [undefined, ...SCOPES].every((sc) => !skipsOf(l, sc).some((s) => neverSkipOf(l).includes(s)))));
  check('lanes: the redesign lane has a skip list per scope', SCOPES.every((s) => LANES.redesign.scopes[s]));
  check('lanes: steps 8 and 9 are gone', !STEP_ORDER.includes('8') && !STEP_ORDER.includes('9'));

  /* the Run profile line */
  const pairs = [...Object.keys(LANES).filter((l) => l !== 'redesign').map((l) => [l, null]), ...SCOPES.map((s) => ['redesign', s])];
  for (const [lane, scope] of pairs) {
    const line = formatRunProfile(lane, { scope: scope ?? undefined });
    const back = parseRunProfile(CP(line));
    check(`lanes: "${line}" reads back as ${lane}${scope ? ` (${scope})` : ''}`, back.lane === lane && back.scope === scope, JSON.stringify(back));
  }
  check('lanes: a run skip is merged in step order, a role is kept as written', formatRunProfile('redesign', { scope: 'ui-only', skip: ['3d', 'architect'] }) === 'lane: redesign (ui-only) · skipped 1, 2b, 3d, architect');
  let refused = '';
  try { formatRunProfile('redesign'); } catch (e) { refused = e.message; }
  check('lanes: a redesign line without a scope is refused', /needs a scope/.test(refused), refused);

  const legacy = [
    ['fix: skipped 1, 2, 3, 3b, 3c, 3d', 'fix', null],
    ['lite: skipped 1, 2, 3b, 3c', 'lite', null],
    ['redesign lane (ui+logic): skipped 1', 'redesign', 'ui+logic'],
    ['fix lane: skipped 1, 2, 3, 3b, 3c, 3d, 8', 'fix', null],
    ['Fix lane.', 'fix', null],
    ['Full flow, feature lane.', 'feature', null],
    ['Full run; nothing skipped.', 'feature', null],
  ];
  for (const [line, lane, scope] of legacy) {
    check(`lanes: older line "${line}" still reads as ${lane}`, laneOf(CP(line)) === lane && redesignScope(CP(line)) === scope);
  }
  check('lanes: the skipped steps on the lane line are read back, roles and removed steps dropped', JSON.stringify(parseRunProfile(CP('redesign lane (ui-only): skipped 1, 2b, architect, 3d')).skipped) === '["1","2b","3d"]' && JSON.stringify(parseRunProfile(CP('fix lane: skipped 1, 3d, 8')).skipped) === '["1","3d"]');

  /* the guards act on the lines the references prescribed */
  const fixLine = 'fix: skipped 1, 2, 3, 3b, 3c, 3d';
  const step4 = 'Task: t\nWrite: .worktrees/feature-t/.team/t/handoff/4-backend-dev-r1.json\n';
  check('lanes: a fix-lane dev waits on no plan or design gate', missingGates(CP(fixLine), 'backend-dev', step4).length === 0);
  check('lanes: a lite-lane architect waits on no gate', missingGates(CP('lite: skipped 1, 2, 3b, 3c'), 'architect', '').length === 0);
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
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const env = spawnSync(process.execPath, [join(root, 'skills/muffy/scripts/make-envelope.mjs'), '--role', 'designer', '--step', '3', '--task', 't', '--brain', '.team/brain', '--goal', 'Redesign the login page', '--read', 'ac.md', '--write', 'design.md', '--scope', 'ui-only'], { encoding: 'utf8' });
  check('make-envelope: --scope puts Scope: in the header', env.status === 0 && /^Task: t .*Scope: ui-only/m.test(env.stdout), env.stderr);

  /* the references name the command and the lists the table holds */
  for (const [f, cmd] of [['setup.md', 'feature'], ['fix-profile.md', 'fix'], ['lite-profile.md', 'lite'], ['redesign-profile.md', 'redesign --scope']]) {
    check(`docs: ${f} writes the lane line with checkpoint.mjs profile`, ref(f).includes(`checkpoint.mjs profile .team/<task> ${cmd}`));
  }
  // a promotion switches the lane with the command too: a hand-written "promoted from the fix lane" still reads as fix
  for (const f of ['fix-profile.md', 'lite-profile.md']) {
    const doc = ref(f);
    check(`docs: ${f} switches a promoted run with checkpoint.mjs profile … feature`, doc.includes('checkpoint.mjs profile .team/<task> feature') && !/rename the profile|change `## Run profile`/.test(doc));
  }
  const ids = (text) => [...new Set((text ?? '').match(/\b\d+[a-z]?\b/g) ?? [])].filter((s) => STEP_ORDER.includes(s));
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  check('drift: fix-profile.md never-skip list matches lanes.mjs', same(ids(ref('fix-profile.md').match(/^Never skipped: ([^.]+)\./m)?.[1]), neverSkipOf('fix')));
  check('drift: lite-profile.md never-skip list matches lanes.mjs', same(ids(ref('lite-profile.md').match(/Never skipped: ([^.]+)\./)?.[1]), neverSkipOf('lite')));
  check('drift: redesign-profile.md never-skip list matches lanes.mjs', same(ids(ref('redesign-profile.md').match(/\*\*Never skipped:\*\* ([^\n]+)/)?.[1]), neverSkipOf('redesign')));
  check('drift: lite-profile.md skip list matches lanes.mjs', same(ids(ref('lite-profile.md').match(/^Skipped: ([^\n]+?)\. Never/m)?.[1]), skipsOf('lite').filter((s) => s !== '2b')));
  check('docs: resume reads every lane from the lane line', /redesign-profile\.md/.test(ref('resume.md')) && ref('resume.md').includes('lane:'));
}
