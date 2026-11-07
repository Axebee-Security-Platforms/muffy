#!/usr/bin/env node
// Makes a task worktree run the same muffy skill files as the main checkout. A worktree is cut from a commit, so
// it carries whatever copy of `.claude/skills/muffy/` was committed then; a script staged in the main checkout
// afterwards (a newer validate-handoff.mjs, checkpoint.mjs) is missing or stale there.
//
// Usage: node sync-worktree.mjs <worktree> [--check]
//   copies every file under the main checkout's .claude/skills/muffy/ that is missing or differs in <worktree>,
//   then prints `synced N file(s)` and lists them; commit them as the worktree's first commit
//   (`chore(muffy): sync skill scripts`). --check copies nothing, lists the differences and exits 1 if there are any.
// The main checkout is the first entry of `git worktree list`. Files only the worktree has are left alone.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SKILL = join('.claude', 'skills', 'muffy');

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// the main checkout is always the first entry of `git worktree list`, from any worktree of the repo
export function mainCheckout(cwd) {
  const list = execFileSync('git', ['-C', cwd, 'worktree', 'list', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const main = list.split('\n').find((l) => l.startsWith('worktree '))?.slice(9).trim();
  if (!main) throw new Error('cannot find the main checkout (git worktree list)');
  return main;
}

export function syncWorktree(worktree, { check = false } = {}) {
  const wt = resolve(worktree);
  if (!existsSync(join(wt, '.git'))) throw new Error(`${wt} is not a git worktree`);
  const main = mainCheckout(wt);
  if (resolve(main) === wt) throw new Error('that is the main checkout, not a task worktree');
  const src = join(main, SKILL);
  if (!existsSync(src)) throw new Error(`no ${SKILL} in the main checkout ${main}`);
  const changed = [];
  for (const file of walk(src)) {
    const rel = relative(src, file);
    const dest = join(wt, SKILL, rel);
    if (existsSync(dest) && readFileSync(dest).equals(readFileSync(file))) continue;
    changed.push(rel);
    if (!check) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(file, dest); }
  }
  return changed;
}

if (resolve(process.argv[1] ?? '') === resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) { console.error('usage: sync-worktree.mjs <worktree> [--check]'); process.exit(2); }
  try {
    const changed = syncWorktree(target, { check });
    if (check) {
      console.log(changed.length ? `stale: ${changed.length} file(s) differ from the main checkout\n${changed.join('\n')}` : 'OK worktree matches the main checkout');
      process.exit(changed.length ? 1 : 0);
    }
    console.log(`OK synced ${changed.length} file(s)${changed.length ? `\n${changed.join('\n')}` : ''}`);
  } catch (e) { console.error(`sync-worktree: ${e.message}`); process.exit(2); }
}
