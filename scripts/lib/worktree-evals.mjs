// Offline checks for remove-worktrees.mjs and the check-all `worktrees` check, on a real temp git repo:
// what is removed, what is kept and why, and that branches and work survive.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function runWorktreeEvals({ check, root }) {
  const { checkAll } = await import('../../skills/muffy/scripts/check-all.mjs');
  const script = join(root, 'skills/muffy/scripts/remove-worktrees.mjs');
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'muffy-wt-')));
  const git = (...a) => spawnSync('git', ['-C', tmp, ...a], { encoding: 'utf8' });
  const run = (...a) => spawnSync(process.execPath, [script, ...a, '--cwd', tmp], { encoding: 'utf8' });
  const wt = (name) => join(tmp, '.worktrees', name);
  const add = (name, branch, from = 'main') => git('worktree', 'add', `.worktrees/${name}`, '-b', branch, from);
  const hasBranch = (b) => git('rev-parse', '--verify', '--quiet', `refs/heads/${b}`).status === 0;
  const listed = (name) => git('worktree', 'list', '--porcelain').stdout.includes(`/.worktrees/${name}`);

  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'eval@example.com');
    git('config', 'user.name', 'eval');
    writeFileSync(join(tmp, '.gitignore'), '.worktrees/\n.pr-lens/\n');
    git('add', '.');
    git('commit', '-qm', 'init');

    // clean role worktrees go, the feature worktree stays at the roles stage, a gitignored file does not block
    add('feature-t', 'feature/t');
    add('fe-t', 'fe/t', 'feature/t');
    add('qa-t', 'qa/t', 'feature/t');
    mkdirSync(join(wt('fe-t'), '.pr-lens'));
    writeFileSync(join(wt('fe-t'), '.pr-lens', 'graph.json'), '{}');
    writeFileSync(join(wt('qa-t'), 'a.test.js'), 'x');
    spawnSync('git', ['-C', wt('qa-t'), 'add', '.'], { encoding: 'utf8' });
    spawnSync('git', ['-C', wt('qa-t'), 'commit', '-qm', 'tests'], { encoding: 'utf8' });

    let before = git('worktree', 'list').stdout;
    let r = run('t', '--stage', 'roles', '--check');
    check('remove-worktrees: --check lists what remains, exits 1 and changes nothing', r.status === 1 && r.stdout.includes('.worktrees/fe-t') && !r.stdout.includes('feature-t') && git('worktree', 'list').stdout === before, r.stdout + r.stderr);

    const td = join(wt('feature-t'), '.team', 't');
    mkdirSync(td, { recursive: true });
    const failing = (x) => x.results.filter(([, e]) => e.length).map(([n]) => n);
    const left = checkAll(td, { step: '11', round: 1 });
    check('check-all: a role worktree left at step 11 fails the worktrees check', failing(left).includes('worktrees'), JSON.stringify(left.results));
    check('check-all: send-back names only agent checks, never worktrees', !left.next.includes('worktrees'), left.next);
    rmSync(join(wt('feature-t'), '.team'), { recursive: true });

    // every other check passes: the only thing left to do is the Orchestrator's removal
    add('feature-login-flow', 'feature/login-flow');
    add('fe-login-flow', 'fe/login-flow', 'feature/login-flow');
    const lf = join(wt('feature-login-flow'), '.team', 'login-flow');
    cpSync(join(root, 'evals/fixtures/login-flow/.team/login-flow'), lf, { recursive: true });
    writeFileSync(join(lf, 'handoff', '11-docs-writer-r1.json'), JSON.stringify({ role: 'docs-writer', task: 'login-flow', step: '11', round: 1, status: 'done', paths_written: ['docs/x.md'], blockers: [], decisions: [{ id: 'D-1', decision: 'docs', why: 'eval' }], quality_checks: { passed: true, failed: [] }, summary: 'docs' }));
    const only = checkAll(lf, { step: '11', round: 1 });
    check('check-all: a leftover worktree alone gives next=remove:worktrees', only.next === 'remove:worktrees' && !only.ok, `${only.next} ${JSON.stringify(only.results.filter(([, e]) => e.length))}`);
    rmSync(lf, { recursive: true, force: true });
    run('login-flow', '--stage', 'all');

    r = run('t', '--stage', 'roles');
    check('remove-worktrees: clean role worktrees are removed, exit 0', r.status === 0 && !existsSync(wt('fe-t')) && !existsSync(wt('qa-t')), r.stdout + r.stderr);
    check('remove-worktrees: a gitignored .pr-lens/ does not block removal', !existsSync(join(wt('fe-t'), '.pr-lens')));
    check('remove-worktrees: the roles stage leaves the feature worktree', existsSync(wt('feature-t')));
    check('remove-worktrees: branches stay', hasBranch('fe/t') && hasBranch('qa/t') && hasBranch('feature/t'));
    check('remove-worktrees: an unmerged role branch is reported, a merged one is not', r.stdout.includes('unmerged: qa/t') && !r.stdout.includes('unmerged: fe/t'), r.stdout);
    check('remove-worktrees: a role with no worktree is skipped', r.stdout.includes('.worktrees/be-t') && /skipped=[^ ]*be-t/.test(r.stdout), r.stdout);

    mkdirSync(td, { recursive: true });
    const gone = checkAll(td, { step: '11', round: 1 });
    check('check-all: no role worktree left passes the worktrees check', !failing(gone).includes('worktrees'), JSON.stringify(gone.results));
    rmSync(join(wt('feature-t'), '.team'), { recursive: true });

    r = run('t', '--stage', 'all');
    check('remove-worktrees: the all stage removes the feature worktree', r.status === 0 && !existsSync(wt('feature-t')), r.stdout + r.stderr);
    r = run('t', '--stage', 'all');
    check('remove-worktrees: running again with nothing there is a clean no-op', r.status === 0 && /removed= /.test(r.stdout), r.stdout + r.stderr);
    r = run('t', '--stage', 'all', '--check');
    check('remove-worktrees: --check is clean once everything is gone', r.status === 0 && r.stdout.trim() === 'remaining=', r.stdout);

    // dirty: kept, nothing lost
    add('be-d', 'be/d');
    writeFileSync(join(wt('be-d'), 'wip.txt'), 'wip');
    r = run('d', '--stage', 'roles');
    check('remove-worktrees: a dirty worktree is kept, exit 1', r.status === 1 && r.stdout.includes('.worktrees/be-d:dirty') && existsSync(join(wt('be-d'), 'wip.txt')), r.stdout + r.stderr);

    // a commit on a detached HEAD that no branch holds: kept
    git('worktree', 'add', '--detach', '.worktrees/qa-h', 'main');
    writeFileSync(join(wt('qa-h'), 'b.test.js'), 'x');
    spawnSync('git', ['-C', wt('qa-h'), 'add', '.'], { encoding: 'utf8' });
    spawnSync('git', ['-C', wt('qa-h'), 'commit', '-qm', 'orphan'], { encoding: 'utf8' });
    r = run('h', '--stage', 'roles');
    check('remove-worktrees: a detached HEAD with an unreachable commit is kept', r.status === 1 && r.stdout.includes('.worktrees/qa-h:unreachable') && existsSync(wt('qa-h')), r.stdout + r.stderr);

    // deleted by hand: the stale entry is pruned
    add('ops-s', 'ops/s');
    rmSync(wt('ops-s'), { recursive: true, force: true });
    r = run('s', '--stage', 'roles');
    check('remove-worktrees: a folder deleted by hand is skipped and its stale entry pruned', r.status === 0 && !listed('ops-s'), r.stdout + r.stderr);

    // a leftover folder git does not list is not reported as done
    mkdirSync(wt('fe-u'), { recursive: true });
    r = run('u', '--stage', 'roles');
    check('remove-worktrees: a folder git does not list is kept as unregistered', r.status === 1 && r.stdout.includes('.worktrees/fe-u:unregistered'), r.stdout + r.stderr);

    // the verify lane's worktree is named feature-<task> on verify/<task>
    add('feature-v', 'verify/v');
    r = run('v', '--stage', 'all');
    check('remove-worktrees: a worktree is matched by path, so verify/<task> is removed too', r.status === 0 && !existsSync(wt('feature-v')) && hasBranch('verify/v'), r.stdout + r.stderr);

    check('remove-worktrees: a bad task name or stage is a usage error', run('../x', '--stage', 'all').status === 2 && run('t', '--stage', 'nope').status === 2 && run('t').status === 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
