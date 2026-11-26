// Offline checks for next.mjs, the fix lane one step at a time: real temp git repos, the agents played by this file (it writes the
// hand-offs they would write). What is checked: the sequence of actions is the same every run, nothing is written before the scope
// is approved, the user's branches are never touched, a bad hand-off is retried once and then stops, and a reviewer's Reject sends
// the fix back with the review.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const slash = (p) => p.split('\\').join('/');

export async function runNextEvals({ check, root }) {
  const { buildRepo, CASES } = await import(pathToFileURL(join(root, 'scripts', 'measure-fix.mjs')).href);
  const NEXT = join(root, 'skills/muffy/scripts/next.mjs');
  const T = 'fix-item-count';
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'muffy-next-')));
  const git = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  const baseEnv = { ...process.env };
  delete baseEnv.SECOND_BRAIN_VAULT;
  for (const k of Object.keys(baseEnv)) if (k.startsWith('MUFFY_')) delete baseEnv[k];

  const world = (name, { headless = true } = {}) => {
    const repo = slash(join(base, name));
    buildRepo(repo, CASES[0]);
    const env = { ...baseEnv, ...(headless ? { MUFFY_HEADLESS: '1' } : {}) };
    const log = [];
    const run = (args, input) => {
      const r = spawnSync(process.execPath, [NEXT, ...args], { cwd: repo, env, encoding: 'utf8', input });
      const action = r.stdout.match(/^action=(\S+)/m)?.[1] ?? null;
      const kv = (k) => r.stdout.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1];
      const res = { status: r.status, out: r.stdout, err: r.stderr, action, role: kv('role'), round: kv('round'), step: kv('step'), model: kv('model'), prompt: r.stdout.match(/---prompt---\n([\s\S]*?)\n---prompt---/)?.[1] ?? '' };
      log.push(`${args[0]}:${action}${res.role ? `:${res.role}:r${res.round}` : ''}`);
      return res;
    };
    const feature = `${repo}/.worktrees/feature-${T}`;
    const team = `${feature}/.team/${T}`;
    const q = { role: '', task: T, status: 'done', paths_written: [], blockers: [], quality_checks: { passed: true, failed: [] } };
    const ho = (name, o) => writeFileSync(`${team}/handoff/${name}`, JSON.stringify({ ...q, ...o }));
    const startArgs = ['start', '--task', T, '--scope', 'bug', '--owner', 'BE', '--request', CASES[0].request, '--symptom', 'itemCount returns 2, expected 5', '--ac', 'AC-1 | itemCount sums qty | test/cart.test.js', '--repro', 'npm test', '--trailer', 'Co-Authored-By: Eval <eval@example.test>'];
    const diagnosed = (round = 1, extra = {}) => {
      writeFileSync(`${team}/fix.md`, readFileSync(`${team}/fix.md`, 'utf8').replace('## Cause\n', '## Cause\ncart.js itemCount returns items.length.\n').replace('## Evidence\n', '## Evidence\ntest red: 2 !== 5\n'));
      ho(`4a-debugger-r${round}.json`, { role: 'debugger', step: '4a', round, paths_written: [`.team/${T}/fix.md`], diagnosis: { status: 'known', confidence: 'high', cause: 'itemCount ignores qty', files: ['cart.js'], repro: 'npm test', severity: 'medium', owner: 'BE' }, summary: 'diagnosed', ...extra });
    };
    const audited = (verdict = 'confirm', round = 1) => ho(`4b-auditor-r${round}.json`, { role: 'auditor', step: '4b', round, audit: { verdict, evidence_level: 'medium', repro_rerun: 'red', ...(verdict === 'confirm' ? {} : { reason: 'the evidence does not rule out the other cause', missing: ['a second piece of evidence'] }) }, summary: verdict });
    const developed = (round = 1, fixIt = true) => {
      const be = `${repo}/.worktrees/be-${T}`;
      if (fixIt) {
        writeFileSync(`${be}/cart.js`, readFileSync(`${be}/cart.js`, 'utf8').replace('return items.length;', 'return items.reduce((s, i) => s + i.qty, 0);'));
        git(be, 'commit', '-qam', `fix itemCount r${round}`);
      }
      ho(`4-backend-dev-r${round}.json`, { role: 'backend-dev', step: '4', round, paths_written: ['cart.js'], ac_ids_done: ['AC-1'], decisions: [{ id: 'D-1', decision: 'sum qty', why: 'the AC' }], summary: 'fixed: items[items.length] is now items.reduce(...)' });
      writeFileSync(`${team}/ac-tests-be.md`, '| AC-1 | test/cart.test.js |\n');
    };
    const reviewMsg = (verdict, round = 1, blockers = []) => `Verdict: ${verdict}\n\nReviewed.\n${JSON.stringify({ ...q, role: 'code-reviewer', step: '6', round, verdict, blockers, summary: verdict.toLowerCase() })}\n`;
    return { repo, env, run, log, feature, team, ho, startArgs, diagnosed, audited, developed, reviewMsg, git: (...a) => git(repo, ...a) };
  };

  try {
    /* the whole lane, headless: the same actions in the same order, and the user's branch untouched */
    const flow = () => {
      const w = world(`flow-${Math.random().toString(36).slice(2, 7)}`);
      const mainBefore = w.git('rev-parse', 'main');
      const a = w.run(w.startArgs);
      w.diagnosed();
      const b = w.run(['step', T]);
      w.audited();
      const c = w.run(['step', T]);
      w.developed();
      const d = w.run(['step', T]);
      const e = w.run(['review', T], w.reviewMsg('Approve'));
      return { w, a, b, c, d, e, mainBefore };
    };
    const r1 = flow();
    const r2 = flow();
    check('next: headless fix lane, start to done: debugger, auditor, backend-dev, code-reviewer, then done', r1.w.log.join(' ') === 'start:spawn:debugger:r1 step:spawn:auditor:r1 step:spawn:backend-dev:r1 step:spawn:code-reviewer:r1 review:done', r1.w.log.join(' '));
    check('next: the same run twice gives the same actions', r1.w.log.join(' ') === r2.w.log.join(' '));
    check('next: the prompts carry the task, the lane header, the trailer and the hand-off path', r1.a.prompt.includes(`Task: ${T}`) && r1.a.prompt.includes('Profile: fix') && r1.a.prompt.includes('Co-Authored-By: Eval') && r1.a.prompt.includes('handoff/4a-debugger-r1.json'), r1.a.prompt.slice(0, 400));
    check('next: the auditor runs on opus and the dev worktree is cut after the audit', r1.b.model === 'opus' && existsSync(join(r1.w.repo, '.worktrees', `be-${T}`)) === false && r1.c.prompt.includes('.worktrees/be-'), `${r1.b.model}`);
    check('next: the fix is merged into the feature branch and its tests pass', r1.w.git('show', `feature/${T}:cart.js`).includes('reduce') && spawnSync(process.execPath, ['--test'], { cwd: `${r1.w.repo}/.worktrees/feature-${T}`, encoding: 'utf8' }).status !== undefined && r1.e.out.includes('The test gate passed'), r1.e.out.slice(-600));
    check('next: the user\'s base branch is never touched and nothing is pushed', r1.w.git('rev-parse', 'main') === r1.mainBefore && r1.w.git('remote').length === 0);
    check('next: closing removes the role and feature worktrees, keeps the branch and marks the task closed', !existsSync(join(r1.w.repo, '.worktrees', `feature-${T}`)) && !existsSync(join(r1.w.repo, '.worktrees', `be-${T}`)) && r1.w.git('rev-parse', '--verify', `feature/${T}`).length > 0 && /closed/.test(r1.w.git('show', `feature/${T}:.team/${T}/checkpoint.md`)));
    check('next: a bracket in an agent summary (code such as items[i]) never breaks the checkpoint, and the spawn log has the model the spawn was issued with', ![r1.b, r1.c, r1.d, r1.e].some((r) => /^warning=/m.test(r.out)) && /\bopus\b/.test(r1.w.git('show', `feature/${T}:.team/${T}/spawns.tsv`)), [r1.b, r1.c, r1.d, r1.e].map((r) => r.out.match(/^warning=.*$/m)?.[0]).join(' | '));
    check('next: closing writes the task note and the project row from the files', /status: done/.test(readFileSync(join(r1.w.repo, '.team/brain/tasks', `${T}.md`), 'utf8')) && /done/.test(readFileSync(join(r1.w.repo, '.team/brain/project.md'), 'utf8')));
    check('next: every consumed hand-off is in the spawn log, committed with the trailer', r1.w.git('show', `feature/${T}:.team/${T}/spawns.tsv`).split('\n').filter(Boolean).length === 4 && r1.w.git('log', `feature/${T}`, '--format=%B', '-5').includes('Co-Authored-By: Eval'));

    /* interactive: nothing is written before the scope is approved; the Human gate asks, and the answer closes */
    const w = world('interactive', { headless: false });
    const asked = w.run(w.startArgs);
    check('next: interactive start asks the scope question first and writes nothing', asked.action === 'ask' && asked.out.includes('---questions---') && !existsSync(join(w.repo, '.worktrees')) && !existsSync(join(w.repo, '.team')) && !w.git('branch', '--list', 'feature/*'), asked.out.slice(0, 300));
    const go = w.run([...w.startArgs, '--approved']);
    check('next: --approved starts the lane', go.action === 'spawn' && go.role === 'debugger');
    const again = w.run([...w.startArgs, '--approved']);
    check('next: a second start continues and does not rewrite fix.md', again.action === 'spawn' && again.role === 'debugger' && existsSync(join(w.team, 'fix.md')));
    w.diagnosed(); w.run(['step', T]); w.audited(); w.run(['step', T]); w.developed(); w.run(['step', T]);
    const gate = w.run(['review', T], w.reviewMsg('Approve'));
    check('next: the Human gate asks (Approve / Reject) and the worktree stays until the answer', gate.action === 'ask' && /Approve/.test(gate.out) && existsSync(w.feature) && /pause:human-gate/.test(readFileSync(join(w.team, 'checkpoint.md'), 'utf8')), gate.out.slice(0, 300));
    const done = w.run(['answer', T, 'Approve']);
    check('next: Approve closes the task', done.action === 'done' && !existsSync(w.feature), done.out.slice(0, 300));

    /* not a fix: the route is returned and nothing is written */
    const rt = world('route');
    const routed = rt.run([...rt.startArgs, '--signals', JSON.stringify({ has_symptom: true, has_location: true, changes_contract: true })]);
    check('next: a request the triage sends to the full flow is routed, not started', routed.action === 'route' && !existsSync(join(rt.repo, '.worktrees')), routed.out.slice(0, 300));

    /* an invalid dev hand-off is sent back once, then the run stops */
    const bad = world('invalid');
    bad.run(bad.startArgs); bad.diagnosed(); bad.run(['step', T]); bad.audited(); bad.run(['step', T]);
    writeFileSync(`${bad.team}/handoff/4-backend-dev-r1.json`, '{"role":"backend-dev"}');
    const retry = bad.run(['step', T]);
    check('next: an invalid hand-off is retried once, a round later, with the errors in a file', retry.action === 'spawn' && retry.role === 'backend-dev' && retry.round === '2' && readdirSync(bad.team).some((f) => f.startsWith('retry-4-backend-dev-r2')), retry.out.slice(0, 300));
    writeFileSync(`${bad.team}/handoff/4-backend-dev-r2.json`, '{"role":"backend-dev"}');
    const stop = bad.run(['step', T]);
    check('next: invalid twice escalates and stops (exit 1, muffy-status in headless)', stop.action === 'stop' && stop.status === 1 && /muffy-status=blocked:invalid-handoff/.test(stop.out), stop.out.slice(0, 300));

    /* the auditor does not confirm: headless stops at the audit gate; the cause is never fixed unaudited */
    const rj = world('reject');
    rj.run(rj.startArgs); rj.diagnosed(); rj.run(['step', T]); rj.audited('reject');
    const rejected = rj.run(['step', T]);
    check('next: an auditor reject stops the headless run and starts no dev', rejected.action === 'stop' && !existsSync(join(rj.repo, '.worktrees', `be-${T}`)), rejected.out.slice(0, 300));

    /* a reviewer Reject sends the fix back with the review in Read: */
    const rv = world('reviewreject');
    rv.run(rv.startArgs); rv.diagnosed(); rv.run(['step', T]); rv.audited(); rv.run(['step', T]); rv.developed(); rv.run(['step', T]);
    const back = rv.run(['review', T], rv.reviewMsg('Reject', 1, [{ id: 'B-1', problem: 'no empty-cart test', file: 'test/cart.test.js:1', owner: 'BE' }]));
    check('next: a reviewer Reject spawns the dev again, round 2, with review-1.md to read', back.action === 'spawn' && back.role === 'backend-dev' && back.round === '2' && back.prompt.includes('review-1.md'), back.out.slice(0, 400));

    /* a reviewer message with no hand-off line: a fresh reviewer, a round later, with the errors in a file */
    const rb = world('reviewbad');
    rb.run(rb.startArgs); rb.diagnosed(); rb.run(['step', T]); rb.audited(); rb.run(['step', T]); rb.developed(); rb.run(['step', T]);
    const rb1 = rb.run(['review', T], 'Approved, nothing to add. (no JSON line)');
    check('next: a reviewer message with no hand-off line starts a fresh code-reviewer, round 2, with the errors to read', rb1.action === 'spawn' && rb1.role === 'code-reviewer' && rb1.round === '2' && /retry-6-code-reviewer-r2\.md/.test(rb1.prompt), rb1.out.slice(0, 400));

    /* model-fail: a haiku spawn that had to be re-run is written as a fixed line, and the next spawn of that role keeps its default model */
    const mf = world('modelfail');
    const mfStart = mf.run([...mf.startArgs, '--line-known']);
    check('next: with the line known the debugger starts on haiku', mfStart.model === 'haiku', mfStart.out.slice(0, 200));
    writeFileSync(`${mf.team}/handoff/4a-debugger-r1.json`, '{"role":"debugger"}');
    const mfRetry = mf.run(['step', T]);
    const proj = readFileSync(join(mf.repo, '.team/brain/project.md'), 'utf8');
    check('next: an invalid hand-off from a haiku debugger writes `- model-fail: debugger haiku` once, and the retry runs on the default model', /^- model-fail: debugger haiku · fix-item-count · retry:invalid-handoff$/m.test(proj) && mfRetry.role === 'debugger' && mfRetry.round === '2' && mfRetry.model !== 'haiku', `${proj}\n${mfRetry.out.slice(0, 200)}`);
    writeFileSync(`${mf.team}/handoff/4a-debugger-r2.json`, '{"role":"debugger"}');
    mf.run(['step', T]);
    check('next: the line is written once per role, not once per failure', (readFileSync(join(mf.repo, '.team/brain/project.md'), 'utf8').match(/model-fail: debugger haiku/g) ?? []).length === 1);

    /* an environment failure (failure_kind) in the fix lane: no escalation, no fix round; --rerun runs the dev again at the same round */
    const fe = world('envfail');
    fe.run(fe.startArgs); fe.diagnosed(); fe.run(['step', T]); fe.audited(); fe.run(['step', T]);
    fe.ho('4-backend-dev-r1.json', { role: 'backend-dev', step: '4', round: 1, status: 'blocked', failure_kind: 'environment', paths_written: [], ac_ids_done: [], blockers: [{ id: 'B-1', problem: 'node is not installed in the worktree', owner: 'Devops' }], decisions: [{ id: 'D-1', decision: 'stopped', why: 'no node' }], summary: 'blocked by the environment' });
    const fe1 = fe.run(['step', T]);
    check('next: a dev blocked by the environment stops with outcome environment (not a blocker to promote, not a loop)', fe1.action === 'stop' && /outcome=environment/.test(fe1.out) && /muffy-status=blocked:environment/.test(fe1.out), fe1.out.slice(0, 400));
    const fe2 = fe.run(['step', T, '--rerun']);
    check('next: step --rerun runs the backend-dev again at the same round', fe2.action === 'spawn' && fe2.role === 'backend-dev' && fe2.round === '1', fe2.out.slice(0, 300));

    /* a real remote: a full fix run leaves every ref of it as it was */
    const rr = world('remote');
    const bare = join(base, 'origin.git').split('\\').join('/');
    execFileSync('git', ['init', '-q', '--bare', bare]);
    git(rr.repo, 'remote', 'add', 'origin', bare);
    git(rr.repo, 'push', '-q', 'origin', 'main');
    const refsOf = () => execFileSync('git', ['-C', bare, 'for-each-ref', '--format=%(refname) %(objectname)'], { encoding: 'utf8' });
    const refsBefore = refsOf();
    rr.run(rr.startArgs); rr.diagnosed(); rr.run(['step', T]); rr.audited(); rr.run(['step', T]); rr.developed(); rr.run(['step', T]); rr.run(['review', T], rr.reviewMsg('Approve'));
    check('next: a full fix run leaves every ref of a real remote as it was', refsOf() === refsBefore && git(rr.repo, 'rev-parse', 'main') === git(rr.repo, 'rev-parse', 'origin/main'), refsOf());

    /* usage errors */
    const missing = spawnSync(process.execPath, [NEXT, 'step', 'no-such-task'], { cwd: rv.repo, env: rv.env, encoding: 'utf8' });
    check('next: a task that never started is a usage error (exit 2)', missing.status === 2 && /run start first/.test(missing.stderr), missing.stderr);
    const noArgs = spawnSync(process.execPath, [NEXT, 'start', '--task', 'x'], { cwd: rv.repo, env: rv.env, encoding: 'utf8' });
    check('next: start without its flags says which are missing (exit 2)', noArgs.status === 2 && /--scope/.test(noArgs.stderr), noArgs.stderr);
  } finally {
    try { rmSync(base, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Windows may still hold a worktree for a moment; the OS cleans the temp folder */ }
  }
}
