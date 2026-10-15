#!/usr/bin/env node
// Usage: node check-checkpoint.mjs <.team/<task> dir>
//        node check-checkpoint.mjs --hook   (PostToolUse: reads hook JSON on stdin)
// Checks: checkpoint.md ≤ 40 lines (not counting ## Goal), rounds/*.md ≤ 100 lines,
//         every [label] used has one definition, every definition is used, targets exist.
// Exit 0 = ok, 2 = violation (errors printed one per line) or unreadable input.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CHECKPOINT_MAX = 40;
const ROUND_MAX = 100;
const DEF = /^\[([A-Za-z0-9.-]+)\]:\s*(\S+)\s*$/;
const USE = /\[([A-Za-z0-9.-]+)\](?!\(|:)/g;

const NOT_LABELS = new Set(['verify', 'spike', 'x', 'assumed']); // inline markers, not links
// code is not prose: [x] inside fences or backtick spans (`[u8]`, `[ignore]`) is never a link label
const stripCode = (text) => text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '');
// ## Goal is copied verbatim and never summarized, so it does not count toward CHECKPOINT_MAX
const GOAL = /^## Goal[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/m;
const lineCount = (text) => (text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length);

export function checkTask(taskDir) {
  const errors = [];
  const cpPath = join(taskDir, 'checkpoint.md');
  if (!existsSync(cpPath)) return [`missing ${cpPath}`];

  const cp = readFileSync(cpPath, 'utf8');
  const goal = cp.match(GOAL)?.[0];
  const counted = lineCount(cp) - (goal ? lineCount(goal) : 0);
  if (counted > CHECKPOINT_MAX) {
    errors.push(`checkpoint.md has ${counted} lines outside ## Goal (max ${CHECKPOINT_MAX})`);
  }

  const defs = new Map();
  const body = [];
  for (const line of stripCode(cp).split('\n')) {
    const m = line.match(DEF);
    if (m) defs.set(m[1], m[2]);
    else body.push(line);
  }
  const used = new Set();
  for (const m of body.join('\n').matchAll(USE)) if (!NOT_LABELS.has(m[1])) used.add(m[1]);

  for (const label of used) {
    if (!defs.has(label)) errors.push(`[${label}] used in checkpoint.md but not defined`);
  }
  for (const [label, target] of defs) {
    if (!used.has(label)) errors.push(`[${label}] defined but never used`);
    if (!existsSync(join(taskDir, target))) errors.push(`[${label}] target missing: ${target}`);
  }

  const roundsDir = join(taskDir, 'rounds');
  if (existsSync(roundsDir)) {
    for (const f of readdirSync(roundsDir).filter((n) => n.endsWith('.md'))) {
      const n = lineCount(readFileSync(join(roundsDir, f), 'utf8'));
      if (n > ROUND_MAX) errors.push(`rounds/${f} has ${n} lines (max ${ROUND_MAX})`);
    }
  }
  return errors;
}

function fromHook() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch (e) {
    console.error(`cannot read hook input: ${e.message}`);
    process.exit(2);
  }
  const filePath = input?.tool_input?.file_path ?? '';
  const m = filePath.match(/^(.*[\\/]\.team[\\/][^\\/]+)[\\/](checkpoint\.md|rounds[\\/][^\\/]+\.md)$/);
  if (!m) process.exit(0); // not a checkpoint or round file
  return m[1];
}

if (process.argv[1]?.endsWith('check-checkpoint.mjs')) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: check-checkpoint.mjs <.team/<task> dir> | --hook');
    process.exit(2);
  }
  const taskDir = arg === '--hook' ? fromHook() : arg;
  const errors = checkTask(taskDir);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(2);
  }
  console.log(`OK ${taskDir}`);
}
