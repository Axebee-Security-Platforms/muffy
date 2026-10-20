#!/usr/bin/env node
// Usage: node check-ownership.mjs <.team/<task> dir>   (run in the feature worktree, before the step-5 merge)
// Compares what each owner branch changed with contract/ownership.md, so a conflict is caught before the merge:
//   out-of-lane  fe/<task> changed a file owned by BE or devops (and the reverse; ops/<task> likewise)
//   both         fe/<task> and be/<task> changed the same file, tests included
//   unowned      a changed source file no row covers: printed as a note for the architect, not a failure
//   stale-contract  the latest step-4 hand-off of fe or be names a contract_commit older than the last contract commit on feature/<task>
// Bases: ops/<task> against feature/<task>; fe and be against ops/<task> when it exists (they were cut from it), else feature/<task>.
// Tests (tests/, __tests__/, *.test.*, *.spec.*) and .team/ need no owner. No ownership.md (fix lane) → only `both` is checked.
// Exit 0 = ok, 1 = a conflict to send back to its owner before merging, 2 = bad usage or git error.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseOwnership, ownershipErrors, ownersOf } from './ownership.mjs';

const arg = process.argv[2];
if (!arg) {
  console.error('usage: check-ownership.mjs <.team/<task> dir>');
  process.exit(2);
}
const taskDir = resolve(arg);
const task = basename(taskDir);
const git = (...a) => spawnSync('git', a, { cwd: taskDir, encoding: 'utf8' });
const exists = (ref) => git('rev-parse', '--verify', '--quiet', `refs/heads/${ref}`).status === 0;
const isTest = (p) => /(^|\/)(tests?|__tests__)\//.test(p) || /\.(test|spec)\.[a-z]+$/i.test(p);
const isTeam = (p) => /(^|\/)\.team\//.test(p);

if (git('rev-parse', '--git-dir').status !== 0) {
  console.error(`not a git repository: ${taskDir}`);
  process.exit(2);
}
const feature = `feature/${task}`;
if (!exists(feature)) {
  console.error(`no branch ${feature}; run this from the task's feature worktree`);
  process.exit(2);
}
const ops = exists(`ops/${task}`) ? `ops/${task}` : null;
const lanes = [
  ['FE', `fe/${task}`, ops ?? feature],
  ['BE', `be/${task}`, ops ?? feature],
  ['devops', ops, feature],
].filter(([, branch]) => branch && exists(branch));

const changed = new Map();
for (const [owner, branch, base] of lanes) {
  const out = git('diff', '--name-only', `${base}...${branch}`);
  if (out.status !== 0) {
    console.error(`git diff ${base}...${branch} failed: ${out.stderr.trim()}`);
    process.exit(2);
  }
  changed.set(owner, out.stdout.split('\n').map((l) => l.trim()).filter((p) => p && !isTeam(p)));
}

const ownershipPath = join(taskDir, 'contract', 'ownership.md');
const rows = existsSync(ownershipPath) ? parseOwnership(readFileSync(ownershipPath, 'utf8')) : null;
const problems = rows ? ownershipErrors(rows) : [];
const notes = [];
if (!rows) notes.push('no contract/ownership.md: only files changed on both fe and be are checked');

const branchOf = Object.fromEntries(lanes.map(([o, b]) => [o, b]));
for (const [owner, files] of changed) {
  for (const f of files) {
    if (!rows || isTest(f)) continue;
    const owners = ownersOf(rows, f);
    if (!owners.length) notes.push(`unowned: ${f} (changed on ${branchOf[owner]}); ask the architect to add a row`);
    else if (!owners.includes(owner)) problems.push(`out-of-lane: ${branchOf[owner]} changed ${f}, owned by ${owners.join(', ')}`);
  }
}
const fe = new Set(changed.get('FE') ?? []);
for (const f of changed.get('BE') ?? []) if (fe.has(f)) problems.push(`both: ${f} changed on ${branchOf.FE} and ${branchOf.BE}; the file's owner keeps the change, the other side sends it as a blocker`);

// stale-contract: a step-4 hand-off built against an older contract than feature/<task> now holds
const prefix = git('rev-parse', '--show-prefix').stdout.trim().replace(/\/$/, ''); // .team/<task> relative to the repo root
const contractCommit = git('log', '-1', '--format=%H', feature, '--', `:/${prefix}/contract.md`, `:/${prefix}/contract`).stdout.trim();
const handoffDir = join(taskDir, 'handoff');
if (contractCommit && existsSync(handoffDir)) {
  for (const role of ['frontend-dev', 'backend-dev']) {
    const latest = readdirSync(handoffDir)
      .map((n) => n.match(new RegExp(`^4-${role}-r(\\d+)\\.json$`)))
      .filter(Boolean)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    if (!latest) continue;
    let built;
    try {
      built = JSON.parse(readFileSync(join(handoffDir, latest[0]), 'utf8')).contract_commit;
    } catch {
      notes.push(`${latest[0]} is not valid JSON; contract version not checked`);
      continue;
    }
    if (!built) notes.push(`${latest[0]} has no contract_commit; contract version not checked`);
    else if (!contractCommit.startsWith(built.toLowerCase())) problems.push(`stale-contract: ${latest[0]} was built against ${built}, but the contract on ${feature} is now ${contractCommit.slice(0, 7)}; send it back to re-read the contract`);
  }
}

for (const n of notes) console.log(`note: ${n}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`OK ${task}: ${lanes.map(([o, b]) => `${b} ${changed.get(o).length} file(s)`).join(', ') || 'no owner branches yet'}`);
