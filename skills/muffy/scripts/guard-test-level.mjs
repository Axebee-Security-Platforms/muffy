#!/usr/bin/env node
// PreToolUse guard: holds qa-tester to the test level the Orchestrator set (references/test-levels.md,
// references/hooks-enforcement.md §11). Hook JSON arrives on stdin. Exit 2 = block, 0 = allow.
//
// The level is a file: `.team/<task>/test-level` containing L0, L1, L2, L3 or L4, written by the Orchestrator
// when it builds the qa-tester prompt. It is found from the hook's cwd upwards; a worktree named qa-<task> picks
// its own task, otherwise the most restrictive level among all tasks wins. No file = no ceiling (L3 rules).
//
// Ceilings (L4 needs the approval marker checked by guard-full-regression.mjs, nothing extra here):
//   L0  no test run at all (build and lint only); no creating or editing test files
//   L1  no integration or e2e run; no new files under e2e/, integration/, playwright/, cypress/ and no runner config
//   L2  no limits beyond scoping (whole-suite runs are guard-full-regression's job)
//   L3  same as L2
// Only calls with agent_type qa-tester are checked. Known limits: see test-runners.mjs; a test file written
// through the shell (echo > x.test.ts) is already blocked for doc agents only, not here.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { kindOf, parseSegment, splitCommand } from './test-runners.mjs';
import { guardOff } from './plugin-gate.mjs';

if (guardOff()) process.exit(0); // plugin install without MUFFY_GUARD=1: the project did not opt in

const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|[\\/])(__tests__|tests?)[\\/]|(^|[\\/])test_[^\\/]+\.py$|_test\.(go|py)$|(Test|Tests)\.(java|kt|cs)$|_spec\.rb$/i;
const SUITE_PATH = /(^|[\\/])(e2e|integration|playwright|cypress)([\\/]|\.|-|$)|(playwright|cypress|vitest\.e2e)\.config\./i;

// Where the task's markers may live: each `.worktrees/feature-<name>/.team` (the authoritative copy, setup.md
// step 7), then the main checkout's `.team`. A qa worktree's own `.team` is skipped: a committed copy there
// can be stale.
const teamDirs = (start) => {
  const out = [];
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    const wt = join(dir, '.worktrees');
    if (existsSync(wt)) for (const w of readdirSync(wt)) if (w.startsWith('feature-')) out.push(join(wt, w, '.team'));
    if (basename(dirname(dir)) !== '.worktrees') out.push(join(dir, '.team'));
    if (dirname(dir) === dir) return out;
  }
};

const level = (start) => {
  const rank = (l) => Number(String(l).trim().replace(/^L/i, ''));
  const resolved = resolve(start);
  const fromWorktree = resolved.split(sep).map((p) => p.match(/^qa-(.+)$/)?.[1]).find(Boolean);
  // The first team with a level for this task wins: the feature worktree's copy comes before the main checkout's.
  for (const team of teamDirs(start)) {
    if (!existsSync(team)) continue;
    try {
      const files = readdirSync(team)
        .filter((t) => existsSync(join(team, t, 'test-level')))
        .map((t) => [t, readFileSync(join(team, t, 'test-level'), 'utf8').trim()]);
      const own = files.find(([t]) => t === fromWorktree);
      const pick = own ? [own] : files;
      const ranks = pick.map(([, l]) => rank(l)).filter((n) => n >= 0 && n <= 4);
      if (ranks.length) return Math.min(...ranks);
    } catch { /* unreadable: no ceiling */ }
  }
  return null;
};

const block = (why, lvl) => {
  console.error(
    `[muffy] blocked: ${why}. Your test level is L${lvl} (references/test-levels.md). Stay within it; if a higher level is needed, say so under "## Full regression" or the coverage table in qa-report.md and in your final message; the Orchestrator decides.`,
  );
  process.exit(2);
};

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // cannot tell who is calling: nothing to guard
}
if (String(input.agent_type ?? '').split(':').pop() !== 'qa-tester') process.exit(0);

const tool = input.tool_name ?? '';
const lvl = level(input.cwd ?? process.cwd());
if (lvl === null || lvl >= 2) process.exit(0);

if (tool === 'Bash' || tool === 'PowerShell') {
  for (const seg of splitCommand(String(input.tool_input?.command ?? ''))) {
    const run = parseSegment(seg);
    if (!run) continue;
    if (lvl === 0) block(`"${seg}" runs tests, and L0 allows build and lint only`, lvl);
    if (run.kind !== 'unit') block(`"${seg}" runs ${run.kind} tests, and L1 allows unit tests only`, lvl);
  }
}

if (tool === 'Write' || tool === 'Edit') {
  const file = String(input.tool_input?.file_path ?? '');
  if (lvl === 0 && TEST_FILE.test(file)) block(`${basename(file)} is a test file, and L0 adds no tests`, lvl);
  if (lvl <= 1 && SUITE_PATH.test(file)) block(`${file} belongs to an ${kindOf(file)} suite, and L${lvl} adds none`, lvl);
}
process.exit(0);
