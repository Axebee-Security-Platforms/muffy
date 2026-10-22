// Shared write-scope rules (references/hooks-enforcement.md §12). Used by guard-write-scope.mjs (the PreToolUse block) and
// make-envelope.mjs (refuses a Write: path the role may not write, and prints the "Don't write" line), so the two cannot drift.
export const RULES = [
  { re: /(^|\/)docs\/strategy\.md$/, owners: ['product-manager'], what: 'docs/strategy.md (the product-manager records all cost: send it the figures through the Orchestrator)' },
  { re: /(^|\/)docs\/architecture\/baseline(\.md|\/[^/]+\.md)$/, owners: ['researcher'], what: 'docs/architecture/baseline.md or a section file docs/architecture/baseline/<section>.md (the researcher writes them in onboard mode)' },
  { re: /(^|\/)docs\/architecture\/(overview|data-model|deployment)\.html$/, owners: ['diagrammer'], what: 'an architecture diagram (the architect specs the facts when a trigger fires; the diagrammer draws the file)' },
  { re: /(^|\/)docs\/architecture\/(flows|states|changes|data-models)\/[^/]+\.html$/, owners: ['diagrammer'], what: 'a flow, state, change or per-feature ERD diagram (the architect specs the facts when a trigger fires; the diagrammer draws the file)' },
  { re: /(^|\/)docs\/architecture\//, owners: [], what: 'a file under docs/architecture/ that no rule names' },
  { re: /(^|\/)docs\/plan\/[^/]+-(gantt|story-map)\.html$/, owners: ['diagrammer'], what: 'a plan diagram (the product-manager specs the facts when the plan needs one; the diagrammer draws the file)' },
  { re: /(^|\/)docs\/design\/screen-map\.html$/, owners: ['diagrammer'], what: 'the screen map (the designer specs it when the structure or navigation changes; the diagrammer draws the file)' },
  { re: /(^|\/)docs\/design-system\//, owners: ['designer', 'architect'], what: 'the design system (the designer owns it; the architect records an existing one at onboard)' },
];

// Rules are anchored at the project root, so packages/sdk/docs/architecture/README.md in a monorepo is not the shared docs folder. A path
// outside the project root (or with no root to compare) falls back to matching anywhere in the path. Windows and macOS file systems
// ignore case, so Docs/Strategy.md is the same file there.
const fold = (p) => (process.platform === 'win32' || process.platform === 'darwin' ? p.toLowerCase() : p);
const slash = (p) => p.replace(/\\/g, '/');
const isAbsolute = (p) => /^([a-zA-Z]:)?\//.test(p);

// The first rule that matches `rawPath` and does not list `role` as an owner, or null when the role may write it.
export function blockingRule(role, rawPath, cwd = process.cwd()) {
  const raw = slash(String(rawPath ?? ''));
  const root = slash(String(cwd)).replace(/\/+$/, '');
  const inRoot = isAbsolute(raw) ? fold(raw).startsWith(`${fold(root)}/`) : !raw.startsWith('../');
  const path = fold(inRoot ? (isAbsolute(raw) ? raw.slice(root.length + 1) : raw.replace(/^\.\//, '')) : raw);
  const anchored = (re) => (inRoot ? new RegExp(re.source.replace('(^|\\/)', '^')) : re);
  for (const rule of RULES) {
    if (!anchored(rule.re).test(path)) continue;
    return rule.owners.includes(role) ? null : rule;
  }
  return null;
}

export const roleOf = (agentType) => String(agentType ?? '').split(':').pop(); // "muffy:architect" or "architect"

export const blockMessage = (role, rule) =>
  `[muffy] blocked: ${role} may not write ${rule.what}${rule.owners.length ? `; only ${rule.owners.join(' or ')} may` : ''}. Report what you found in your hand-off and the Orchestrator routes it (references/hooks-enforcement.md §12).`;

// What a role is told up front in its prompt: the shared files it must not write, one line.
export const dontWriteLine = (role) => {
  const sample = [];
  for (const p of ['docs/strategy.md', 'docs/architecture/baseline.md', 'docs/architecture/overview.html', 'docs/architecture/README.md', 'docs/plan/x-gantt.html', 'docs/design/screen-map.html', 'docs/design-system/tokens.css']) {
    if (blockingRule(role, p, '/p')) sample.push(p.replace('x-gantt', '<task>-gantt'));
  }
  return sample.length ? `Shared files you may not write (a guard blocks them; report in your hand-off instead): ${sample.join(', ')}` : '';
};
