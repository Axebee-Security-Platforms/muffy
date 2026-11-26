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
  const world = (name, { headless = false, task = 'verify-item-count', depth = 'quick' } = {}) => {
    const repo = slash(join(base, name));
    buildRepo(repo, CASES[0], depth);
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

    /* ---------- change: internal and logic-only ---------- */
    const C = 'change-item-count';
    const changeWorld = (name, scope, opts = {}) => {
      const w = world(name, { ...opts, task: C, depth: scope === 'internal' ? 'quick' : 'full' });
      const common = ['start', '--lane', 'change', '--task', C, '--scope', scope, '--request', 'Make itemCount sum the qty of every item', '--trailer', 'Co-Authored-By: Eval <eval@example.test>'];
      w.start = scope === 'internal' ? [...common, '--kind', 'refactor', '--owner', 'BE', '--ac', 'AC-1 | itemCount sums qty | test/cart.test.js'] : common;
      w.mainSha = w.git('rev-parse', 'main');
      w.contract = () => {
        writeFileSync(`${w.team}/contract.md`, '# Contract\n## Stack\nNode, no change\n## AC map\n| AC | where |\n|---|---|\n| AC-1 | cart.js itemCount |\n');
        w.ho('3-architect-r1.json', { role: 'architect', step: '3', round: 1, paths_written: [`.team/${C}/contract.md`], decisions: [{ id: 'D-1', decision: 'sum qty in itemCount', why: 'the AC' }], summary: 'contract written' });
      };
      w.pm = (round = 1) => {
        writeFileSync(`${w.team}/ac.md`, '# AC: change-item-count\n## User stories\n- As a shopper I see how many units are in my cart\n## AC\n- **AC-1** itemCount sums the qty of every item\n## Unchanged\n- total is as before\n## Out of scope\nNone beyond the request.\n');
        mkdirSync(`${w.feature}/docs/plan`, { recursive: true });
        writeFileSync(`${w.feature}/docs/plan/${C}.md`, '# Plan\n## Phase 1\n- P0 sum qty\n');
        w.git('-C', w.feature, 'add', 'docs');
        w.git('-C', w.feature, 'commit', '-qm', 'docs: plan');
        w.ho(`2-product-manager-r${round}.json`, { role: 'product-manager', step: '2', round, paths_written: [`.team/${C}/ac.md`], decisions: [{ id: 'D-1', decision: 'one AC', why: 'the request' }], summary: 'ac written' });
      };
      w.dev = (round = 1, { fixIt = true } = {}) => {
        const be = `${w.repo}/.worktrees/be-${C}`;
        if (fixIt) {
          const src = readFileSync(`${be}/cart.js`, 'utf8');
          writeFileSync(`${be}/cart.js`, round === 1 ? src.replace('return items.length;', 'return items.reduce((s, i) => s + i.qty, 0);') : `${src}// round ${round}\n`);
          w.git('-C', be, 'commit', '-qam', `fix itemCount r${round}`);
        }
        w.ho(`4-backend-dev-r${round}.json`, { role: 'backend-dev', step: '4', round, paths_written: ['cart.js'], ac_ids_done: ['AC-1'], decisions: [{ id: 'D-1', decision: 'sum qty', why: 'the AC' }], summary: 'built' });
        writeFileSync(`${w.team}/ac-tests-be.md`, '| AC-1 | test/cart.test.js |\n');
      };
      return w;
    };
    // the be worktree commit goes through the repo-level git helper with -C
    const gitIn = (w) => { const g = w.git; w.git = (...a) => (a[0] === '-C' ? execFileSync('git', a, { encoding: 'utf8' }).trim() : g(...a)); };

    const ci = changeWorld('change-i', 'internal');
    gitIn(ci);
    const cAsk = ci.run(ci.start);
    check('flow change (internal): the scope question comes first and nothing is written', cAsk.action === 'ask' && cAsk.gate === 'scope' && !existsSync(join(ci.repo, '.worktrees')) && !existsSync(join(ci.repo, '.team')), cAsk.out.slice(0, 300));
    const cGo = ci.run([...ci.start, '--approved']);
    check('flow change (internal): the architect only, reading ac.md (no researcher, PM or designer, no gates)', cGo.spawns.join() === 'architect:3:r1' && /Scope: internal/.test(cGo.prompts[0]) && existsSync(`${ci.team}/ac.md`) && !/gate 2b|gate 3c/.test(readFileSync(`${ci.team}/checkpoint.md`, 'utf8')), cGo.out.slice(0, 400));
    ci.contract();
    const cDev = ci.run(['step', C]);
    check('flow change (internal): after the contract, the backend-dev (owner from the request) on its own worktree', cDev.spawns.join() === 'backend-dev:4:r1' && existsSync(join(ci.repo, '.worktrees', `be-${C}`)), cDev.out.slice(0, 400));
    const cWait = ci.run(['step', C]);
    check('flow change: a second step while the dev is still running waits and starts nothing', cWait.action === 'wait', cWait.out.slice(0, 300));
    ci.dev();
    const cRev = ci.run(['step', C]);
    check('flow change (internal): dev back: merge into the feature branch, then the code-reviewer', cRev.spawns.join() === 'code-reviewer:6:r1' && ci.git('show', `feature/${C}:cart.js`).includes('reduce'), cRev.out.slice(0, 400));
    const cGate = ci.run(['review', C], ci.reviewMsg('Approve'));
    check('flow change (internal): an Approve runs the test gate and asks the Human gate', cGate.action === 'ask' && cGate.gate === 'human-gate', cGate.out.slice(0, 400));
    const cDone = ci.run(['answer', C, 'Approve']);
    check('flow change (internal): Approve closes the task (no docs-writer: the diff touches no migration, config or doc)', cDone.action === 'done' && !existsSync(ci.feature) && ci.git('rev-parse', 'main') === ci.mainSha, cDone.out.slice(0, 500));
    const ci2 = changeWorld('change-i2', 'internal');
    gitIn(ci2);
    ci2.run(ci2.start); ci2.run([...ci2.start, '--approved']); ci2.contract(); ci2.run(['step', C]); ci2.run(['step', C]); ci2.dev(); ci2.run(['step', C]); ci2.run(['review', C], ci2.reviewMsg('Approve')); ci2.run(['answer', C, 'Approve']);
    check('flow change (internal): the same run twice gives the same actions', ci2.log.join(' ') === ci.log.join(' '), `${ci2.log.join(' ')} != ${ci.log.join(' ')}`);

    const cr = changeWorld('change-r', 'internal');
    gitIn(cr);
    cr.run(cr.start); cr.run([...cr.start, '--approved']); cr.contract(); cr.run(['step', C]); cr.dev(); cr.run(['step', C]);
    const cBack = cr.run(['review', C], cr.reviewMsg('Reject', 1, [{ id: 'B-1', problem: 'no empty-cart test', file: 'test/cart.test.js:1', owner: 'BE' }]));
    check('flow change: a reviewer Reject sends the owner back, round 2, with the review to read', cBack.spawns.join() === 'backend-dev:4:r2' && /review-1\.md/.test(cBack.prompts[0] ?? ''), cBack.out.slice(0, 500));
    cr.dev(2);
    const cRev2 = cr.run(['step', C]);
    check('flow change: the second dev round is merged and reviewed again as round 2', cRev2.spawns.join() === 'code-reviewer:6:r2' && existsSync(`${cr.team}/diff-2.patch`), cRev2.out.slice(0, 400));

    const cb = changeWorld('change-bad', 'internal');
    gitIn(cb);
    cb.run(cb.start); cb.run([...cb.start, '--approved']);
    writeFileSync(`${cb.team}/handoff/3-architect-r1.json`, '{"role":"architect"}');
    const cRetry = cb.run(['step', C]);
    check('flow change: an invalid hand-off is retried once, a round later, with the errors in a file', cRetry.spawns.join() === 'architect:3:r2' && /retry-3-architect-r2\.md/.test(cRetry.prompts[0] ?? ''), cRetry.out.slice(0, 400));
    writeFileSync(`${cb.team}/handoff/3-architect-r2.json`, '{"role":"architect"}');
    const cStop = cb.run(['step', C]);
    check('flow change: invalid twice escalates and stops', cStop.action === 'stop' && cStop.status === 1, cStop.out.slice(0, 300));

    // a visible scope needs a full baseline: on a quick one start asks for the onboard first and writes nothing
    const quick = world('change-quick', { task: C, depth: 'quick' });
    const onb = quick.run(['start', '--lane', 'change', '--task', C, '--scope', 'ui+logic', '--request', 'x', '--approved']);
    check('flow change: a visible scope on a quick baseline asks for the full onboard first and writes nothing', onb.action === 'onboard' && /depth=full/.test(onb.out) && !existsSync(join(quick.repo, '.worktrees')), onb.out.slice(0, 300));

    // logic-only: a visible scope, so the plan gate (2b), the contract gate (3c) and the docs-writer all apply
    const docsDone = (w) => {
      writeFileSync(`${w.team}/release-notes.md`, '# Release notes\nitemCount counts units.\n## Deploy hand-off\nNothing to run.\n');
      w.ho('11-docs-writer-r1.json', { role: 'docs-writer', step: '11', round: 1, paths_written: [`.team/${C}/release-notes.md`], decisions: [{ id: 'D-1', decision: 'one paragraph', why: 'a small change' }], summary: 'notes written' });
    };
    const lo = changeWorld('change-lo', 'logic-only');
    gitIn(lo);
    const lAsk = lo.run(lo.start);
    check('flow change (logic-only): the scope question carries the scope and nothing is written', lAsk.action === 'ask' && /logic-only/.test(lAsk.out) && !existsSync(join(lo.repo, '.team')), lAsk.out.slice(0, 200));
    const lPm = lo.run([...lo.start, '--approved']);
    check('flow change (logic-only): the product-manager first (the AC come from it), no researcher', lPm.spawns.join() === 'product-manager:2:r1' && /Scope: logic-only/.test(lPm.prompts[0]), lPm.out.slice(0, 300));
    lo.pm();
    const lG1 = lo.run(['step', C]);
    check('flow change (logic-only): the plan gate asks Approve / Request changes / Reject before any design or code', lG1.action === 'ask' && lG1.gate === 'plan-review' && /Request changes/.test(lG1.out), lG1.out.slice(0, 300));
    const early = spawnSync(process.execPath, [NEXT, 'step', C], { cwd: lo.repo, env: lo.env, encoding: 'utf8' });
    check('flow change (logic-only): asking again before the answer asks the same question, spawns nothing', !/action=spawn/.test(early.stdout) && /gate=plan-review/.test(early.stdout), early.stdout.slice(0, 200));
    const lA = lo.run(['answer', C, 'Approve']);
    check('flow change (logic-only): Approve records gate 2b with checkpoint.mjs and starts the architect', lA.spawns.join() === 'architect:3:r1' && /gate 2b passed/.test(readFileSync(`${lo.team}/checkpoint.md`, 'utf8')), lA.out.slice(0, 400));
    lo.contract();
    const lG2 = lo.run(['step', C]);
    check('flow change (logic-only): the contract gate (no designer ran) asks before any code', lG2.action === 'ask' && lG2.gate === 'design-review' && /Contract/.test(lG2.out), lG2.out.slice(0, 400));
    const lB = lo.run(['answer', C, 'Approve']);
    check('flow change (logic-only): Approve records gate 3c and starts the backend-dev only', lB.spawns.join() === 'backend-dev:4:r1' && /gate 3c passed/.test(readFileSync(`${lo.team}/checkpoint.md`, 'utf8')), lB.out.slice(0, 400));
    lo.dev();
    lo.run(['step', C]);
    const lH = lo.run(['review', C], lo.reviewMsg('Approve'));
    const lD = lo.run(['answer', C, 'Approve']);
    check('flow change (logic-only): after the Human gate the docs-writer always runs (a visible scope never skips it)', lH.gate === 'human-gate' && lD.spawns.join() === 'docs-writer:11:r1' && /Human approved/.test(lD.prompts[0] ?? ''), lD.out.slice(0, 400));
    docsDone(lo);
    const lF = lo.run(['step', C]);
    check('flow change (logic-only): the docs hand-off back, the task closes', lF.action === 'done' && !existsSync(lo.feature) && lo.git('rev-parse', 'main') === lo.mainSha, lF.out.slice(0, 400));

    // request changes at the plan gate: the product-manager again, round 2, with the reason in a file; the gate stays open
    const lc = changeWorld('change-lc', 'logic-only');
    gitIn(lc);
    lc.run(lc.start); lc.run([...lc.start, '--approved']); lc.pm(); lc.run(['step', C]);
    const lReq = lc.run(['answer', C, 'Request changes: add an empty-cart AC']);
    check('flow change: Request changes sends the product-manager back (round 2) with the reason to read; gate 2b stays open', lReq.spawns.join() === 'product-manager:2:r2' && /changes-2b\.md/.test(lReq.prompts[0] ?? '') && /empty-cart/.test(readFileSync(`${lc.team}/changes-2b.md`, 'utf8')) && !/gate 2b passed/.test(readFileSync(`${lc.team}/checkpoint.md`, 'utf8')), lReq.out.slice(0, 400));
    const lRej = changeWorld('change-lj', 'logic-only');
    gitIn(lRej);
    lRej.run(lRej.start); lRej.run([...lRej.start, '--approved']); lRej.pm(); lRej.run(['step', C]);
    const lJ = lRej.run(['answer', C, 'Reject']);
    check('flow change: Reject at the plan gate stops the run and keeps the pause', lJ.action === 'stop' && /rejected/.test(lJ.out) && !existsSync(join(lRej.repo, '.worktrees', `be-${C}`)), lJ.out.slice(0, 300));

    // needs-input: the interview goes to requirements.md, the agent starts again a round later, and at most 2 rounds per agent
    const ln = changeWorld('change-ln', 'logic-only');
    gitIn(ln);
    ln.run(ln.start); ln.run([...ln.start, '--approved']);
    const needs = (round) => ln.ho(`2-product-manager-r${round}.json`, { role: 'product-manager', step: '2', round, status: 'needs-input', summary: 'questions', questions: [{ id: `Q-${round}`, question: 'Count units or lines?', why: 'it decides the AC', options: ['units', 'lines'], default: 'units', blocking: true }] });
    needs(1);
    const nq = ln.run(['step', C]);
    check('flow change: a needs-input hand-off becomes a question to the user (recommended option first)', nq.action === 'ask' && nq.gate === 'clarify' && /Count units or lines/.test(nq.out), nq.out.slice(0, 400));
    const na = ln.run(['answer', C, 'lines']);
    check('flow change: the answer goes to requirements.md and the same agent starts again a round later, reading it', na.spawns.join() === 'product-manager:2:r2' && /lines/.test(readFileSync(`${ln.team}/requirements.md`, 'utf8')) && /requirements\.md/.test(na.prompts[0] ?? '') && /clarify product-manager: 1\/2/.test(readFileSync(`${ln.team}/checkpoint.md`, 'utf8')), na.out.slice(0, 400));
    needs(2);
    ln.run(['step', C]); ln.run(['answer', C, 'units']);
    needs(3);
    const nlim = ln.run(['step', C]);
    check('flow change: a third round of questions from one agent stops: the cap is 2 per agent', nlim.action === 'stop' && /third time/.test(nlim.out), nlim.out.slice(0, 300));

    // headless: the plan gate waits for a person; the recorded answer resumes
    const lh = changeWorld('change-lh', 'logic-only', { headless: true });
    gitIn(lh);
    const hs = lh.run(lh.start);
    lh.status(`- scope answered: go (recommended) | logic-only by eval (test) ${new Date().toISOString()}`);
    lh.run(['step', C]);
    lh.pm();
    const hg = lh.run(['step', C]);
    check('flow change: headless waits at the plan gate with gate.json and muffy-status, never answering', hs.action === 'stop' && hg.action === 'stop' && /waiting:plan-review/.test(hg.out) && existsSync(`${lh.team}/gate.json`), hg.out.slice(0, 400));
    lh.status(`- plan-review answered: Approve by eval (test) ${new Date().toISOString()}`);
    const hr = lh.run(['step', C]);
    check('flow change: the recorded plan-review answer resumes with the architect', hr.spawns.join() === 'architect:3:r1' && /gate 2b passed/.test(readFileSync(`${lh.team}/checkpoint.md`, 'utf8')), hr.out.slice(0, 400));

    /* ---------- upgrade: researcher, the breaking-change AC, architect (ADR), contract gate, dev, review, docs ---------- */
    const U = 'upgrade-cart';
    const upgradeWorld = (name, opts = {}) => {
      const w = changeWorld(name, 'logic-only', opts);
      w.task = U;
      w.team = `${w.repo}/.worktrees/feature-${U}/.team/${U}`;
      w.feature = `${w.repo}/.worktrees/feature-${U}`;
      w.start = ['start', '--lane', 'upgrade', '--task', U, '--target', 'left-pad 1.3 to 2.0', '--request', 'Upgrade left-pad to 2.0 and fix what breaks', '--owner', 'BE', '--trailer', 'Co-Authored-By: Eval <eval@example.test>'];
      const q = { task: U, status: 'done', paths_written: [], blockers: [], quality_checks: { passed: true, failed: [] } };
      w.ho = (file, o) => writeFileSync(`${w.team}/handoff/${file}`, JSON.stringify({ ...q, ...o }));
      w.brief = () => { writeFileSync(`${w.team}/brief.md`, '# Brief\n## Must-not-miss requirements\n- the pad API now takes an options object\n'); w.ho('1-researcher-r1.json', { role: 'researcher', step: '1', round: 1, paths_written: [`.team/${U}/brief.md`], summary: 'changelog read' }); };
      w.adr = () => { writeFileSync(`${w.team}/contract.md`, '# Contract\n## Stack\nleft-pad 2.0\n## Upgrade ADR\nOrder: bump, fix call sites, rollback = revert.\n'); w.ho('3-architect-r1.json', { role: 'architect', step: '3', round: 1, paths_written: [`.team/${U}/contract.md`], decisions: [{ id: 'D-1', decision: 'bump then fix call sites', why: 'smallest order' }], summary: 'ADR written' }); };
      w.devU = () => {
        const be = `${w.repo}/.worktrees/be-${U}`;
        writeFileSync(`${be}/cart.js`, readFileSync(`${be}/cart.js`, 'utf8').replace('return items.length;', 'return items.reduce((s, i) => s + i.qty, 0);'));
        execFileSync('git', ['-C', be, 'commit', '-qam', 'upgrade call sites'], { encoding: 'utf8' });
        w.ho('4-backend-dev-r1.json', { role: 'backend-dev', step: '4', round: 1, paths_written: ['cart.js'], ac_ids_done: ['AC-1', 'AC-2'], decisions: [{ id: 'D-1', decision: 'call sites', why: 'the ADR' }], summary: 'built' });
        writeFileSync(`${w.team}/ac-tests-be.md`, '| AC-1 | test/cart.test.js |\n| AC-2 | test/cart.test.js |\n');
      };
      w.docs = () => { writeFileSync(`${w.team}/release-notes.md`, '# Release notes\nleft-pad 2.0.\n## Deploy hand-off\nPin left-pad 2.0; rollback: revert.\n'); w.ho('11-docs-writer-r1.json', { role: 'docs-writer', step: '11', round: 1, paths_written: [`.team/${U}/release-notes.md`], decisions: [{ id: 'D-1', decision: 'notes', why: 'the upgrade' }], summary: 'notes written' }); };
      return w;
    };
    const drive = (w) => {
      w.run(w.start); w.run([...w.start, '--approved']); w.cp0 = readFileSync(`${w.team}/checkpoint.md`, 'utf8'); w.brief();
      const ac = w.run(['step', U]);
      const arch = w.run(['record', U, 'upgrade-ac', '1 added']);
      w.adr();
      const gate = w.run(['step', U]);
      const dev = w.run(['answer', U, 'Approve']);
      w.devU();
      w.run(['step', U]);
      const hg = w.run(['review', U], w.reviewMsg('Approve'));
      const docs = w.run(['answer', U, 'Approve']);
      w.docs();
      const done = w.run(['step', U]);
      return { ac, arch, gate, dev, hg, docs, done };
    };
    const up = upgradeWorld('upgrade-a', {});
    gitIn(up);
    const ur = drive(up);
    check('flow upgrade: the researcher first, no product-manager, no plan gate (2b is recorded as skipped at setup)', up.log[1] === 'start:spawn:researcher:1:r1' && /gate 2b skipped/.test(up.cp0), up.log.join(' '));
    check('flow upgrade: after the brief, the breaking-change AC is a `do` the script checks; then the architect writes the ADR', ur.ac.action === 'do' && /upgrade-ac/.test(ur.ac.out) && ur.arch.spawns.join() === 'architect:3:r1', `${ur.ac.out.slice(0, 200)} / ${ur.arch.out.slice(0, 200)}`);
    check('flow upgrade: the ADR and contract go to the user at the design gate (contract gate) before any code', ur.gate.action === 'ask' && ur.gate.gate === 'design-review' && /Upgrade ADR|Contract/.test(ur.gate.out), ur.gate.out.slice(0, 300));
    check('flow upgrade: Approve starts the backend-dev; review, test gate and Human gate follow; the docs-writer then closes it', ur.dev.spawns.join() === 'backend-dev:4:r1' && ur.hg.gate === 'human-gate' && ur.docs.spawns.join() === 'docs-writer:11:r1' && ur.done.action === 'done', `${ur.dev.out.slice(0, 120)} | ${ur.hg.out.slice(0, 120)} | ${ur.docs.out.slice(0, 120)} | ${ur.done.out.slice(0, 200)}`);
    const up2 = upgradeWorld('upgrade-b', {});
    gitIn(up2);
    drive(up2);
    check('flow upgrade: the same run twice gives the same actions', up.log.join(' ') === up2.log.join(' '), `${up.log.join(' ')} != ${up2.log.join(' ')}`);

    /* ---------- the lanes that follow are added below ---------- */
    void mkdirSync;
  } finally {
    try { rmSync(base, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Windows may still hold a worktree for a moment; the OS cleans the temp folder */ }
  }
}
