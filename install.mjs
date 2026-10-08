#!/usr/bin/env node
// Install or update the muffy agent team in another repo. Zero dependencies, Node 18+.
//   node install.mjs <target-repo> [--vault <absolute path>] [--dry-run] [--force] [--clean]
// Copies agents/ -> <target>/.claude/agents/ and skills/muffy/ -> <target>/.claude/skills/muffy/.
// Writes .claude/skills/muffy/VERSION and MANIFEST.json (the agent files this install owns).
// --clean removes the previous install first, including agent files that a newer version dropped.
// Creates .claude/settings.local.json only when missing, and adds ignore lines to .gitignore.
// Hooks are not added by default. --with-guard merges only the env guard into hooks.PreToolUse.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
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
const clean = flag('--clean');
const force = flag('--force') || clean; // --clean always replaces the files it installs
const vault = valueOf('--vault');
const withGuard = flag('--with-guard');

const log = (msg) => console.log(`${dryRun ? '[dry-run] ' : ''}${msg}`);
const warn = (msg) => console.warn(`warning: ${msg}`);
const die = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};
const rel = (p, base) => relative(base, p).split('\\').join('/') || '.';
const listFiles = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [rel(p, base)];
  });

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) die(`Node 18+ required, found ${process.versions.node}`);

if (flag('--help') || positional.length === 0) {
  console.log(`muffy ${pkg.version} installer

usage: node install.mjs <target-repo> [--vault <absolute path>] [--dry-run] [--force] [--clean] [--with-guard]

  --vault       path to the Obsidian vault (written to .claude/settings.local.json)
  --with-guard  merge the env guard (guard-env.mjs) into hooks.PreToolUse of .claude/settings.local.json
                never overwrites other keys; skipped with a message if PreToolUse already exists
  --dry-run     print what would change (incl. the hook JSON to merge), write nothing
  --force    overwrite .claude/agents and .claude/skills/muffy if they already exist
  --clean    update: remove the previous muffy install first (files from its MANIFEST.json,
             plus the whole .claude/skills/muffy folder), then install. Implies --force`);
  process.exit(positional.length === 0 && !flag('--help') ? 2 : 0);
}

const target = resolve(positional[0]);
if (!existsSync(target) || !statSync(target).isDirectory()) die(`target is not a directory: ${target}`);
if (!existsSync(join(target, '.git'))) warn(`${target} has no .git — run this from the repo root`);
if (vault && !existsSync(vault)) warn(`vault path does not exist yet: ${vault}`);

// settings are read before anything is written, so an unparseable file stops --with-guard early
const settingsPath = join(target, '.claude', 'settings.local.json');
const settingsExisted = existsSync(settingsPath);
let settings = null;
if (settingsExisted) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    if (withGuard) die(`${rel(settingsPath, target)} is not valid JSON; fix it, then re-run with --with-guard (nothing was changed)`);
  }
}

const agentsSrc = join(here, 'agents');
const agentsDst = join(target, '.claude', 'agents');
const skillSrc = join(here, 'skills', 'muffy');
const skillDst = join(target, '.claude', 'skills', 'muffy');
const manifestPath = join(skillDst, 'MANIFEST.json');
const packagedAgents = listFiles(agentsSrc);

// 1. --clean: remove what the previous install owned
if (clean) {
  const prev = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  if (prev) log(`previous install: muffy ${prev.version ?? 'unknown'}`);
  else warn('no MANIFEST.json from an earlier install: only files the new package ships are removed, older leftovers stay');
  const owned = [...new Set([...(prev?.agents ?? []), ...packagedAgents])];
  for (const f of owned) {
    const p = join(agentsDst, f);
    if (existsSync(p)) {
      log(`remove: ${rel(p, target)}`);
      if (!dryRun) rmSync(p, { force: true });
    }
  }
  if (existsSync(skillDst)) {
    log(`remove: ${rel(skillDst, target)}`);
    if (!dryRun) rmSync(skillDst, { recursive: true, force: true });
  }
}

