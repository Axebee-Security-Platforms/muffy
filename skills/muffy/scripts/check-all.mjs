#!/usr/bin/env node
// The scripted half of references/quality-checks.md in one call, after any step. Runs, in order:
//   handoff     every hand-off of this step and round validates and reports quality_checks.passed
//   loop        next-action.mjs over all hand-offs of the task: what to do now (accept, fix:<owner>, retry, escalate, promote)
//   gates       no hand-off past an open human gate (2b, 3c; gate-rules.mjs), gated lanes only (feature, redesign)
//   checkpoint  check-checkpoint.mjs
//   artifacts   check-artifacts.mjs (sizes, links, traceability brief → AC → contract → qa-report)
//   brain       each role of this step wrote <brain>/agents/<role>/<task>.md          (with --brain)
//   runtime     the runtime in qa-report.md matches the deploy.md pin                  (when both exist)
//   fix lane    from step 4 on: the 4a diagnosis is `known`, fix.md has ## Cause and ## Repro   (fix lane)
// The lane comes from the checkpoint's `## Run profile` line (lanes.mjs); --profile overrides it.
//   diff        diff-signals.mjs: the 3d decision, and from step 4 on the lane scope     (with --base)
// The judgment half of quality-checks.md (plan phases, what the brain note says, gates the user answered) stays with you.
//
// Usage: node check-all.mjs <.team/<task>> --step <s> --round <n> [--profile fix|change|verify|upgrade] [--skip 3d] [--brain <dir>]
//                           [--base <ref> [--head <ref>] [--cwd <repo>]]
// Hand-offs are ordered by round, then step order (steps.md), so a fix round (4 r2) comes after the review that sent it (6 r1).
// Prints `next=<action>` first, then one `ok`/`FAIL` line per check and the failing lines.
// Exit 0 = every check passed and the loop says proceed, 1 = something to act on, 2 = usage error.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validate } from './schema.mjs';
import { simulate, GATED_STEPS } from './next-action.mjs';
import { checkTask as checkCheckpoint } from './check-checkpoint.mjs';
import { checkTask as checkArtifacts } from './check-artifacts.mjs';
import { classify, laneVerdict, smokeOnRecord } from './diff-signals.mjs';
import { parseOwnership } from './ownership.mjs';
import { gateErrors, gateState } from './gate-rules.mjs';
import { STEP_ORDER, laneSpec, resolveLane, skipsOf, parseRunProfile } from './lanes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export { STEP_ORDER };
const readIf = (p) => (existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null);
const section = (md, name) => md?.match(new RegExp(`^## ${name}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))?.[1] ?? null;
const version = (text) => text?.match(/\bRuntime:\s*[A-Za-z.]*\s*v?(\d+(?:\.\d+)*)/)?.[1];

function handoffs(taskDir) {
  const dir = join(taskDir, 'handoff');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const m = f.match(/^([0-9]+[a-z]?)-(.+)-r(\d+)\.json$/);
    let data = null;
    try { data = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { /* reported by the handoff check */ }
    return m && STEP_ORDER.includes(m[1]) ? { file: f, step: m[1], role: m[2], round: Number(m[3]), data } : null;
  }).filter(Boolean).sort((a, b) => a.round - b.round || STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step));
}

export function checkAll(taskDir, { step, round, profile: given, skip = [], brain, base, head = 'HEAD', cwd } = {}) {
  const task = basename(resolve(taskDir));
  const cpText = readIf(join(taskDir, 'checkpoint.md'));
  // the lane: --profile when given, else the checkpoint's Run profile line; feature runs with no profile.
  // Skips: the lane's own, plus --skip when given, else the steps the lane line lists (`checkpoint.mjs profile --skip 3d`)
  const cp = parseRunProfile(cpText);
  const g = given ? resolveLane(given) : null;
  const run = g && (g.lane !== cp.lane || (g.scope && g.scope !== cp.scope)) ? { ...g, skipped: [] } : cp;
  const profile = run.lane === 'feature' ? undefined : run.lane;
  const results = []; // [name, errors[]]
  const add = (name, errors) => results.push([name, errors]);
  const all = handoffs(taskDir);
  const mine = all.filter((h) => h.step === String(step) && h.round === Number(round));
  const schema = JSON.parse(readFileSync(join(here, '..', 'schemas', 'handoff.schema.json'), 'utf8'));

  add('handoff', mine.length ? mine.flatMap((h) => {
    if (!h.data) return [`${h.file}: not valid JSON`];
    const errs = validate(schema, h.data).map((e) => `${h.file}: ${e}`);
    if (!errs.length && !h.data.quality_checks.passed) errs.push(`${h.file}: quality_checks.passed is false (${h.data.quality_checks.failed.join(', ') || 'no items named'})`);
    return errs;
  }) : [`no hand-off for step ${step} round ${round} in handoff/ (code-reviewer: save the block from its message)`]);

  // loop: gates the user answered are in the checkpoint, not in a hand-off
  const status = section(cpText, 'Status') ?? '';
  // the same reader as the gate guard, so `gate 3c not passed` never counts as passed
  const passed = cpText === null ? [] : GATED_STEPS.filter((g) => gateState(cpText, g) === 'passed');
  // after an audit reject the user may accept the risk; the Orchestrator records `audit 4b: risk accepted` in ## Status
  const riskAccepted = /\baudit 4b\b[^\n]*\brisk accepted\b/i.test(status);
  if (riskAccepted) passed.push('4b');
  const skips = [...new Set([...skipsOf(profile, run.scope), ...(skip.length ? skip : run.skipped)])];
  // a task promoted out of the fix lane keeps its 4a/4b hand-offs in handoff/; they belong to the lane it left, so neither the
  // loop (which would promote again) nor the gates (which would see a step past 2b) read them
  const trail = run.lane === 'fix' ? all : all.filter((h) => !['4a', '4b'].includes(h.step));
  const upTo = trail.filter((h) => h.round < Number(round) || (h.round === Number(round) && STEP_ORDER.indexOf(h.step) <= STEP_ORDER.indexOf(String(step))));
  const loop = simulate({ task, profile, scope: run.scope, until: run.until, skip: skips, passed, events: upTo.map((h) => ({ handoff: h.data, step: h.step, role: h.role })) });
  const next = loop.outcome === 'invalid-profile' ? 'fix-run-profile' : loop.actions.at(-1) ?? 'none';
  add('loop', [...loop.violations, ...(['escalated', 'blocked', 'invalid-profile', 'promoted'].includes(loop.outcome) ? [`${next}${loop.trigger ? ` (${loop.trigger})` : ''}`] : [])]);

  // human gates (step-details 2b, 3c): a hand-off past an open gate is an error; fix and lite have no gates
  add('gates', gateErrors(cpText, upTo.map((h) => h.step), {
    designExists: existsSync(join(taskDir, 'design.md')),
    lane: run.lane,
  }));

  add('checkpoint', checkCheckpoint(taskDir));
  add('artifacts', checkArtifacts(taskDir));

  if (brain) add('brain', [...new Set(mine.map((h) => h.role))].filter((r) => !existsSync(join(brain, 'agents', r, `${task}.md`))).map((r) => `missing ${brain}/agents/${r}/${task}.md`));

  const qa = readIf(join(taskDir, 'qa-report.md'));
  const pin = version(readIf(join(taskDir, 'deploy.md')));
  if (qa && pin) { const ran = version(qa); add('runtime', ran === pin ? [] : [`qa-report.md ran ${ran ?? 'no Runtime: line'}, deploy.md pins ${pin}`]); }

  if (profile === 'fix' && STEP_ORDER.indexOf(String(step)) >= STEP_ORDER.indexOf('4')) {
    const errs = [];
    const diag = all.filter((h) => h.step === '4a').at(-1)?.data?.diagnosis?.status;
    if (diag !== 'known') errs.push(`4a diagnosis is ${diag ?? 'missing'}, need known before step 4`);
    const verdict = all.filter((h) => h.step === '4b').at(-1)?.data?.audit?.verdict;
    const severity = all.filter((h) => h.step === '4a').at(-1)?.data?.diagnosis?.severity;
    if (skips.includes('4b') && severity && severity !== 'low') errs.push(`a cosmetic fix diagnosed with severity ${severity} is a bug: switch with checkpoint.mjs profile <dir> fix --scope bug and run the 4b audit`);
    if (verdict !== 'confirm' && !riskAccepted && (!skips.includes('4b') || (severity && severity !== 'low'))) errs.push(`4b audit is ${verdict ?? 'missing'}, need confirm (or the user's accepted risk in checkpoint ## Status) before step 4`);
    const fix = readIf(join(taskDir, 'fix.md'));
    for (const s of ['Cause', 'Repro']) if (!section(fix, s)?.trim()) errs.push(`fix.md ## ${s} is missing or empty`);
    add('fix lane', errs);
  }

  if (base) {
    let files = null;
    try { files = execFileSync('git', ['-c', 'core.quotePath=false', 'diff', '--name-only', `${base}...${head}`], { cwd: cwd ?? process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').filter(Boolean); }
    catch (e) { add('diff', [`git diff ${base}...${head} failed: ${String(e.stderr ?? e.message).trim()}`]); }
    if (files) {
      const own = readIf(join(taskDir, 'contract', 'ownership.md'));
      const c = classify(files, { ownershipRows: own ? parseOwnership(own) : [], smokeOnRecord: smokeOnRecord(brain) });
      const errs = [];
      if (c.smoke.required && skips.includes('3d') && profile !== 'fix') errs.push(`3d is skipped but a smoke trigger is true: ${c.smoke.reasons.join(', ')}`);
      if (laneSpec(profile, run.scope)?.maxFiles && STEP_ORDER.indexOf(String(step)) >= STEP_ORDER.indexOf('4')) errs.push(...laneVerdict(c, profile, run.scope).reasons.map((r) => `promote:full-flow: ${r}`));
      add('diff', errs);
    }
  }

  // what to do now: any loop verdict but accept wins (fix, retry, ask, escalate, block), then a lane promotion, then any failed check
  const failed = results.filter(([, e]) => e.length);
  const promote = results.some(([n, e]) => n === 'diff' && e.some((x) => x.startsWith('promote:')));
  const action = next !== 'accept' ? next
    : promote ? 'promote:full-flow'
    : failed.length ? `send-back:${failed.map(([n]) => n).join(',')}`
    : next === 'accept' ? 'proceed' : next;
  return { next: action, results, ok: !failed.length && action === 'proceed' };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const o = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) argv[i].startsWith('--') ? (o[argv[i].slice(2)] = argv[++i]) : pos.push(argv[i]);
  if (!pos[0] || !o.step || !o.round) {
    console.error('usage: check-all.mjs <.team/<task>> --step <s> --round <n> [--profile fix|change|verify|upgrade] [--skip a,b] [--brain <dir>] [--base <ref> [--head <ref>] [--cwd <repo>]]');
    process.exit(2);
  }
  const r = checkAll(pos[0], { step: o.step, round: o.round, profile: o.profile, skip: (o.skip ?? '').split(',').filter(Boolean), brain: o.brain, base: o.base, head: o.head, cwd: o.cwd });
  console.log(`next=${r.next}`);
  for (const [name, errs] of r.results) {
    console.log(`${errs.length ? 'FAIL' : 'ok  '} ${name}`);
    for (const e of errs) console.log(`  - ${e}`);
  }
  process.exit(r.ok ? 0 : 1);
}
