#!/usr/bin/env node
// PreToolUse guard: stops qa-tester from running a whole-system test suite unless the user approved it
// (references/hooks-enforcement.md §10, references/run-profile.md pause:full-regression).
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the agent), 0 = allow.
//
// Approval = a marker file `.team/<task>/full-regression.approved` that the Orchestrator writes after the user
// says yes at pause:full-regression (and deletes when the run is over). It is looked up from the hook's cwd
// upwards, so a qa worktree under `.worktrees/` still finds the repo's `.team/`.
//
// What counts as whole-system: a test runner started with no path, name or filter (a bare `npm test`,
// `pytest`, `playwright test`, `go test ./...`), or a script named test:all / test:e2e / ci / regression.
// Project-specific commands go in `.team/regression-commands.json` as an array of regex strings.
// Known limits: a runner reached through a wrapper script the patterns don't know, `node -e`, or a filter
// flag's value mistaken for a path (fails open). Only calls with agent_type qa-tester are checked.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { parseSegment, splitCommand } from './test-runners.mjs';

const block = (seg) => {
  console.error(
    `[muffy] blocked: "${seg}" runs the whole-system suite and the user has not approved it. Run only this task's tests, selected by path, name or filter. If a wider run is needed, put the command, what it covers, why and the rough duration under "## Full regression" in qa-report.md and say so in your final message; the Orchestrator asks the user (pause:full-regression).`,
  );
  process.exit(2);
};

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

// Approval belongs to one task: only a qa worktree named qa-<task> can use `.team/<task>/full-regression.approved`.
// Another task's marker, or a cwd with no task name, does not unlock the full suite.
const approved = (start) => {
  const task = resolve(start).split(sep).map((p) => p.match(/^qa-(.+)$/)?.[1]).find(Boolean);
  if (!task) return false;
  return teamDirs(start).some((team) => existsSync(join(team, task, 'full-regression.approved')));
};

const extraPatterns = (start) => {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    const f = join(dir, '.team', 'regression-commands.json');
    if (existsSync(f)) {
      try { return JSON.parse(readFileSync(f, 'utf8')).map((s) => new RegExp(s)); } catch { return []; }
    }
    if (dirname(dir) === dir) return [];
  }
};

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // cannot tell who is calling: nothing to guard
}
if (!['Bash', 'PowerShell'].includes(input.tool_name ?? '')) process.exit(0);
if (String(input.agent_type ?? '').split(':').pop() !== 'qa-tester') process.exit(0);

const cwd = input.cwd ?? process.cwd();
const cmd = String(input.tool_input?.command ?? '');
const extra = extraPatterns(cwd);
const hit = splitCommand(cmd).find((seg) => parseSegment(seg, extra)?.whole);
if (hit && !approved(cwd)) block(hit);
process.exit(0);
