// Offline checks for the plugin install: manifests in step with the repo, the guards' opt-in, the Bash allowlist
// with the plugin's absolute script path, install.mjs --plugin, and the copied install's path rewrite.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function runPluginEvals({ check, root }) {
  const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
  const plugin = readJson('.claude-plugin/plugin.json');
  const market = readJson('.claude-plugin/marketplace.json');
  const pkg = readJson('package.json');
  const agentFiles = readdirSync(join(root, 'agents')).filter((n) => n.endsWith('.md')).sort();

  check('plugin: plugin.json version matches package.json', plugin.version === pkg.version, `${plugin.version} vs ${pkg.version}`);
  // a marketplace name belongs to one source: `harmonyx` is the spright repo's, so adding this repo under it is refused
  check('plugin: the marketplace is named muffy, not the spright repo\'s harmonyx', market.name === 'muffy');
  check('plugin: marketplace lists muffy from the repo root under the manifest name', market.plugins?.some((p) => p.name === plugin.name && p.source === './'));
  // A plugin loads every .md under agents/, subfolders included and frontmatter or not: a live session listed each
  // reference file as muffy:references:<role>:<file> (`claude plugin details` did not show them). So agents/ holds the
  // agent definitions only, and their reference files live in agent-references/.
  check('plugin: agents/ holds only the agent .md files, no subfolders', readdirSync(join(root, 'agents'), { withFileTypes: true }).every((e) => e.isFile() && e.name.endsWith('.md')) && plugin.agents === undefined);
  check('plugin: every agent has its reference folder in agent-references/', agentFiles.every((f) => existsSync(join(root, 'agent-references', f.replace(/\.md$/, '')))));
  check('plugin: every top-level agent opens with frontmatter', agentFiles.every((f) => readFileSync(join(root, 'agents', f), 'utf8').startsWith('---')));
  const hooks = readJson('hooks/hooks.json').hooks?.PreToolUse ?? [];
  const cmds = hooks.flatMap((h) => h.hooks.map((x) => x.command));
  check('plugin: every hook runs an existing guard with --plugin', cmds.length === 7 && cmds.every((c) => {
    const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/(skills\/muffy\/scripts\/guard-[\w-]+\.mjs)" --plugin$/.exec(c);
    return m && existsSync(join(root, m[1]));
  }));
  check('plugin: every agent defines <muffy> through ${CLAUDE_PLUGIN_ROOT}', agentFiles.every((f) => readFileSync(join(root, 'agents', f), 'utf8').includes('`<muffy>` is `${CLAUDE_PLUGIN_ROOT}/skills/muffy`')));
  check('plugin: SKILL.md defines <muffy> through ${CLAUDE_SKILL_DIR}', readFileSync(join(root, 'skills/muffy/SKILL.md'), 'utf8').includes('`<muffy>` in this file and every reference is `${CLAUDE_SKILL_DIR}`'));

  const tmp = mkdtempSync(join(tmpdir(), 'muffy-plugin-'));
  try {
    const scripts = join(root, 'skills/muffy/scripts');
    const run = (script, payload, args = [], env = {}) =>
      spawnSync(process.execPath, [join(scripts, script), ...args], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, MUFFY_GUARD: '', CLAUDE_PROJECT_DIR: tmp, ...env } }).status;

    // opt-in gate
    const envRead = { tool_name: 'Read', tool_input: { file_path: '.env' } };
    check('plugin gate: a guard started without --plugin is always on', run('guard-env.mjs', envRead) === 2);
    check('plugin gate: with --plugin and no opt-in the guard does nothing', run('guard-env.mjs', envRead, ['--plugin']) === 0);
    mkdirSync(join(tmp, '.claude'));
    writeFileSync(join(tmp, '.claude', 'settings.local.json'), JSON.stringify({ env: { MUFFY_GUARD: '1' } }));
    check('plugin gate: MUFFY_GUARD=1 in settings.local.json turns it on', run('guard-env.mjs', envRead, ['--plugin']) === 2);
    rmSync(join(tmp, '.claude'), { recursive: true });

    // Bash allowlist with the absolute path the plugin fills in
    const bash = (agent_type, command) => run('guard-bash-allowlist.mjs', { tool_name: 'Bash', agent_type, tool_input: { command } });
    const abs = scripts.replace(/\\/g, '/');
    check('guard-bash: the plugin path in quotes is allowed', bash('muffy:architect', `node "${abs}/validate-handoff.mjs" .team/x/h.json`) === 0);
    // backslashes are path separators only on Windows (the path Claude Code fills in there); on Linux and macOS they are file-name characters
    if (process.platform === 'win32') check('guard-bash: the plugin path with backslashes is allowed (Windows)', bash('muffy:architect', `node "${scripts.replace(/\//g, '\\')}\\check-diagram.mjs" a.html`) === 0);
    check('guard-bash: a look-alike script in another folder is blocked', ['node "C:/x/skills/muffy/scripts/validate-handoff.mjs" a', 'node docs/skills/muffy/scripts/check-artifacts.mjs a', `node "${abs}/../scripts/validate-handoff.mjs" a`].every((c) => bash('muffy:designer', c) === 2));
    check('guard-bash: a plugin script that is not a check stays blocked', bash('muffy:architect', `node "${abs}/run-quiet.mjs" -- npm test`) === 2);
    check('guard-bash: ux-search through the plugin path is the designer\'s only', bash('muffy:designer', `node "${abs}/ux-search.mjs" "focus ring" --domain ux -n 3`) === 0 && bash('muffy:architect', `node "${abs}/ux-search.mjs" "x"`) === 2);

    // install.mjs --plugin: copies nothing, opts in, keeps the old lines
    const repo = join(tmp, 'repo');
    mkdirSync(repo);
    spawnSync('git', ['init', '-q', repo]);
    const inst = (...a) => spawnSync(process.execPath, [join(root, 'install.mjs'), repo, '--no-scan', ...a], { encoding: 'utf8' });
    const p = inst('--plugin', '--with-guard');
    const settings = JSON.parse(readFileSync(join(repo, '.claude', 'settings.local.json'), 'utf8'));
    check('install --plugin: copies no agents or skill, sets MUFFY_GUARD=1, adds the ignore lines', p.status === 0 && !existsSync(join(repo, '.claude', 'agents')) && !existsSync(join(repo, '.claude', 'skills')) && settings.env?.MUFFY_GUARD === '1' && readFileSync(join(repo, '.gitignore'), 'utf8').includes('.worktrees/'));
    check('install --plugin: refuses --clean', inst('--plugin', '--clean').status === 2);

    // copied install: ${CLAUDE_PLUGIN_ROOT} is not filled in outside a plugin, so the copy points it at .claude
    const c = inst();
    const agentsDst = join(repo, '.claude', 'agents');
    check('install (copy): agent paths point at .claude, no ${CLAUDE_PLUGIN_ROOT} left', c.status === 0 && agentFiles.every((f) => {
      const t = readFileSync(join(agentsDst, f), 'utf8');
      return !t.includes('${CLAUDE_PLUGIN_ROOT}') && t.includes('`<muffy>` is `.claude/skills/muffy`');
    }));
    check('install --plugin: warns about a copied install next to the plugin', /two \/muffy skills/.test(inst('--plugin').stderr));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
