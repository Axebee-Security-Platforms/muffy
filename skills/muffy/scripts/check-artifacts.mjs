#!/usr/bin/env node
// Usage: node check-artifacts.mjs <.team/<task> dir>
//        node check-artifacts.mjs --hook   (PostToolUse: reads hook JSON on stdin; checks only the artifact that was written)
// Checks the split hand-off artifacts (references/memory-model.md#splitting-large-artifacts):
//   ac.md, brief.md, contract.md, fix.md ≤ 60 lines; files in ac/, brief/, contract/ ≤ 120 lines;
//   every [label] used (outside code fences and backticks) has one definition, every definition is used, targets exist;
//   every AC id in ac.md appears in contract.md or a file under contract/ (when ac.md and contract.md exist);
//   contract.md: the ## Cost summary starts with `Budget: none|within|over|unknown|unlimited` (over/unknown name a cheaper option);
//   the Stack's `Platform:` is web|mobile|desktop|cli, and cli has contract/cli.md;
//   contract/ownership.md: every row has one owner (FE, BE or devops) and no two owners' patterns overlap;
//   deploy.md: ## Chosen infra, ## Infra cost, ## Practices and ## Risks exist, ## Infra options only when the checkpoint says `infra: propose`,
//   and every `gap (<risk>)` under Practices appears under Risks.
// Exit 0 = ok, 2 = violation (errors printed one per line) or unreadable input.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadExtensions } from './repo-facts.mjs';
import { parseOwnership, ownershipErrors } from './ownership.mjs';

const MAIN_MAX = 60;
const PART_MAX = 120;
const MAINS = ['ac.md', 'brief.md', 'contract.md', 'fix.md'];
const PART_DIRS = ['ac', 'brief', 'contract'];
const DEF = /^\[([A-Za-z0-9.-]+)\]:\s*(\S+)\s*$/;
const USE = /\[([A-Za-z0-9.-]+)\](?!\(|:)/g;
const NOT_LABELS = new Set(['verify', 'spike', 'x', 'assumed']); // inline markers, not links
// code is not prose: [x] inside fences or backtick spans (`[u8]`, `[ignore]`) is never a link label
const stripCode = (text) => text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '');

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
  for (const line of stripCode(readFileSync(file, 'utf8')).split('\n')) {
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

const BUDGET = /^Budget:\s*(none|within|over|unknown|unlimited)\b/i;
const PLATFORMS = new Set(['web', 'mobile', 'desktop', 'cli']);
const section = (text, heading) => text.match(new RegExp(`^## ${heading}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'mi'))?.[1] ?? null;

function checkContract(taskDir, errors) {
  const contractPath = join(taskDir, 'contract.md');
  if (!existsSync(contractPath)) return;
  const contract = readFileSync(contractPath, 'utf8');
  const cost = section(contract, 'Cost');
  if (cost === null) errors.push('contract.md has no ## Cost section');
  else {
    const first = cost.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).find(Boolean) ?? '';
    const m = first.match(BUDGET);
    if (!m) errors.push('contract.md ## Cost must start with "Budget: none|within|over|unknown|unlimited"');
    else if (/^(over|unknown)$/i.test(m[1]) && !/cheaper/i.test(first)) errors.push(`contract.md ## Cost says Budget: ${m[1].toLowerCase()} but names no cheaper option`);
  }
  const contractDir = join(taskDir, 'contract');
  const ownershipPath = join(contractDir, 'ownership.md');
  if (existsSync(ownershipPath)) errors.push(...ownershipErrors(parseOwnership(readFileSync(ownershipPath, 'utf8'))));
  const all = [contract, ...(existsSync(contractDir) ? walk(contractDir).map((p) => readFileSync(p, 'utf8')) : [])].join('\n');
  const platform = all.match(/\bPlatform:\s*([A-Za-z-]+)/)?.[1]?.toLowerCase();
  if (platform) {
    if (!PLATFORMS.has(platform) && !loadExtensions(join(taskDir, '..', '..')).platforms.includes(platform)) errors.push(`contract: Platform "${platform}" is not web, mobile, desktop or cli (or listed in .team/stack-extensions.json)`);
    else if (platform === 'cli' && !existsSync(join(contractDir, 'cli.md'))) errors.push('contract: Platform cli needs contract/cli.md (commands, flags, exit codes)');
  }
}

function checkDeploy(taskDir, errors) {
  const deployPath = join(taskDir, 'deploy.md');
  if (!existsSync(deployPath)) return;
  const deploy = readFileSync(deployPath, 'utf8');
  for (const h of ['Chosen infra', 'Infra cost', 'Practices', 'Risks']) if (section(deploy, h) === null) errors.push(`deploy.md has no ## ${h} section`);
  const cpPath = join(taskDir, 'checkpoint.md');
  const cp = existsSync(cpPath) ? readFileSync(cpPath, 'utf8') : null;
  const infra = cp?.match(/\binfra:\s*([a-z-]+)/i)?.[1]?.toLowerCase();
  // setup copies a recorded answer into every task's checkpoint; without it the Infra options rule below cannot be checked
  if (cp !== null && !infra) errors.push('checkpoint.md has no infra: line in ## Status, so deploy.md ## Infra options cannot be checked (setup copies the recorded answer)');
  const hasOptions = section(deploy, 'Infra options') !== null;
  if (infra === 'propose' && !hasOptions) errors.push('deploy.md needs ## Infra options (checkpoint says infra: propose)');
  if (infra && infra !== 'propose' && hasOptions) errors.push(`deploy.md has ## Infra options but the checkpoint says infra: ${infra}; options are proposed only for infra: propose`);
  const risks = section(deploy, 'Risks') ?? '';
  for (const g of (section(deploy, 'Practices') ?? '').matchAll(/gap \(([^)]+)\)/g)) {
    if (!risks.toLowerCase().includes(g[1].trim().toLowerCase())) errors.push(`deploy.md: practice gap "${g[1].trim()}" is not listed under ## Risks`);
  }
}

