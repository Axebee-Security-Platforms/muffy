#!/usr/bin/env node
// Removes a task's worktrees once their work is done. Orchestrator only; agents never remove a worktree.
//   --stage roles   ops, fe, be, qa: after the step 10 Human gate approves (steps.md)
//   --stage all     those and the feature worktree: at closing, after the closed checkpoint is committed (closing.md)
//
// Usage: node remove-worktrees.mjs <task> --stage roles|all [--check] [--cwd <repo>]
//   A worktree that does not exist is skipped. One that would lose work is kept and reported, never forced:
//     dirty        uncommitted or untracked files (gitignored files do not count, and are deleted with the worktree)
//     unreachable  detached HEAD on commits no branch holds
//     locked       git could not remove it (a running process or docker bind mount, or `git worktree lock`)
//     unregistered a folder under .worktrees/ that git does not list, such as what a failed removal left
//   Branches are never deleted: the user deploys from them. A role branch not merged into the task's branch is
//   reported as `unmerged: <branch>`, which does not block removal.
//   --check changes nothing and lists what is still there as `remaining=`.
// Prints `removed=… skipped=… kept=<path>:<reason>,…`. Exit 0 = nothing left behind, 1 = something kept or remaining, 2 = usage error.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mainCheckout } from './sync-worktree.mjs';

export const ROLES = ['ops', 'fe', 'be', 'qa'];
const names = (task, stage) => [...ROLES, ...(stage === 'all' ? ['feature'] : [])].map((r) => `${r}-${task}`);
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hasRef = (main, ref) => { try { git(main, 'rev-parse', '--verify', '--quiet', ref); return true; } catch { return false; } };

// `git worktree list --porcelain`: one blank-line separated block per worktree
function listWorktrees(main) {
  return git(main, 'worktree', 'list', '--porcelain').split(/\r?\n\r?\n/).map((block) => {
    const field = (k) => block.split(/\r?\n/).find((l) => l.startsWith(`${k} `))?.slice(k.length + 1).trim();
    return { path: field('worktree') ?? '', head: field('HEAD'), detached: /^detached$/m.test(block) };
  });
}

// matched by path, not branch: the verify lane's feature worktree is on verify/<task>
const findWorktree = (list, name) => list.find((w) => w.path.replace(/\\/g, '/').endsWith(`/.worktrees/${name}`));

// the task's worktrees of this stage that are still on disk, as `.worktrees/<name>`
export function remainingWorktrees(task, stage, cwd = process.cwd()) {
  const main = mainCheckout(cwd);
  const list = listWorktrees(main);
  return names(task, stage).filter((n) => { const w = findWorktree(list, n); return w ? existsSync(w.path) : existsSync(join(main, '.worktrees', n)); }).map((n) => `.worktrees/${n}`);
}

function unmergedBranches(main, task) {
  const target = [`feature/${task}`, `verify/${task}`].find((b) => hasRef(main, `refs/heads/${b}`));
  if (!target) return [];
  return ROLES.map((r) => `${r}/${task}`).filter((b) => {
    if (!hasRef(main, `refs/heads/${b}`)) return false;
    try { git(main, 'merge-base', '--is-ancestor', b, target); return false; } catch { return true; }
  });
}

export function removeWorktrees(task, stage, cwd = process.cwd()) {
  const main = mainCheckout(cwd);
  const list = listWorktrees(main);
  const out = { removed: [], skipped: [], kept: [], unmerged: unmergedBranches(main, task) };
  for (const name of names(task, stage)) {
    const rel = `.worktrees/${name}`;
    const w = findWorktree(list, name);
    if (!w) { if (existsSync(join(main, rel))) out.kept.push(`${rel}:unregistered`); else out.skipped.push(rel); continue; }
    if (!existsSync(w.path)) { out.skipped.push(rel); continue; } // deleted by hand: the prune below clears the entry
    if (git(w.path, 'status', '--porcelain')) { out.kept.push(`${rel}:dirty`); continue; }
    if (w.detached && !git(main, 'for-each-ref', '--contains', w.head, 'refs/heads')) { out.kept.push(`${rel}:unreachable`); continue; }
    try { git(main, 'worktree', 'remove', w.path); out.removed.push(rel); } catch { out.kept.push(`${rel}:locked`); }
  }
  git(main, 'worktree', 'prune');
  return out;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : undefined; };
  const stage = opt('--stage');
  const cwd = opt('--cwd') ?? process.cwd();
  const task = args.find((a, i) => !a.startsWith('--') && !['--stage', '--cwd'].includes(args[i - 1]));
  if (!task || !/^[\w.-]+$/.test(task) || task.startsWith('.') || !['roles', 'all'].includes(stage)) {
    console.error('usage: remove-worktrees.mjs <task> --stage roles|all [--check] [--cwd <repo>]');
    process.exit(2);
  }
  try {
    if (args.includes('--check')) {
      const left = remainingWorktrees(task, stage, cwd);
      console.log(`remaining=${left.join(',')}`);
      process.exit(left.length ? 1 : 0);
    }
    const r = removeWorktrees(task, stage, cwd);
    console.log(`removed=${r.removed.join(',')} skipped=${r.skipped.join(',')} kept=${r.kept.join(',')}`);
    for (const b of r.unmerged) console.log(`unmerged: ${b}`);
    process.exit(r.kept.length ? 1 : 0);
  } catch (e) { console.error(`remove-worktrees: ${String(e.stderr ?? e.message).trim()}`); process.exit(2); }
}
