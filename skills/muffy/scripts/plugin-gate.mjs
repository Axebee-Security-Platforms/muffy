// Opt-in for the guards when muffy runs as a plugin. A plugin's hooks run in every project that enables it,
// so hooks/hooks.json passes --plugin and each guard does nothing unless the project opted in:
// env MUFFY_GUARD set to "1" in .claude/settings.local.json or .claude/settings.json (`/muffy:setup --with-guard` writes it).
// A guard started from settings.local.json (the copied install, no --plugin) is always on, as before.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const optedIn = (dir) =>
  ['settings.local.json', 'settings.json'].some((f) => {
    const p = join(dir, '.claude', f);
    if (!existsSync(p)) return false;
    try {
      return String(JSON.parse(readFileSync(p, 'utf8'))?.env?.MUFFY_GUARD ?? '') === '1';
    } catch {
      return false;
    }
  });

export function guardOff(argv = process.argv, env = process.env) {
  if (!argv.includes('--plugin')) return false;
  if (env.MUFFY_GUARD === '1') return false;
  return !optedIn(env.CLAUDE_PROJECT_DIR || process.cwd());
}
