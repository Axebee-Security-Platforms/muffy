#!/usr/bin/env node
// Fix lane, step 11: decides from the real diff whether a fix is small enough for a script to write its release notes
// (no docs-writer spawn, no LLM cost), and writes `release-notes.md` when it is. A bigger fix keeps the docs-writer.
//
// Usage: node small-fix.mjs .team/<task> --base <ref> [--head <ref>] [--cwd <repo>] [--check]
//   base/head  the diff is <base>...<head>; head defaults to HEAD of the repo the task folder is in (the merged feature branch)
//   cwd        default: the task folder, so the right worktree is read from any current folder; a diff with no source file is exit 2
//   --check    decide only, write nothing
// Small = every one of these holds (the thresholds are SMALL below, one place):
//   - at most 2 source files and 20 changed source lines (tests and .team/ excluded)
//   - no dependency, devops-owned, schema/migration, auth, config/env or contract/API-spec file
//   - the debugger's diagnosis severity is low or medium
//   - no README or docs/ page mentions a changed source file by name (that doc may now be wrong: the docs-writer reads it);
//     the onboard baseline (docs/architecture/baseline.md), docs/plan/ and docs/adr/ do not count (NOT_BEHAVIOUR_DOC)
// Prints `next=script-notes` (release-notes.md written) or `next=spawn-docs-writer reasons=<a;b>`.
// Exit 0 = small (notes written, unless --check), 1 = not small (spawn the docs-writer), 2 = usage, git error or an empty diff.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, isTest, isTeam } from './diff-signals.mjs';

export const SMALL = { maxFiles: 2, maxLines: 20, severities: ['low', 'medium'] };
const CONFIG = /(^|\/)\.env(\.|$)|(^|\/)(config|configs|settings)(\/|\.[a-z]+$)|\.(ya?ml|toml|ini)$/i;
const CONTRACT = /(^|\/)(openapi|swagger)[^/]*$|\.(proto|graphql|gql)$|(^|\/)contract[^/]*$/i;

const readIf = (p) => (existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null);
const section = (text, title) => text?.match(new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))?.[1].trim() ?? null;

// Pure, so the evals call it. input: { files, lines (changed source lines), severity, docsText (README + docs/ concatenated) }
export function smallVerdict({ files, lines, severity, docsText = '' }) {
  const c = classify(files);
  const reasons = [];
  if (c.source.length > SMALL.maxFiles) reasons.push(`${c.source.length} source files changed (small = at most ${SMALL.maxFiles})`);
  if (lines > SMALL.maxLines) reasons.push(`${lines} source lines changed (small = at most ${SMALL.maxLines})`);
  for (const [why, list] of [['dependency', c.deps], ['devops-owned', c.devops], ['schema or migration', c.schema], ['auth or permission', c.auth],
    ['config or env', c.source.filter((p) => CONFIG.test(p))], ['contract or API spec', files.filter((p) => !isTeam(p) && CONTRACT.test(p))]]) {
    if (list.length) reasons.push(`${why} file: ${list.join(', ')}`);
  }
  if (!SMALL.severities.includes(String(severity ?? '').toLowerCase())) reasons.push(`severity ${severity ?? 'unknown'} (small = ${SMALL.severities.join(' or ')})`);
  const mentioned = c.source.filter((p) => docsText.includes(basename(p)));
  if (mentioned.length) reasons.push(`a doc names ${mentioned.map((p) => basename(p)).join(', ')}: the docs-writer checks it`);
  return { small: reasons.length === 0, reasons, source: c.source };
}

const git = (cwd, ...a) => execFileSync('git', ['-c', 'core.quotePath=false', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// the highest severity any 4a hand-off of the task records (a later round can raise it)
export function severityOf(task) {
  const dir = join(task, 'handoff');
  const rank = ['low', 'medium', 'high', 'critical'];
  let best = null;
  for (const f of existsSync(dir) ? readdirSync(dir).filter((n) => /^4a-debugger-r\d+\.json$/.test(n)) : []) {
    try {
      const s = JSON.parse(readFileSync(join(dir, f), 'utf8')).diagnosis?.severity;
      if (rank.includes(s) && (best === null || rank.indexOf(s) > rank.indexOf(best))) best = s;
    } catch { /* an unreadable hand-off is not a severity */ }
  }
  return best;
}

// Pages that are not about behaviour: the onboard baseline lists every file of the project (so it names any file a fix changes, and
// its freshness has its own check, baseline-freshness.md), and plans and ADRs record a past decision. They never count.
export const NOT_BEHAVIOUR_DOC = /^docs\/(architecture\/baseline\.md|plan\/|adr\/)/i;

// README and the behaviour docs under docs/, concatenated (the repo root is the cwd). `.team/` is never read.
export function docsText(cwd) {
  const out = [];
  const walk = (dir, depth) => {
    if (!existsSync(dir) || depth > 3) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!['node_modules', '.git', '.team', '.worktrees'].includes(e.name)) walk(p, depth + 1); }
      else if (/\.md$/i.test(e.name) && !NOT_BEHAVIOUR_DOC.test(p.slice(cwd.length + 1).replace(/\\/g, '/'))) out.push(readIf(p) ?? '');
    }
  };
  for (const e of existsSync(cwd) ? readdirSync(cwd) : []) if (/^README/i.test(e)) out.push(readIf(join(cwd, e)) ?? '');
  walk(join(cwd, 'docs'), 0);
  return out.join('\n');
}

