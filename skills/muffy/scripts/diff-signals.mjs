#!/usr/bin/env node
// Reads the real diff, not an agent's own report, for two decisions:
//   smoke  whether 3d runs: a manifest or lockfile changed, a devops-owned file changed, no passing smoke is on record in
//          <brain>/agents/devops/ (references/run-profile.md "Smoke triggers"; rules in next-action.mjs)
//   scope  with --profile fix|change: whether the change still fits its lane (fix-profile.md / change-profile.md, the internal
//          scope; `lite` is the same), counting source
//          files (tests and .team/ excluded) and flagging schema/migration, auth, dependency and devops-owned paths
//
// Usage: node diff-signals.mjs <base> [<head>] [--profile fix|change] [--brain <dir>] [--team-dir .team/<task>] [--cwd <repo>]
//   <head> defaults to HEAD; the diff is <base>...<head> (what <head> added since it left <base>).
// Prints `next=run-3d|skip-3d …`, and with --profile `next=stay:<lane>|promote:full-flow …`.
// Exit 0 = proceed (3d decision made, lane kept), 1 = promote to the full flow, 2 = usage or git error.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COVERED_FILE, MANIFEST_NAMES } from './repo-facts.mjs';
import { parseOwnership, ownersOf } from './ownership.mjs';
import { smokeRequired } from './next-action.mjs';
import { laneSpec } from './lanes.mjs';

// lanes whose scope the diff can outgrow (a file limit in lanes.mjs); lite is the change lane's internal scope
const SCOPED = ['fix', 'lite', 'change'];

const base = (p) => p.split('/').pop();
export const isTest = (p) => /(^|\/)(tests?|__tests__)\//.test(p) || /\.(test|spec)\.[a-z]+$/i.test(p);
export const isTeam = (p) => /(^|\/)\.team\//.test(p);
const DEVOPS_FILE = /^(Dockerfile.*|.*\.dockerfile|docker-compose.*\.ya?ml|compose\.ya?ml|\.nvmrc|\.node-version|\.python-version|\.tool-versions|Procfile|fly\.toml|render\.yaml|vercel\.json|netlify\.toml)$/i;
const LOCKFILE = /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|poetry\.lock|uv\.lock|go\.sum|Cargo\.lock|composer\.lock|Gemfile\.lock|pubspec\.lock|Package\.resolved)$/;
const SCHEMA = /(^|\/)(migrations?|migrate)\/|\.sql$|(^|\/)schema\.(prisma|graphql|gql)$|(^|\/)prisma\/schema\.prisma$/i;
const AUTH = /(^|\/)(auth|authn|authz|permissions?|rbac|oauth|session)(\/|\.[a-z]+$)/i;

// files: repo-relative paths changed. ownershipRows: parsed contract/ownership.md (optional). Pure, so the evals call it directly.
export function classify(files, { ownershipRows = [], smokeOnRecord = true } = {}) {
  const devopsOwned = (p) => DEVOPS_FILE.test(base(p)) || (ownershipRows.length > 0 && ownersOf(ownershipRows, p).includes('devops'));
  const deps = files.filter((p) => LOCKFILE.test(base(p)) || MANIFEST_NAMES.includes(base(p)) || (COVERED_FILE.test(base(p)) && /requirements.*\.txt$/.test(base(p))));
  const devops = files.filter(devopsOwned);
  const source = files.filter((p) => !isTest(p) && !isTeam(p));
  const smoke = smokeRequired({
    runtime_or_dependency_changed: deps.length > 0,
    devops_files_changed: devops.length > 0,
    no_passing_smoke_on_record: !smokeOnRecord,
  });
  return {
    smoke,
    source,
    deps,
    devops,
    schema: source.filter((p) => SCHEMA.test(p)),
    auth: source.filter((p) => AUTH.test(p)),
  };
}

// The lane conditions that a diff can show. Conditions about intent (a new screen, an outside consumer) stay with the Orchestrator.
export function laneVerdict(c, profile, scope) {
  const reasons = [];
  const spec = laneSpec(profile, scope ?? (profile === 'change' ? 'internal' : null));
  const max = spec?.maxFiles;
  if (!max) throw new Error(`laneVerdict: ${profile} has no lane limits (${SCOPED.join(', ')})`);
  if (c.source.length > max) reasons.push(`${c.source.length} source files changed (lane max ${max})`);
  if (c.deps.length) reasons.push(`dependency change: ${c.deps.join(', ')}`);
  if (c.devops.length) reasons.push(`devops-owned files: ${c.devops.join(', ')}`);
  if (c.auth.length) reasons.push(`auth or permission files: ${c.auth.join(', ')}`);
  if (spec.lane === 'fix' && c.schema.length) reasons.push(`schema or migration: ${c.schema.join(', ')}`); // lite allows a reversible migration
  return { promote: reasons.length > 0, reasons };
}

// A passing smoke is on record when a devops brain note says so (devops/workflow.md: "smoke/health check results").
export function smokeOnRecord(brain) {
  const dir = brain && join(brain, 'agents', 'devops');
  if (!dir || !existsSync(dir)) return false;
  const notes = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => readFileSync(join(dir, f), 'utf8'));
  return notes.some((t) => t.split('\n').some((l) => /smoke/i.test(l) && /\b(pass|passed|passes|green|ok)\b/i.test(l) && !/\b(fail|failed|red)\b/i.test(l)));
}

function changedFiles(cwd, from, to) {
  const out = execFileSync('git', ['-c', 'core.quotePath=false', 'diff', '--name-only', `${from}...${to}`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const o = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) argv[i].startsWith('--') ? (o[argv[i].slice(2)] = argv[++i]) : pos.push(argv[i]);
  const [from, to = 'HEAD'] = pos;
  if (!from || (o.profile && !SCOPED.includes(o.profile))) {
    console.error('usage: diff-signals.mjs <base> [<head>] [--profile fix|change] [--brain <dir>] [--team-dir .team/<task>] [--cwd <repo>]');
    process.exit(2);
  }
  let files;
  try { files = changedFiles(o.cwd ?? process.cwd(), from, to); } catch (e) {
    console.error(`git diff ${from}...${to} failed: ${String(e.stderr ?? e.message).trim()}`);
    process.exit(2);
  }
  const team = o['team-dir'];
  const read = (f) => (team && existsSync(join(team, f)) ? readFileSync(join(team, f), 'utf8') : '');
  const ownership = read('contract/ownership.md');
  const c = classify(files, {
    ownershipRows: ownership ? parseOwnership(ownership) : [],
    smokeOnRecord: smokeOnRecord(o.brain),
  });
  console.log(c.smoke.required ? `next=run-3d reasons=${c.smoke.reasons.join(',')}` : 'next=skip-3d reason=no-trigger (record "3d skipped: no trigger" in tasks/<task>.md)');
  console.log(`files: ${c.source.length} source / ${files.length} changed`);
  let code = 0;
  if (o.profile) {
    const v = laneVerdict(c, o.profile);
    console.log(v.promote ? `next=promote:full-flow lane=${o.profile}` : `next=stay:${o.profile}`);
    for (const r of v.reasons) console.log(`reason: ${r}`);
    if (v.promote) code = 1;
  }
  process.exit(code);
}
