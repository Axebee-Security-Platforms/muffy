#!/usr/bin/env node
// Usage: node check-checkpoint.mjs <.team/<task> dir>
//        node check-checkpoint.mjs --hook   (PostToolUse: reads hook JSON on stdin)
// Checks: checkpoint.md ≤ 40 lines (not counting ## Goal), rounds/*.md ≤ 100 lines,
//         every [label] used has one definition, every definition is used, targets exist,
//         spawns.tsv lines have 8 tab-separated columns, a pass|fail|blocked verdict and a note ending in
//         tok:<n> or tok:n/a (a closed task may not have n/a on more than half its spawns),
//         and the ## Status items baseline: and diagrams: have a known value.
// Exit 0 = ok, 2 = violation (errors printed one per line) or unreadable input.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CHECKPOINT_MAX = 40;
const ROUND_MAX = 100;
const SPAWN_COLS = 8; // step agent model effort round verdict reruns note
const SPAWN_VERDICTS = new Set(['pass', 'fail', 'blocked']);
const SPAWN_TOK = /(?:^|\s)tok:(\d+|n\/a)$/; // the note ends with the runtime's token count
const DEF =/^\[([A-Za-z0-9.-]+)\]:\s*(\S+)\s*$/;
const USE = /\[([A-Za-z0-9.-]+)\](?!\(|:)/g;

const NOT_LABELS = new Set(['verify', 'spike', 'x', 'assumed']); // inline markers, not links
// code is not prose: [x] inside fences or backtick spans (`[u8]`, `[ignore]`) is never a link label
const stripCode = (text) => text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '');
// ## Goal is copied verbatim and never summarized, so it does not count toward CHECKPOINT_MAX
const GOAL = /^## Goal[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/m;
const lineCount = (text) => (text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length);

// ## Status items that other steps read: key -> allowed value after "key:"
const STATUS_ITEMS = {
  baseline: /^(green|yellow|red)( .+)?$/i,
  diagrams: /^\d+ published$/i,
};

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
  const spawnsPath = join(taskDir, 'spawns.tsv');
  const status = cp.match(/^## Status[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? '';
  for (const [key, re] of Object.entries(STATUS_ITEMS)) {
    for (const m of status.matchAll(new RegExp(`(?:^|[\\s;·])${key}:[ \\t]*([^;·\\n]*)`, 'g'))) {
      if (!re.test(m[1].trim())) errors.push(`checkpoint ## Status: "${key}: ${m[1].trim()}" is not a recognised value`);
    }
  }
  if (/\bclosed\b/.test(status) && !existsSync(spawnsPath)) errors.push('checkpoint is closed but spawns.tsv is missing (log every spawn; closing needs it for ## Usage and Lessons)');
  if (existsSync(spawnsPath)) {
    let spawns = 0;
    let unknown = 0;
    const lastTok = new Map(); // tok is cumulative per agent: a later line of the same step and agent must not be lower
    readFileSync(spawnsPath, 'utf8').split('\n').forEach((line, i) => {
      if (!line.trim()) return;
      const cols = line.split('\t');
      if (cols.length !== SPAWN_COLS) return errors.push(`spawns.tsv line ${i + 1} has ${cols.length} columns (need ${SPAWN_COLS})`);
      if (!SPAWN_VERDICTS.has(cols[5])) errors.push(`spawns.tsv line ${i + 1} verdict "${cols[5]}" is not pass|fail|blocked`);
      const tok = cols[7].trim().match(SPAWN_TOK);
      if (!tok) return errors.push(`spawns.tsv line ${i + 1} note does not end with tok:<n> or tok:n/a`);
      spawns += 1;
      if (tok[1] === 'n/a') unknown += 1;
      else {
        const key = `${cols[0]}|${cols[1]}`;
        const n = Number(tok[1]);
        if (lastTok.has(key) && n < lastTok.get(key)) errors.push(`spawns.tsv line ${i + 1} tok:${n} is lower than the earlier ${cols[1]} step ${cols[0]} line (${lastTok.get(key)}); tok is cumulative per agent, copy the runtime count again`);
        lastTok.set(key, Math.max(n, lastTok.get(key) ?? 0));
      }
    });
    // n/a is only for a spawn the runtime gave no count for; a closed task where most are n/a was not copied
    if (/\bclosed\b/.test(status) && unknown * 2 > spawns) {
      errors.push(`spawns.tsv has tok:n/a on ${unknown} of ${spawns} spawns; copy the token count the runtime reported when each agent finished (n/a only when none was reported)`);
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
  const m = filePath.match(/^(.*[\\/]\.team[\\/][^\\/]+)[\\/](checkpoint\.md|spawns\.tsv|rounds[\\/][^\\/]+\.md)$/);
  if (!m) process.exit(0); // not a checkpoint, spawn log or round file
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