export function renderNotes({ task, fix, qa, source, commits, severity }) {
  const symptom = section(fix, 'Symptom') ?? 'see fix.md';
  const cause = (section(fix, 'Cause') ?? 'see fix.md').split('\n').filter((l) => !/^(confidence|severity|owner|files|flow):/i.test(l.trim())).join('\n').trim();
  const results = (section(qa, 'Results') ?? 'see qa-report.md').replace(/^(`[^`]*`) in .*?: (?=exit|timed out)/, '$1: '); // the worktree path is noise in a release note
  const ac = (section(qa, 'AC id -> test name') ?? '').split('\n').filter((l) => /^\|\s*AC-\d+/.test(l)).map((l) => `- ${l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join(': ')}`);
  const rollback = commits.length ? `Revert ${commits.map((c) => `\`${c}\``).join(', ')} (the fix commit${commits.length > 1 ? 's' : ''}). This restores the behaviour above.` : 'Revert the merge of this branch.';
  return [
    `# Release notes: ${task}`,
    '',
    'Written by `small-fix.mjs` from `fix.md`, `qa-report.md` and the diff (no docs-writer: the fix is small, see the script header). No documentation page was updated.',
    '',
    '## Changelog',
    '',
    '### Fixed',
    ...symptom.split('\n').filter(Boolean).map((l) => (l.startsWith('-') ? l : `- Symptom fixed: ${l}`)),
    '',
    '## Cause',
    cause,
    '',
    '## What changed',
    ...source.map((f) => `- \`${f}\``),
    '',
    '## Test results',
    results,
    ...(ac.length ? ['', 'AC covered:', ...ac] : []),
    '',
    '## Rollback',
    rollback,
    '',
    '## Deploy hand-off',
    `- **Branch and commit:** ${commits.length ? commits.map((c) => `\`${c}\``).join(', ') : 'see the merge on the feature branch'} on \`feature/${task}\`.`,
    '- **Migrations to run:** none (the diff has no migration, schema, dependency, config or env file).',
    '- **New env vars or config:** none.',
    `- **Order:** deploy the branch; nothing else to run. Severity recorded by the debugger: ${severity}.`,
    '- **Check after deploy:** run the project test command and repeat the repro in `fix.md`.',
    '',
  ].join('\n');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const o = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') o.check = true;
    else if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
    else pos.push(argv[i]);
  }
  const task = pos[0] && resolve(pos[0]);
  if (!task || !o.base || !existsSync(task)) { console.error('usage: small-fix.mjs .team/<task> --base <ref> [--head <ref>] [--cwd <repo>] [--check]'); process.exit(2); }
  // git runs where the task folder is, so HEAD is the feature branch of that worktree, not whatever checkout the Orchestrator stands in
  let cwd = resolve(o.cwd ?? task);
  const head = o.head ?? 'HEAD';
  let files; let lines = 0; let commits = [];
  try {
    cwd = git(cwd, 'rev-parse', '--show-toplevel');
    files = git(cwd, 'diff', '--name-only', `${o.base}...${head}`).split('\n').filter(Boolean);
    if (!files.some((p) => !isTest(p) && !isTeam(p))) {
      console.error(`no source file changed between ${o.base} and ${head} in ${cwd}: a wrong --base or --head, or a fix with no code change. Nothing decided, nothing written.`);
      process.exit(2);
    }
  } catch (e) { console.error(`git failed: ${String(e.stderr ?? e.message).trim()}`); process.exit(2); }
  try {
    files = git(cwd, 'diff', '--name-only', `${o.base}...${head}`).split('\n').filter(Boolean);
    const src = files.filter((p) => !isTest(p) && !isTeam(p));
    if (src.length) {
      for (const l of git(cwd, 'diff', '--numstat', `${o.base}...${head}`, '--', ...src).split('\n').filter(Boolean)) {
        const [a, d] = l.split('\t');
        lines += (Number(a) || 0) + (Number(d) || 0); // a binary file shows `-`: counts 0 here, and a binary source file is not a small fix anyway
      }
      commits = git(cwd, 'log', '--no-merges', '--format=%h', `${o.base}..${head}`, '--', ...src).split('\n').filter(Boolean).reverse();
    }
  } catch (e) { console.error(`git failed: ${String(e.stderr ?? e.message).trim()}`); process.exit(2); }
  const severity = severityOf(task);
  const v = smallVerdict({ files, lines, severity, docsText: docsText(cwd) });
  const taskName = basename(task);
  console.log(`files: ${v.source.length} source / ${files.length} changed · ${lines} source lines · severity ${severity ?? 'unknown'}`);
  if (!v.small) {
    console.log(`next=spawn-docs-writer reasons=${v.reasons.join(';')}`);
    process.exit(1);
  }
  if (!o.check) {
    writeFileSync(join(task, 'release-notes.md'), renderNotes({ task: taskName, fix: readIf(join(task, 'fix.md')), qa: readIf(join(task, 'qa-report.md')), source: v.source, commits, severity }));
  }
  console.log(o.check ? 'next=script-notes (check only, nothing written)' : 'next=script-notes release-notes.md written (record `docs-writer skipped: small fix, script-written notes` in tasks/<task>.md)');
  process.exit(0);
}