// 2. agents and skill
const copy = (src, dst) => {
  if (existsSync(dst) && !force) {
    log(`skip (exists, use --force or --clean to overwrite): ${rel(dst, target)}`);
    return false;
  }
  log(`${existsSync(dst) ? 'overwrite' : 'copy'}: ${rel(src, here)} -> ${rel(dst, target)}`);
  if (!dryRun) cpSync(src, dst, { recursive: true });
  return true;
};
copy(agentsSrc, agentsDst);
const skillCopied = copy(skillSrc, skillDst);

// 3. version record, written only when the skill was (re)installed
if (skillCopied) {
  log(`write: ${rel(join(skillDst, 'VERSION'), target)} (${pkg.version})`);
  log(`write: ${rel(manifestPath, target)} (${packagedAgents.length} agent files)`);
  if (!dryRun) {
    writeFileSync(join(skillDst, 'VERSION'), `${pkg.version}\n`);
    writeFileSync(manifestPath, `${JSON.stringify({ version: pkg.version, agents: packagedAgents }, null, 2)}\n`);
  }
} else if (existsSync(join(skillDst, 'VERSION'))) {
  log(`installed version stays ${readFileSync(join(skillDst, 'VERSION'), 'utf8').trim()} (package is ${pkg.version}; use --clean to update)`);
}

// 4. personal settings: created when missing, never overwritten; --with-guard merges one hook key
const guardCommand = 'node .claude/skills/muffy/scripts/guard-env.mjs';
const guardEntry = { matcher: 'Read|Grep|Bash|PowerShell', hooks: [{ type: 'command', command: guardCommand }] };
let settingsChanged = false;
if (!settingsExisted) {
  settings = { env: { SECOND_BRAIN_VAULT: vault ?? '<absolute path to your Obsidian vault>' } };
  settingsChanged = true;
  log(`write: ${rel(settingsPath, target)}${vault ? '' : ' (vault placeholder — set it before the first run)'}`);
}
if (withGuard) {
  const pre = settings.hooks?.PreToolUse;
  if (pre === undefined) {
    settings.hooks = { ...(settings.hooks ?? {}), PreToolUse: [guardEntry] };
    settingsChanged = true;
    log(`merge: hooks.PreToolUse <- guard-env (${guardCommand})`);
    if (dryRun) console.log(JSON.stringify({ hooks: { PreToolUse: [guardEntry] } }, null, 2));
  } else if (JSON.stringify(pre).includes('guard-env.mjs')) {
    log('guard-env already in hooks.PreToolUse (nothing to merge)');
  } else {
    warn(`hooks.PreToolUse already exists in ${rel(settingsPath, target)}; not modified. Add this entry by hand:\n${JSON.stringify(guardEntry, null, 2)}`);
  }
}
if (settingsExisted && !settingsChanged) log(`keep existing ${rel(settingsPath, target)} (not modified)`);
if (settingsChanged && !dryRun) {
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

// 5. ignore lines: add only the ones missing
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

// 6. next steps
const hooks = JSON.parse(readFileSync(join(here, 'team-flow-settings-template.json'), 'utf8')).hooks;
console.log(`
Done${dryRun ? ' (dry run, nothing written)' : ''}. Remaining manual steps:

1. ${withGuard ? 'Env guard is in hooks.PreToolUse of .claude/settings.local.json (see messages above if it was skipped).' : 'Hooks are not installed. Re-run with --with-guard for the env guard, or add it yourself:\n     { "matcher": "Read|Grep|Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-env.mjs" } ] }'}
   - team-flow rules (${Object.keys(hooks).join(', ')}) are in team-flow-settings-template.json — merge the "hooks" key by hand.
2. Set SECOND_BRAIN_VAULT in .claude/settings.local.json if it still shows the placeholder.
3. Make sure the repo has docs/plan/, docs/adr/, docs/design-system/ (where the flow needs them) and .nvmrc if devops checks the runtime.
4. Start a feature from the main session: /muffy <feature request> with a kebab-case <task> name.`);
