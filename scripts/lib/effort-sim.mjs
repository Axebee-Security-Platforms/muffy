// Deterministic model of the effort rules in skills/muffy/references/token-discipline.md ("Effort tiers").
// If you change a rule there, change it here and in evals/effort-scenarios.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const LEVELS = ['low', 'medium', 'high'];
export const PROTECTED_ROLES = ['code-reviewer', 'architect', 'devops']; // never below their default in production mode
export const STALLED_AFTER = 2; // same blocker id open in this many consecutive rejections counts as stalled

export const defaultEffort = (role) =>
  readFileSync(join(root, 'agents', `${role}.md`), 'utf8').match(/^effort:\s*(\S+)/m)?.[1];

// signals: { highImpact, assumedAc, exactFix, stalledRounds }  (all optional)
//   highImpact    contract.md touches auth, payments, data migrations or secrets
//   assumedAc     ac.md / requirements.md carries [assumed] items
//   exactFix      every open bug names file + line + expected fix (read from handoff blockers)
//   stalledRounds consecutive rejections the same blocker id has been open (checkpoint ## Open blockers)
export function chooseEffort({ role, mode = 'production', signals = {} }) {
  const base = defaultEffort(role);
  const idx = LEVELS.indexOf(base);
  if (idx < 0) throw new Error(`no valid effort in agents/${role}.md`);
  const protectedRole = mode === 'production' && PROTECTED_ROLES.includes(role);

  if (signals.highImpact) return { effort: 'high', base, reason: 'high-impact' };

  const up = (signals.assumedAc ? 1 : 0) + ((signals.stalledRounds ?? 0) >= STALLED_AFTER ? 1 : 0);
  const down = signals.exactFix ? 1 : 0;
  let net = Math.max(-1, Math.min(1, up - down)); // net move is at most one level
  if (protectedRole && net < 0) net = 0;
  const effort = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx + net))];
  return { effort, base, reason: net === 0 ? 'default' : net > 0 ? 'raised' : 'lowered' };
}
