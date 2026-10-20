// Offline checks for file ownership (contract/ownership.md, references/steps.md step 5):
//   - the table: one owner per row, no overlapping patterns across owners (check-artifacts)
//   - check-ownership.mjs on a throwaway repo: out-of-lane and both-branch edits fail, clean branches pass
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { validate } from '../../skills/muffy/scripts/schema.mjs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseOwnership, ownershipErrors, globRe } from '../../skills/muffy/scripts/ownership.mjs';

export function runOwnershipEvals({ check, root }) {
  const table = (rows) => `# File ownership\n\n| File | Owner |\n|---|---|\n${rows.map(([p, o]) => `| ${p} | ${o} |`).join('\n')}\n`;
  const errs = (rows) => ownershipErrors(parseOwnership(table(rows)));

  check('ownership: globs match files and folders as written', globRe('src/**').test('src/a/b.ts') && globRe('src/**/*.ts').test('src/a.ts') && globRe('src/auth').test('src/auth/x.ts') && !globRe('src/auth').test('src/authz.ts') && !globRe('src/*.ts').test('src/a/b.ts'));
  check('ownership: disjoint rows with one owner each pass', errs([['src/auth/**', 'BE'], ['`src/ui/**`', 'FE'], ['Dockerfile', 'devops']]).length === 0);
  check('ownership: a row owned by both, or by an unknown role, fails', errs([['src/types.ts', 'FE+BE']]).length === 1 && errs([['src/types.ts', 'both']]).length === 1);
  const overlap = errs([['src/**', 'BE'], ['src/ui/Login.tsx', 'FE']]);
  check('ownership: overlapping patterns with different owners fail', overlap.length === 1 && overlap[0].includes('overlap'), overlap.join('; '));
  check('ownership: overlapping patterns with the same owner pass', errs([['src/**', 'BE'], ['src/db/**', 'BE']]).length === 0);

  /* check-ownership.mjs against real branches */
  const repo = mkdtempSync(join(tmpdir(), 'muffy-ownership-'));
  const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  const put = (file, text = 'x\n') => { mkdirSync(dirname(join(repo, file)), { recursive: true }); writeFileSync(join(repo, file), text); };
  const commit = (msg) => { git('add', '-A'); git('commit', '-qm', msg); };
  const run = () => spawnSync(process.execPath, [join(root, 'skills/muffy/scripts/check-ownership.mjs'), join(repo, '.team/t1')], { encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t.t'); git('config', 'user.name', 't'); git('config', 'core.autocrlf', 'false');
    put('src/api/a.ts'); put('src/ui/A.tsx'); commit('init');
    git('checkout', '-qb', 'feature/t1');
    put('.team/t1/contract/ownership.md', table([['src/api/**', 'BE'], ['src/ui/**', 'FE'], ['Dockerfile', 'devops']])); commit('plan');
    git('checkout', '-qb', 'fe/t1'); put('src/ui/A.tsx', 'fe\n'); put('src/ui/A.test.tsx'); commit('fe');
    git('checkout', '-q', 'feature/t1'); git('checkout', '-qb', 'be/t1'); put('src/api/a.ts', 'be\n'); put('src/api/new.ts'); commit('be');
    git('checkout', '-q', 'feature/t1');
    const ok = run();
    check('check-ownership: each branch inside its own rows passes', ok.status === 0, ok.stderr + ok.stdout);

    // contract_commit: step-4 hand-offs must name the contract version feature/t1 holds now
    const contractSha = git('log', '-1', '--format=%h', 'feature/t1', '--', '.team/t1/contract.md', '.team/t1/contract').stdout.trim();
    const handoff = (role, round, extra) => put(`.team/t1/handoff/4-${role}-r${round}.json`, JSON.stringify({ role, task: 't1', step: '4', round, status: 'done', paths_written: [], blockers: [], quality_checks: { passed: true, failed: [] }, summary: 'one line', ac_ids_done: [], ...extra }));
    handoff('frontend-dev', 1, { contract_commit: contractSha }); handoff('backend-dev', 1, { contract_commit: contractSha });
    const current = run();
    put('.team/t1/contract/ownership.md', table([['src/api/**', 'BE'], ['src/ui/**', 'FE'], ['Dockerfile', 'devops'], ['migrations/**', 'BE']])); commit('contract change');
    const stale = run();
    handoff('backend-dev', 2, { contract_commit: git('rev-parse', '--short', 'HEAD').stdout.trim() });
    const oneStale = run();
    handoff('frontend-dev', 2, {});
    const missing = run();
    check('check-ownership: hand-offs built against the current contract pass', current.status === 0, current.stderr);
    check('check-ownership: a contract commit after the hand-offs fails both as stale-contract', stale.status === 1 && (stale.stderr.match(/stale-contract/g) ?? []).length === 2, stale.stderr);
    check('check-ownership: only the latest round counts; a re-read backend passes, the stale frontend still fails', oneStale.status === 1 && /stale-contract: 4-frontend-dev-r1/.test(oneStale.stderr) && !/backend-dev/.test(oneStale.stderr), oneStale.stderr);
    check('check-ownership: a hand-off with no contract_commit is a note, not a failure', missing.status === 0 && /4-frontend-dev-r2\.json has no contract_commit/.test(missing.stdout), missing.stderr + missing.stdout);
    rmSync(join(repo, '.team/t1/handoff'), { recursive: true, force: true }); commit('drop hand-offs');
    const schema = JSON.parse(readFileSync(join(root, 'skills/muffy/schemas/handoff.schema.json'), 'utf8'));
    check('handoff schema: contract_commit takes a 7-40 char hex sha only', validate(schema, { role: 'backend-dev', task: 't1', step: '4', round: 1, status: 'done', paths_written: [], blockers: [], quality_checks: { passed: true, failed: [] }, summary: 'one line', ac_ids_done: [], contract_commit: 'abc1234' }).length === 0 && validate(schema, { role: 'backend-dev', task: 't1', step: '4', round: 1, status: 'done', paths_written: [], blockers: [], quality_checks: { passed: true, failed: [] }, summary: 'one line', ac_ids_done: [], contract_commit: 'latest' }).length > 0);

    git('checkout', '-q', 'fe/t1'); put('src/api/a.ts', 'fe touched it\n'); put('src/lib/util.ts'); commit('fe out of lane');
    git('checkout', '-q', 'feature/t1');
    const bad = run();
    check('check-ownership: fe changing a BE file fails as out-of-lane and both', bad.status === 1 && /out-of-lane: fe\/t1 changed src\/api\/a\.ts/.test(bad.stderr) && /both: src\/api\/a\.ts/.test(bad.stderr), bad.stderr);
    check('check-ownership: an unowned file is a note, not a failure on its own', /unowned: src\/lib\/util\.ts/.test(bad.stdout));

    git('checkout', '-q', 'fe/t1'); git('reset', '-q', '--hard', 'HEAD~1'); git('checkout', '-q', 'feature/t1');
    git('checkout', '-qb', 'ops/t1'); put('Dockerfile', 'FROM node:22\n'); commit('ops');
    git('checkout', '-q', 'feature/t1');
    // fe and be were cut from feature here, so with ops present their diffs against ops include ops' Dockerfile only through the merge-base; they stay clean
    const withOps = run();
    check('check-ownership: an ops branch is checked against devops rows; fe/be stay clean', withOps.status === 0, withOps.stderr + withOps.stdout);

    rmSync(join(repo, '.team/t1/contract'), { recursive: true, force: true }); commit('no table');
    const noTable = run();
    check('check-ownership: with no ownership table (fix lane) it still runs and passes clean branches', noTable.status === 0 && /no contract\/ownership\.md/.test(noTable.stdout), noTable.stderr + noTable.stdout);
    check('check-ownership: a task with no feature branch is a usage error', spawnSync(process.execPath, [join(root, 'skills/muffy/scripts/check-ownership.mjs'), join(repo, '.team/nope')], { encoding: 'utf8' }).status === 2);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}
