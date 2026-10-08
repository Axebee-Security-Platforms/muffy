#!/usr/bin/env node
// Install the muffy agent team into another repo. Zero dependencies, Node 18+.
//   node install.mjs <target-repo> [--vault <absolute path>] [--dry-run] [--force]
// Copies agents/ -> <target>/.claude/agents/ and skills/muffy/ -> <target>/.claude/skills/muffy/.
// Creates .claude/settings.local.json only when missing, and adds ignore lines to .gitignore.
// It never edits hooks: the snippets to add by hand are printed at the end.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--vault');
const dryRun = flag('--dry-run');
const force = flag('--force');
const vault = valueOf('--vault');

const log = (msg) => console.log(`${dryRun ? '[dry-run] ' : ''}${msg}`);
const warn = (msg) => console.warn(`warning: ${msg}`);
const die = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};
const rel = (p, base) => relative(base, p).split('\\').join('/') || '.';

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) die(`Node 18+ required, found ${process.versions.node}`);

if (flag('--help') || positional.length === 0) {
  console.log(`muffy ${pkg.version} installer

usage: node install.mjs <target-repo> [--vault <absolute path>] [--dry-run] [--force]

  --vault    path to the Obsidian vault (written to .claude/settings.local.json)
  --dry-run  print what would change, write nothing
  --force    overwrite .claude/agents and .claude/skills/muffy if they already exist`);
  process.exit(positional.length === 0 && !flag('--help') ? 2 : 0);
}

const target = resolve(positional[0]);
if (!existsSync(target) || !statSync(target).isDirectory()) die(`target is not a directory: ${target}`);
if (!existsSync(join(target, '.git'))) warn(`${target} has no .git — run this from the repo root`);
if (vault && !existsSync(vault)) warn(`vault path does not exist yet: ${vault}`);

// 1. agents and skill
const copy = (src, dst) => {
  if (existsSync(dst) && !force) {
    log(`skip (exists, use --force to overwrite): ${rel(dst, target)}`);
    return;
  }
  log(`${existsSync(dst) ? 'overwrite' : 'copy'}: ${rel(src, here)} -> ${rel(dst, target)}`);
  if (!dryRun) cpSync(src, dst, { recursive: true });
};
copy(join(here, 'agents'), join(target, '.claude', 'agents'));
copy(join(here, 'skills', 'muffy'), join(target, '.claude', 'skills', 'muffy'));

// 2. personal settings: only when missing, never overwritten
const settingsPath = join(target, '.claude', 'settings.local.json');
if (existsSync(settingsPath)) {
  log(`keep existing ${rel(settingsPath, target)} (not modified)`);
} else {
  const settings = { env: { SECOND_BRAIN_VAULT: vault ?? '<absolute path to your Obsidian vault>' } };
  log(`write: ${rel(settingsPath, target)}${vault ? '' : ' (vault placeholder — set it before the first run)'}`);
  if (!dryRun) {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  }
}

// 3. ignore lines: add only the ones missing
const ignoreLines = ['.claude/settings.local.json', '.worktrees/', '.team/**/diff*.patch'];
const gitignore = join(target, '.gitignore');
const current = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : '';
const missing = ignoreLines.filter((l) => !current.split(/\r?\n/).includes(l));
if (missing.length) {
  log(`add to .gitignore: ${missing.join(', ')}`);
  if (!dryRun) {
    const sep = current === '' || current.endsWith('\n') ? '' : '\n';
    writeFileSync(gitignore, `${current}${sep}# muffy\n${missing.join('\n')}\n`);
  }
} else {
  log('.gitignore already has the muffy ignore lines');
}

// 4. next steps
const hooks = JSON.parse(readFileSync(join(here, 'team-flow-settings-template.json'), 'utf8')).hooks;
console.log(`
Done${dryRun ? ' (dry run, nothing written)' : ''}. Remaining manual steps:

1. Hooks are not installed. Add them to .claude/settings.local.json yourself:
   - env guard (blocks reading .env* in full), PreToolUse:
     { "matcher": "Read|Grep|Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-env.mjs" } ] }
   - team-flow rules (${Object.keys(hooks).join(', ')}) are in team-flow-settings-template.json — merge the "hooks" key by hand.
2. Set SECOND_BRAIN_VAULT in .claude/settings.local.json if it still shows the placeholder.
3. Make sure the repo has docs/plan/, docs/adr/, docs/design-system/ (where the flow needs them) and .nvmrc if devops checks the runtime.
4. Start a feature from the main session: /muffy <feature request> with a kebab-case <task> name.`);
