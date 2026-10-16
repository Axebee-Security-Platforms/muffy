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
import { dirname, join, resolve } from 'node:path';

const FILTER_FLAG = /^(-t|-g|-k|-m|--grep|--filter|--testNamePattern|--test-name-pattern|--testPathPattern|--project|--shard|--changedSince|--onlyChanged|--only-changed|--findRelatedTests|--lf|--ff|--last-failed|--failed-first|--spec|--specs|--tag|--tags|--include|--files?)(=|$)/;
// runner (after an optional npx/pnpm exec/yarn/bunx/python -m) followed by its own args
const RUNNERS = [
  /^(?:npx\s+|pnpm\s+(?:exec\s+)?|yarn\s+(?:run\s+)?|bunx\s+)?(vitest|jest|mocha|ava|playwright\s+test|cypress\s+run|karma\s+start|tap)(\s.*)?$/,
  /^(?:python3?\s+-m\s+|uv\s+run\s+|poetry\s+run\s+)?(pytest|unittest|nose2|tox)(\s.*)?$/,
  /^(go\s+test|cargo\s+test|cargo\s+nextest\s+run|dotnet\s+test|mvn\s+(?:\S+\s+)*?test|\.\/gradlew\s+test|gradle\s+test|rspec|phpunit|bundle\s+exec\s+rspec|make\s+test|mix\s+test|swift\s+test|deno\s+test|bun\s+test)(\s.*)?$/,
];
// package-manager scripts that mean "everything"
const WIDE_SCRIPT = /^(test|test:all|test:e2e|test:ci|test:full|test:regression|e2e|ci|regression|verify)$/;
const PM = /^(npm|pnpm|yarn|bun)\s+(?:run\s+)?([\w:.-]+)(\s.*)?$/;

const block = (seg) => {
  console.error(
    `[muffy] blocked: "${seg}" runs the whole-system suite and the user has not approved it. Run only this task's tests, selected by path, name or filter. If a wider run is needed, put the command, what it covers, why and the rough duration under "## Full regression" in qa-report.md and say so in your final message; the Orchestrator asks the user (pause:full-regression).`,
  );
  process.exit(2);
};

const isScoped = (args) => {
  const toks = args.trim().split(/\s+/).filter(Boolean);
  if (/^(run|watch|test|start)$/.test(toks[0] ?? '')) toks.shift(); // runner subcommand (vitest run), not a path
  const afterDashes = toks.includes('--') ? toks.slice(toks.indexOf('--') + 1) : toks;
  return afterDashes.some((t) => FILTER_FLAG.test(t) || !t.startsWith('-')); // any path/pattern, or a filter flag
};

const wide = (seg, extra) => {
  if (extra.some((re) => re.test(seg))) return true;
  const pm = seg.match(PM);
  if (pm) return WIDE_SCRIPT.test(pm[2]) && !isScoped(pm[3] ?? '');
  for (const re of RUNNERS) {
    const m = seg.match(re);
    if (!m) continue;
    const args = m[2] ?? '';
    if (m[1] === 'go test') return /(^|\s)\.\/\.\.\.(\s|$)/.test(args) || !isScoped(args); // ./... is every package
    return !isScoped(args);
  }
  return false;
};

const approved = (start) => {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    const team = join(dir, '.team');
    if (existsSync(team)) {
      try {
        for (const t of readdirSync(team)) if (existsSync(join(team, t, 'full-regression.approved'))) return true;
      } catch { /* unreadable: treat as not approved */ }
    }
    if (dirname(dir) === dir) return false;
  }
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
const segments = cmd.split(/&&|\|\||[;|\n]/).map((s) => s.trim().replace(/^(cd\s+\S+\s*)$/, '')).filter(Boolean);
const hit = segments.find((s) => wide(s, extra));
if (hit && !approved(cwd)) block(hit);
process.exit(0);
