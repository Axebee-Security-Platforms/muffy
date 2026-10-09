#!/usr/bin/env node
// Usage: node check-artifacts.mjs <.team/<task> dir>
//        node check-artifacts.mjs --hook   (PostToolUse: reads hook JSON on stdin)
// Checks the split hand-off artifacts (references/memory-model.md#splitting-large-artifacts):
//   ac.md, brief.md, contract.md ≤ 60 lines; files in ac/, brief/, contract/ ≤ 120 lines;
//   every [label] used has one definition, every definition is used, targets exist;
//   every AC id in ac.md appears in contract.md (when both exist).
// Exit 0 = ok, 2 = violation (errors printed one per line) or unreadable input.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MAIN_MAX = 60;
const PART_MAX = 120;
const MAINS = ['ac.md', 'brief.md', 'contract.md'];
const PART_DIRS = ['ac', 'brief', 'contract'];
const DEF = /^\[([A-Za-z0-9.-]+)\]:\s*(\S+)\s*$/;
const USE = /\[([A-Za-z0-9.-]+)\](?!\(|:)/g;
const NOT_LABELS = new Set(['verify', 'spike', 'x']); // inline markers, not links

const lineCount = (text) => (text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length);

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });

function checkLinks(taskDir, file, errors) {
  const name = relative(taskDir, file).split(sep).join('/');
  const defs = new Map();
  const body = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(DEF);
    if (m) defs.set(m[1], m[2]);
    else body.push(line);
  }
  const used = new Set();
  for (const m of body.join('\n').matchAll(USE)) if (!NOT_LABELS.has(m[1])) used.add(m[1]);
  for (const label of used) if (!defs.has(label)) errors.push(`${name}: [${label}] used but not defined`);
  for (const [label, target] of defs) {
    if (!used.has(label)) errors.push(`${name}: [${label}] defined but never used`);
    // targets resolve relative to the file that defines them
    if (!existsSync(join(file, '..', target))) errors.push(`${name}: [${label}] target missing: ${target}`);
  }
}

export function checkTask(taskDir) {
  const errors = [];
  const files = [];
  for (const m of MAINS) if (existsSync(join(taskDir, m))) files.push([join(taskDir, m), MAIN_MAX]);
  for (const d of PART_DIRS) {
    const dir = join(taskDir, d);
    if (existsSync(dir)) for (const p of walk(dir)) files.push([p, PART_MAX]);
  }
  for (const [file, max] of files) {
    const n = lineCount(readFileSync(file, 'utf8'));
    const name = relative(taskDir, file).split(sep).join('/');
    if (n > max) errors.push(`${name} has ${n} lines (max ${max})`);
    checkLinks(taskDir, file, errors);
  }

  const acPath = join(taskDir, 'ac.md');
  const contractPath = join(taskDir, 'contract.md');
  if (existsSync(acPath) && existsSync(contractPath)) {
    const ids = new Set(readFileSync(acPath, 'utf8').match(/AC-\d+/g) ?? []);
    const contract = readFileSync(contractPath, 'utf8');
    for (const id of ids) {
      if (!new RegExp(`\\b${id}\\b`).test(contract)) errors.push(`contract.md: ${id} from ac.md is not mapped`);
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
  const m = filePath.match(/^(.*[\\/]\.team[\\/][^\\/]+)[\\/](ac\.md|brief\.md|contract\.md|(ac|brief|contract)[\\/].+\.md)$/);
  if (!m) process.exit(0); // not a split artifact
  return m[1];
}

if (process.argv[1]?.endsWith('check-artifacts.mjs')) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: check-artifacts.mjs <.team/<task> dir> | --hook');
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
