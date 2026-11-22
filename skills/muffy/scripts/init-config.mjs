#!/usr/bin/env node
// Creates `<repo>/.team/config.json` with the project's test command, so the step 7 test gate (test-gate.mjs) has one.
// Run at setup (references/setup.md step 4) and by onboard. Reads `package.json` → `scripts.test`; never runs anything.
// Usage: node init-config.mjs [repo-root]
//   - an existing `test_command` is never overwritten (the user's value wins); other keys in the file are kept
//   - the package manager comes from the lockfile: pnpm-lock.yaml → `pnpm test`, yarn.lock → `yarn test`, bun.lock(b) → `bun test`, else `npm test`
//   - npm's placeholder (`echo "Error: no test specified" && exit 1`) or no `scripts.test` → nothing written for it
// Prints one line: `test_command: <cmd> (from package.json)`, `test_command: <cmd> (kept)` or `test_command: none found`.
// Exit 0 always (a missing command is not an error: the gate reports itself skipped), 2 = bad usage.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
if (args.length > 1 || args.some((a) => a.startsWith('--'))) { console.error('usage: init-config.mjs [repo-root]'); process.exit(2); }
const root = resolve(args[0] ?? '.');
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

export const PLACEHOLDER = /no test specified/i;
export function detectTestCommand(dir) {
  const test = readJson(join(dir, 'package.json'))?.scripts?.test;
  if (typeof test !== 'string' || !test.trim() || PLACEHOLDER.test(test)) return null;
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm test';
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn test';
  if (existsSync(join(dir, 'bun.lock')) || existsSync(join(dir, 'bun.lockb'))) return 'bun run test';
  return 'npm test';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = join(root, '.team', 'config.json');
  const config = existsSync(file) ? readJson(file) : {};
  if (config === null) { console.log(`test_command: unchanged (${file} is not valid JSON; fix it by hand)`); process.exit(0); }
  if (typeof config.test_command === 'string' && config.test_command.trim()) {
    console.log(`test_command: ${config.test_command} (kept)`);
  } else {
    const found = detectTestCommand(root);
    if (!found) console.log('test_command: none found (no scripts.test in package.json); the step 7 test gate will report itself skipped until you set one in .team/config.json');
    else {
      mkdirSync(join(root, '.team'), { recursive: true });
      writeFileSync(file, `${JSON.stringify({ ...config, test_command: found }, null, 2)}\n`);
      console.log(`test_command: ${found} (from package.json) → .team/config.json`);
    }
  }
}
