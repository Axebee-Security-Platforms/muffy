#!/usr/bin/env node
// Prompt & link linter for agents/ and skills/. Zero dependencies.
//   node scripts/lint.mjs
// Rules (each failure prints file + rule):
//   frontmatter   agents/*.md and skills/*/SKILL.md have name/description (+ tools/model for agents)
//   model         only haiku or sonnet (token-discipline.md forbids opus/fable)
//   links         every relative markdown link and `references/...` path resolves
//   references    each agent has the 8 standard reference files, links all of them, orphans none
//   lazy-load     each agent has a "Load on demand" section naming every reference file
//   structure     reference files start with a heading; SKILL.md has the standard sections
//   json          every .json parses; hand-off/escalation fixtures validate
//   hygiene       no .git dirs, no tracked settings.local.json, no personal absolute paths
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { validate } from '../skills/muffy/scripts/schema.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (file, rule, msg) => errors.push(`${relative(root, file).split(sep).join('/')}  [${rule}] ${msg}`);

const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    if (['.git', 'node_modules', 'dist', '__MACOSX'].includes(n)) continue;
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

const frontmatter = (txt) => {
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) { key = kv[1]; fm[key] = kv[2].replace(/^[>|]-?$/, '').trim(); }
    else if (key) fm[key] = `${fm[key]} ${line.trim()}`.trim();
  }
  return fm;
};

const REF_FILES = ['purpose', 'when-to-use', 'required-inputs', 'workflow', 'principles', 'output-format', 'rules-and-guardrails', 'quality-checks'];
const agentFiles = readdirSync(join(root, 'agents')).filter((n) => n.endsWith('.md'));

/* agents */
for (const f of agentFiles) {
  const file = join(root, 'agents', f);
  const txt = readFileSync(file, 'utf8');
  const role = f.replace(/\.md$/, '');
  const fm = frontmatter(txt);
  if (!fm) { fail(file, 'frontmatter', 'missing YAML frontmatter'); continue; }
  for (const k of ['name', 'description', 'tools', 'model']) if (!fm[k]) fail(file, 'frontmatter', `missing "${k}"`);
  if (fm.name && fm.name !== role) fail(file, 'frontmatter', `name "${fm.name}" != filename "${role}"`);
  if (fm.model && !['haiku', 'sonnet'].includes(fm.model)) fail(file, 'model', `"${fm.model}" not allowed (haiku|sonnet only)`);
  if (!new RegExp(`^# ${role.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('[ -]')}`, 'mi').test(txt)) fail(file, 'structure', 'H1 should be the agent name');

  const refDir = join(root, 'agents/references', role);
  if (!existsSync(refDir)) { fail(file, 'references', `missing agents/references/${role}/`); continue; }
  const present = readdirSync(refDir).map((n) => n.replace(/\.md$/, ''));
  for (const r of REF_FILES) if (!present.includes(r)) fail(file, 'references', `missing references/${role}/${r}.md`);
  const loadSection = txt.split(/^## Load on demand/m)[1];
  if (loadSection === undefined) fail(file, 'lazy-load', 'missing "## Load on demand" section');
  for (const r of present) {
    if (!txt.includes(`references/${role}/${r}.md`)) fail(file, 'references', `does not link references/${role}/${r}.md (orphan)`);
    if (loadSection !== undefined && !loadSection.includes(`${r}.md`)) fail(file, 'lazy-load', `"Load on demand" does not mention ${r}.md`);
  }
  for (const r of present) {
    const rf = join(refDir, `${r}.md`);
    if (!/^#{1,2} \S/.test(readFileSync(rf, 'utf8'))) fail(rf, 'structure', 'must start with a # / ## heading');
  }
}

/* skills */
const skillDirs = readdirSync(join(root, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
for (const s of skillDirs) {
  const file = join(root, 'skills', s, 'SKILL.md');
  if (!existsSync(file)) { fail(join(root, 'skills', s), 'frontmatter', 'missing SKILL.md'); continue; }
  const txt = readFileSync(file, 'utf8');
  const fm = frontmatter(txt);
  if (!fm?.name || !fm?.description) fail(file, 'frontmatter', 'needs name and description');
  else if (fm.name !== s) fail(file, 'frontmatter', `name "${fm.name}" != folder "${s}"`);
  for (const h of ['## Purpose', '## Inputs', '## Workflow', '## Output Format', '## Rules and Guardrails', '## Quality Checks']) if (!txt.includes(h)) fail(file, 'structure', `missing section "${h}"`);
  const refDir = join(root, 'skills', s, 'references');
  if (existsSync(refDir)) for (const r of readdirSync(refDir)) if (!txt.includes(`references/${r}`) && !walk(refDir).some((p) => p !== join(refDir, r) && readFileSync(p, 'utf8').includes(r))) fail(join(refDir, r), 'references', 'not linked from SKILL.md or any sibling reference (orphan)');
}

/* links: [text](relative.md), plus inline `references/...md` and `agents/...md` paths */
const mdFiles = walk(root).filter((p) => p.endsWith('.md') && (relative(root, p).startsWith('agents') || relative(root, p).startsWith('skills') || p.endsWith('README.md')) && !relative(root, p).startsWith('evals'));
for (const file of mdFiles) {
  const txt = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const m of txt.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target || /^(https?:|mailto:|\/)/.test(target)) continue;
    if (!existsSync(resolve(dirname(file), decodeURIComponent(target)))) fail(file, 'links', `broken link ${m[1]}`);
  }
  for (const m of txt.matchAll(/`((?:references|schemas|scripts)\/[A-Za-z0-9_./-]+\.(?:md|json|mjs))`/g)) {
    const here = dirname(file);
    const candidates = [resolve(here, m[1]), resolve(root, 'skills/muffy', m[1]), resolve(root, 'agents', m[1])];
    if (!candidates.some(existsSync)) fail(file, 'links', `broken path reference \`${m[1]}\``);
  }
}

/* json */
for (const file of walk(root).filter((p) => p.endsWith('.json'))) {
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { fail(file, 'json', e.message); continue; }
  const r = relative(root, file).split(sep).join('/');
  if (r.includes('/handoff/')) {
    const e = validate(JSON.parse(readFileSync(join(root, 'skills/muffy/schemas/handoff.schema.json'), 'utf8')), data);
    if (e.length) fail(file, 'json', e.join('; '));
  }
}

/* hygiene: settings.local.json may exist on disk (gitignored) but must never be tracked */
try {
  const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/);
  for (const t of tracked) if (/(^|\/)settings\.local\.json$/.test(t) || /(^|\/)\.git\//.test(t)) fail(join(root, t), 'hygiene', 'must not be tracked (personal config or VCS internals)');
} catch { /* not a git checkout (e.g. unpacked package): nothing to check */ }
for (const file of walk(root)) {
  const r = relative(root, file).split(sep).join('/');
  if (/\.(md|json|mjs)$/.test(r) && r !== 'scripts/lint.mjs') {
    const txt = readFileSync(file, 'utf8');
    if (/\/Users\/[a-z0-9_.-]+\//i.test(txt) && !r.endsWith('.template') && !r.startsWith('settings.local')) fail(file, 'hygiene', 'personal absolute path');
  }
}

console.log(errors.length ? `lint: ${errors.length} problem(s)\n${errors.map((e) => `  ${e}`).join('\n')}` : 'lint: ok');
process.exit(errors.length ? 1 : 0);
