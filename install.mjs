#!/usr/bin/env node
// Install or update the muffy agent team in another repo. Zero dependencies, Node 18+.
//   node install.mjs <target-repo> [--vault <absolute path>] [--dry-run] [--force] [--clean]
// Copies agents/ -> <target>/.claude/agents/ and skills/muffy/ -> <target>/.claude/skills/muffy/.
// Writes .claude/skills/muffy/VERSION and MANIFEST.json (the agent files this install owns).
// --clean removes the previous install first, including agent files that a newer version dropped.
// Creates .claude/settings.local.json only when missing, and adds ignore lines to .gitignore.
// --scan runs the repo scanner after install and writes .team/onboard/scan.json (input for /muffy onboard).
// Hooks are not added by default. --with-guard merges the env, Bash allowlist, full-regression and test-level guards into hooks.PreToolUse.
import { execFileSync } from 'node:child_process';
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
const scan = flag('--scan');

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

usage: node install.mjs <target-repo> [--vault <absolute path>] [--dry-run] [--force] [--clean] [--with-guard] [--scan]

  --vault       path to the Obsidian vault (written to .claude/settings.local.json)
  --with-guard  merge the guards (guard-env.mjs, guard-bash-allowlist.mjs, guard-full-regression.mjs, guard-test-level.mjs) into hooks.PreToolUse of .claude/settings.local.json
                never overwrites other keys; skipped with a message if PreToolUse already exists
  --scan        scan the target repo and write .team/onboard/scan.json, the input for /muffy onboard
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
const guards = [
  { script: 'guard-env.mjs', matcher: 'Read|Grep|Bash|PowerShell' },
  { script: 'guard-bash-allowlist.mjs', matcher: 'Bash|PowerShell' },
  { script: 'guard-full-regression.mjs', matcher: 'Bash|PowerShell' },
  { script: 'guard-test-level.mjs', matcher: 'Bash|PowerShell|Write|Edit' },
].map((g) => ({ ...g, entry: { matcher: g.matcher, hooks: [{ type: 'command', command: `node .claude/skills/muffy/scripts/${g.script}` }] } }));
const guardEntries = guards.map((g) => g.entry);
let settingsChanged = false;
if (!settingsExisted) {
  settings = { env: { SECOND_BRAIN_VAULT: vault ?? '<absolute path to your Obsidian vault>' } };
  settingsChanged = true;
  log(`write: ${rel(settingsPath, target)}${vault ? '' : ' (vault placeholder — set it before the first run)'}`);
}
if (withGuard) {
  const pre = settings.hooks?.PreToolUse;
  if (pre === undefined) {
    settings.hooks = { ...(settings.hooks ?? {}), PreToolUse: guardEntries };
    settingsChanged = true;
    log(`merge: hooks.PreToolUse <- ${guards.map((g) => g.script).join(', ')}`);
    if (dryRun) console.log(JSON.stringify({ hooks: { PreToolUse: guardEntries } }, null, 2));
  } else if (JSON.stringify(pre).includes('guard-env.mjs')) {
    // muffy's own hooks are already there (maybe from an older install): add only the guards still missing
    const missing = guards.filter((g) => !JSON.stringify(pre).includes(g.script));
    if (missing.length === 0) log('guards already in hooks.PreToolUse (nothing to merge)');
    else {
      settings.hooks.PreToolUse = [...pre, ...missing.map((g) => g.entry)];
      settingsChanged = true;
      log(`merge: hooks.PreToolUse <- ${missing.map((g) => g.script).join(', ')}`);
    }
  } else {
    warn(`hooks.PreToolUse already exists in ${rel(settingsPath, target)}; not modified. Add these entries by hand:\n${JSON.stringify(guardEntries, null, 2)}`);
  }
}
if (settingsExisted && !settingsChanged) log(`keep existing ${rel(settingsPath, target)} (not modified)`);
if (settingsChanged && !dryRun) {
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

// 4b. optional scan of an existing codebase (facts for /muffy onboard)
let scanSummary = '';
if (scan) {
  const scanOut = join(target, '.team', 'onboard', 'scan.json');
  log(`scan: ${rel(scanOut, target)}`);
  if (!dryRun) {
    try {
      execFileSync(process.execPath, [join(skillDst, 'scripts', 'scan-repo.mjs'), target, '--out', scanOut], { stdio: 'pipe' });
      const r = JSON.parse(readFileSync(scanOut, 'utf8'));
      scanSummary = r.hasCode ? `Scan found ${r.sourceFiles.total} source files.` : 'Scan found no source files (new repo): onboarding is not needed.';
    } catch (e) {
      warn(`scan failed: ${String(e.message).split(/\r?\n/)[0]}`);
    }
  }
}

// 5. ignore lines: add only the ones missing
const ignoreLines = ['.claude/settings.local.json', '.worktrees/', '.team/**/diff*.patch', '.team/**/logs/', '.team/onboard/pending.json'];
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
console.log(`
Done${dryRun ? ' (dry run, nothing written)' : ''}. Remaining manual steps:

1. ${withGuard ? 'Env, Bash-allowlist, full-regression and test-level guards are in hooks.PreToolUse of .claude/settings.local.json (see messages above if it was skipped).' : 'Hooks are not installed. Re-run with --with-guard for the guards, or add them yourself:\n     { "matcher": "Read|Grep|Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-env.mjs" } ] }\n     { "matcher": "Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-bash-allowlist.mjs" } ] }\n     { "matcher": "Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-full-regression.mjs" } ] }\n     { "matcher": "Bash|PowerShell|Write|Edit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-test-level.mjs" } ] }'}
   - Team-flow rules 1–4 (merge, commit, push, temporary stack) are Orchestrator rules, not hooks: see skills/muffy/references/hooks-enforcement.md.
2. Set SECOND_BRAIN_VAULT in .claude/settings.local.json if it still shows the placeholder.
3. Make sure the repo has docs/plan/, docs/adr/, docs/design-system/ (where the flow needs them) and .nvmrc if devops checks the runtime.
4. Existing codebase? Run /muffy onboard once before the first feature${scan ? ' (scan.json is ready).' : '; add --scan to this installer to pre-generate its input.'}${scanSummary ? ' ' + scanSummary : ''}
   It writes docs/architecture/baseline.md and an ADR for the stack you already have, then waits for your review.
5. Start a feature from the main session: /muffy <feature request> with a kebab-case <task> name.`);
