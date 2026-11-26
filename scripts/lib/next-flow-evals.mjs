// Offline checks for the change, verify, upgrade and full-flow lanes of next.mjs (next-flow.mjs): real temp git repos, the agents
// and the user played by this file. For every lane: the same actions twice, nothing written before the scope is approved, each human
// gate asks and its answers lead where they should, a bad hand-off is retried once and then stops, a reviewer Reject goes back to the
// owners, a headless run waits at a gate and resumes after the answer, and the user's own branches never move.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, appendFileSync, realpathSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const slash = (p) => p.split('\\').join('/');

export async function runNextFlowEvals({ check, root }) {
  const { buildRepo, CASES } = await import(pathToFileURL(join(root, 'scripts', 'measure-fix.mjs')).href);
  const NEXT = join(root, 'skills/muffy/scripts/next.mjs');
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'muffy-flow-')));
  const git = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  const baseEnv = { ...process.env };
  delete baseEnv.SECOND_BRAIN_VAULT;
  for (const k of Object.keys(baseEnv)) if (k.startsWith('MUFFY_')) delete baseEnv[k];

  // one temp repo with the bench fixture; `task` names the lane's task; the agents' files are written by the helpers below
  const world = (name, { headless = false, task = 'verify-item-count' } = {}) => {
    const repo = slash(join(base, name));
    buildRepo(repo, CASES[0]);
    git(repo, 'config', 'core.autocrlf', 'false');
    const env = { ...baseEnv, ...(headless ? { MUFFY_HEADLESS: '1' } : {}) };
    const log = [];
    const run = (args, input) => {
      const r = spawnSync(process.execPath, [NEXT, ...args], { cwd: repo, env, encoding: 'utf8', input });
      const spawns = [...r.stdout.matchAll(/^action=spawn\nrole=(\S+)\nstep=(\S+)\nround=(\S+)/gm)].map((m) => `${m[1]}:${m[2]}:r${m[3]}`);
      const action = r.stdout.match(/^action=(\S+)/m)?.[1] ?? null;
      const res = { status: r.status, out: r.stdout, err: r.stderr, action, spawns, prompts: [...r.stdout.matchAll(/---prompt---\n([\s\S]*?)\n---prompt---/g)].map((m) => m[1]), gate: r.stdout.match(/^gate=(\S+)/m)?.[1] };
      log.push(`${args[0]}:${action}${spawns.length ? `:${spawns.join('+')}` : ''}${res.gate ? `:${res.gate}` : ''}`);
      return res;
    };
    const feature = `${repo}/.worktrees/feature-${task}`;
    const team = `${feature}/.team/${task}`;
    const q = { task, status: 'done', paths_written: [], blockers: [], quality_checks: { passed: true, failed: [] } };
    const ho = (file, o) => writeFileSync(`${team}/handoff/${file}`, JSON.stringify({ ...q, ...o }));
    const answerLine = (gate, answer) => appendFileSync(`${team}/checkpoint.md`.replace('checkpoint.md', 'checkpoint.md'), '');
    const status = (line) => {
      const f = `${team}/checkpoint.md`;
      writeFileSync(f, readFileSync(f, 'utf8').replace(/^(## Status\n)/m, `$1${line}\n`));
    };
    const reviewMsg = (verdict, round = 1, blockers = []) => `Verdict: ${verdict}\n\nReviewed.\n${JSON.stringify({ ...q, role: 'code-reviewer', step: '6', round, verdict, blockers, summary: verdict.toLowerCase() })}\n`;
    void answerLine;
    return { repo, env, run, log, feature, team, ho, status, reviewMsg, git: (...a) => git(repo, ...a), task, q };
  };

  try {
    /* ---------- verify ---------- */
    const V = 'verify-item-count';
    const verifyWorld = (name, opts = {}) => {
      const w = world(name, { ...opts, task: V });
      // the requester's branch: one commit on top of main that fixes the bug
      w.git('switch', '-q', '-c', 'their-fix');
      writeFileSync(`${w.repo}/cart.js`, readFileSync(`${w.repo}/cart.js`, 'utf8').replace('return items.length;', 'return items.reduce((s, i) => s + i.qty, 0);'));
      w.git('commit', '-qam', 'fix itemCount');
      w.git('switch', '-q', 'main');
      w.theirSha = w.git('rev-parse', 'their-fix');
      w.mainSha = w.git('rev-parse', 'main');
      w.start = ['start', '--lane', 'verify', '--task', V, '--branch', 'their-fix', '--base', 'main', '--request', 'Review and test their-fix before I merge it', '--ac', 'AC-1 | itemCount sums the qty of every item | test/cart.test.js', '--trailer', 'Co-Authored-By: Eval <eval@example.test>'];
      return w;
    };

    // interactive: nothing is written before the scope is approved; the lane is review, test gate, Human gate, close
    const vi = verifyWorld('verify-i');
    const asked = vi.run(vi.start);
    check('flow verify: interactive start asks the scope question and writes nothing', asked.action === 'ask' && asked.gate === 'scope' && !existsSync(join(vi.repo, '.worktrees')) && !existsSync(join(vi.repo, '.team')) && !vi.git('branch', '--list', 'verify/*'), asked.out.slice(0, 300));
    const go = vi.run([...vi.start, '--approved']);
    const descends = (r, a, b) => { try { r.git('merge-base', '--is-ancestor', a, b); return true; } catch { return false; } };
    check('flow verify: --approved starts with the code-reviewer on a copy of their branch (no dev, no designer)', go.spawns.join() === 'code-reviewer:6:r1' && descends(vi, vi.theirSha, `verify/${V}`) && vi.git('rev-parse', 'their-fix') === vi.theirSha, go.out.slice(0, 400));
    const rv = vi.run(['review', V], vi.reviewMsg('Approve'));
    check('flow verify: an Approve runs the test gate on a qa copy and asks the Human gate', rv.action === 'ask' && rv.gate === 'human-gate' && existsSync(join(vi.repo, '.worktrees', `qa-${V}`)), rv.out.slice(0, 500));
    const fin = vi.run(['answer', V, 'Approve']);
    check('flow verify: Approve closes the task; the docs step is skipped when the diff touches no migration, config or doc', fin.action === 'done' && !existsSync(vi.feature), fin.out.slice(0, 500));
    check('flow verify: the requester\'s branch and main never moved, and nothing was merged or pushed', vi.git('rev-parse', 'their-fix') === vi.theirSha && vi.git('rev-parse', 'main') === vi.mainSha && vi.git('remote').length === 0 && vi.git('branch', '--contains', `verify/${V}`).includes('verify/'), `${vi.git('rev-parse', 'their-fix')} vs ${vi.theirSha}`);
    check('flow verify: the copy and its report stay on verify/<task> for the requester', /closed/.test(vi.git('show', `verify/${V}:.team/${V}/checkpoint.md`)) && vi.git('show', `verify/${V}:.team/${V}/qa-report.md`).length > 0);

    // the same run twice gives the same actions
    const v2 = verifyWorld('verify-i2');
    v2.run(v2.start); v2.run([...v2.start, '--approved']); v2.run(['review', V], v2.reviewMsg('Approve')); v2.run(['answer', V, 'Approve']);
    check('flow verify: the same run twice gives the same actions', v2.log.join(' ') === vi.log.join(' '), `${v2.log.join(' ')} != ${vi.log.join(' ')}`);

    // headless: the scope question waits (gate.json), an answer line resumes, the Human gate waits again
    const vh = verifyWorld('verify-h', { headless: true });
    const w1 = vh.run(vh.start);
    check('flow verify: headless start waits at pause:scope with gate.json and a muffy-status line', w1.action === 'stop' && /muffy-status: waiting:scope/.test(w1.out) && existsSync(`${vh.team}/gate.json`), w1.out.slice(0, 500));
    const still = vh.run(['step', V]);
    check('flow verify: with no answer yet, step stays stopped and does not ask or answer itself', still.action === 'stop' && /waiting:scope/.test(still.out), still.out.slice(0, 300));
    vh.status(`- scope answered: go (recommended) | Confirm | Confirm by eval (test) ${new Date().toISOString()}`);
    const r1 = vh.run(['step', V]);
    check('flow verify: the recorded answer resumes the lane with the reviewer', r1.spawns.join() === 'code-reviewer:6:r1' && !existsSync(`${vh.team}/gate.json`), r1.out.slice(0, 500));
    const g1 = vh.run(['review', V], vh.reviewMsg('Approve'));
    check('flow verify: headless never passes the Human gate itself: it waits for a person', g1.action === 'stop' && /waiting:human-gate/.test(g1.out), g1.out.slice(0, 500));
    vh.status(`- human-gate answered: Approve by eval (test) ${new Date().toISOString()}`);
    const d1 = vh.run(['step', V]);
    check('flow verify: the person\'s Approve closes the task', d1.action === 'done', d1.out.slice(0, 500));

    // a reviewer Reject asks (verify never fixes on its own); report only ends the run, fix on the copy sends the owners
    const vr = verifyWorld('verify-r');
    vr.run(vr.start); vr.run([...vr.start, '--approved']);
    const rj = vr.run(['review', V], vr.reviewMsg('Reject', 1, [{ id: 'B-1', problem: 'no empty-cart test', file: 'test/cart.test.js:1', owner: 'BE' }]));
    check('flow verify: a reviewer Reject asks fix-on-copy or report-only', rj.action === 'ask' && rj.gate === 'verify-fix', rj.out.slice(0, 400));
    const rep = vr.run(['answer', V, 'Report only']);
    check('flow verify: report only ends the run with the findings and starts no dev', rep.action === 'stop' && /reported/.test(rep.out) && !existsSync(join(vr.repo, '.worktrees', `be-${V}`)), rep.out.slice(0, 300));
    const vf = verifyWorld('verify-f');
    vf.run(vf.start); vf.run([...vf.start, '--approved']);
    vf.run(['review', V], vf.reviewMsg('Reject', 1, [{ id: 'B-1', problem: 'no empty-cart test', file: 'test/cart.test.js:1', owner: 'BE' }]));
    const fx = vf.run(['answer', V, 'Fix on the copy']);
    check('flow verify: fix on the copy sends the owner the blocker on a worktree cut from the copy, never from their branch', fx.spawns.join() === 'backend-dev:4:r2' && /\.worktrees\/be-/.test(fx.prompts[0] ?? '') && descends(vf, `be/${V}`, `verify/${V}`) && descends(vf, vf.theirSha, `be/${V}`) && vf.git('rev-parse', 'their-fix') === vf.theirSha, fx.out.slice(0, 500));

    // after a reviewer Reject the docs-writer reads the diff of the last round, never diff-1 (closing used to hard-code it)
    const { latestDiff } = await import(pathToFileURL(NEXT).href);
    const dd = join(base, 'latest-diff');
    mkdirSync(dd, { recursive: true });
    for (const n of [1, 2, 10]) writeFileSync(join(dd, `diff-${n}.patch`), 'x');
    check('next: the docs-writer reads the diff of the last review round, not diff-1', latestDiff({ team: dd }).endsWith('/diff-10.patch') && latestDiff({ team: join(base, 'none') }).endsWith('/diff-1.patch'), latestDiff({ team: dd }));

    /* ---------- the lanes that follow are added below ---------- */
    void mkdirSync;
  } finally {
    try { rmSync(base, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Windows may still hold a worktree for a moment; the OS cleans the temp folder */ }
  }
}