// scope: 'all' (the CLI) or the artifact a hook saw written: 'ac', 'brief', 'contract', 'fix' or 'deploy'. A hook checks only the
// written artifact, so the architect writing contract.md never gets errors about devops' half-written deploy.md, or the reverse.
export function checkTask(taskDir, scope = 'all') {
  const errors = [];
  const files = [];
  const inScope = (name) => scope === 'all' || scope === name;
  for (const m of MAINS) if (inScope(m.replace(/\.md$/, '')) && existsSync(join(taskDir, m))) files.push([join(taskDir, m), MAIN_MAX]);
  for (const d of PART_DIRS) {
    const dir = join(taskDir, d);
    if (inScope(d) && existsSync(dir)) for (const p of walk(dir)) files.push([p, PART_MAX]);
  }
  for (const [file, max] of files) {
    const n = lineCount(readFileSync(file, 'utf8'));
    const name = relative(taskDir, file).split(sep).join('/');
    if (n > max) errors.push(`${name} has ${n} lines (max ${max})`);
    checkLinks(taskDir, file, errors);
  }

  const acPath = join(taskDir, 'ac.md');
  const contractPath = join(taskDir, 'contract.md');
  if (inScope('contract') && existsSync(acPath) && existsSync(contractPath)) {
    const ids = new Set(readFileSync(acPath, 'utf8').match(/AC-\d+/g) ?? []);
    const contractDir = join(taskDir, 'contract');
    const contract = [contractPath, ...(existsSync(contractDir) ? walk(contractDir) : [])].map((p) => readFileSync(p, 'utf8')).join('\n');
    for (const id of ids) {
      if (!new RegExp(`\\b${id}\\b`).test(contract)) errors.push(`contract: ${id} from ac.md is not mapped in contract.md or contract/`);
    }
  }
  if (inScope('contract')) checkContract(taskDir, errors);
  if (inScope('deploy')) checkDeploy(taskDir, errors);
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
  const m = filePath.match(/^(.*[\\/]\.team[\\/][^\\/]+)[\\/](ac\.md|brief\.md|contract\.md|fix\.md|deploy\.md|(ac|brief|contract)[\\/].+\.md)$/);
  if (!m) process.exit(0); // not a split artifact
  return { taskDir: m[1], scope: m[2].split(/[\\/.]/)[0] };
}

if (process.argv[1]?.endsWith('check-artifacts.mjs')) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: check-artifacts.mjs <.team/<task> dir> | --hook');
    process.exit(2);
  }
  const { taskDir, scope } = arg === '--hook' ? fromHook() : { taskDir: arg, scope: 'all' };
  const errors = checkTask(taskDir, scope);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(2);
  }
  console.log(`OK ${taskDir}`);
}
