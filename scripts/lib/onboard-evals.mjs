// Offline checks for automatic onboarding (skills/muffy/references/onboard.md → Depth, setup.md step 3, baseline-freshness.md):
//   - next-action.mjs baselineAction: what setup does per baseline colour, depth and lane (evals/baseline-scenarios.json)
//   - check-baseline.mjs --json reports the depth, and a missing baseline as JSON; the baseline CLI runs it end to end
//   - every lane's setup runs the same baseline check; onboard resumes the request that sent the user there
//   - the installer scans by default and points at /muffy <request>, not at /muffy onboard
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { baselineAction } from '../../skills/muffy/scripts/next-action.mjs';
import { LANES } from '../../skills/muffy/scripts/lanes.mjs';

export function runOnboardEvals({ check, root }) {
  const read = (...p) => readFileSync(join(root, ...p), 'utf8').replace(/\r\n/g, '\n');
  const ref = (f) => read('skills/muffy/references', f);
  const S = (f) => join(root, 'skills/muffy/scripts', f);

  /* the decision table */
  const scenarios = JSON.parse(read('evals/baseline-scenarios.json'));
  for (const s of scenarios) {
    const out = baselineAction({ colour: s.colour, depth: s.depth, hasCode: s.has_code, lane: s.lane });
    check(`baseline action: ${s.id} → ${s.expect}`, out.next === s.expect, `got ${out.next}`);
  }
  const outcomes = new Set(scenarios.map((s) => s.expect));
  check('baseline action: the scenarios cover every outcome', ['continue', 'refresh:silent', 'ask:onboard-quick', 'ask:onboard-full', 'ask:red'].every((o) => outcomes.has(o)));
  check('baseline action: yellow never asks', scenarios.filter((s) => s.colour === 'yellow').every((s) => !s.expect.startsWith('ask:')));
  const setup = ref('setup.md');
  check('docs: setup.md step 3 says what to do for every outcome', [...outcomes].every((o) => setup.includes(`\`${o}\``) || (o.startsWith('ask:onboard') && setup.includes('`ask:onboard-quick` or `ask:onboard-full`'))));
  const onboard = ref('onboard.md');
  const depthRow = (d) => onboard.split('\n').find((l) => l.startsWith(`| \`${d}\` |`)) ?? '';
  check('drift: onboard.md Depth table names the lanes lanes.mjs gives each depth', Object.entries(LANES).every(([lane, l]) => depthRow(l.baseline).includes(lane === 'feature' ? 'full flow' : lane)), `${depthRow('quick')} / ${depthRow('full')}`);

  /* check-baseline --json and the CLI */
  const repo = mkdtempSync(join(tmpdir(), 'muffy-onboard-'));
  try {
    const put = (p, s) => { mkdirSync(dirname(join(repo, p)), { recursive: true }); writeFileSync(join(repo, p), s); };
    const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' }).stdout.trim();
    git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    put('src/a.ts', 'export const a = 1;\n');
    git('add', '-A'); git('commit', '-qm', 'code');
    const cb = () => JSON.parse(spawnSync(process.execPath, [S('check-baseline.mjs'), repo, '--json'], { encoding: 'utf8' }).stdout);
    const cli = (lane) => spawnSync(process.execPath, [S('next-action.mjs'), 'baseline', '--lane', lane, '--repo', repo], { encoding: 'utf8' }).stdout;
    check('check-baseline --json: a missing baseline is JSON with baseline "missing"', cb().baseline === 'missing');
    check('next-action baseline: no baseline asks for the depth the lane needs', /^next=ask:onboard-quick /.test(cli('fix')) && /^next=ask:onboard-full /.test(cli('redesign')) && /^next=ask:onboard-quick /.test(cli('lite')));
    put('docs/architecture/baseline.md', `---\ncommit: ${git('rev-parse', 'HEAD')}\ndepth: quick\n---\n## Read this first\nTests: npm test.\n## Stack\nTypeScript. Entry \`src/a.ts:1\`.\n`);
    git('add', '-A'); git('commit', '-qm', 'quick baseline');
    const q = cb();
    check('check-baseline --json: a quick baseline reports depth quick and stays green', q.baseline === 'green' && q.depth === 'quick', JSON.stringify(q));
    check('next-action baseline: a quick baseline is enough for fix, not for the full flow', /^next=continue /.test(cli('fix')) && /^next=ask:onboard-full /.test(cli('feature')));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }

  /* every lane runs the common setup; onboard comes back to the request */
  for (const [f, lane] of [['fix-profile.md', 'fix'], ['change-profile.md', 'change']]) {
    check(`docs: ${f} runs the common setup with the baseline check for its lane`, ref(f).includes('[setup.md](setup.md) steps 1-4') && ref(f).includes(`next-action.mjs baseline --lane ${lane}`));
  }
  check('docs: setup.md step 3 uses next-action.mjs baseline for every lane', setup.includes('next-action.mjs baseline --lane <lane>') && /common setup[^\n]*every lane/.test(setup));
  check('docs: setup saves the request and onboard 0f resumes it', setup.includes('.team/onboard/pending-request.md') && /^\| 0f \|[^\n]*pending-request\.md/m.test(onboard));
  check('docs: every onboard depth commits the baseline and reaches 0f, so the request resumes', ['quick', 'full'].every((d) => /0f/.test(depthRow(d).split(' | ')[2] ?? '')) && /\[Commit\]\(#commit-without-0d\)/.test(depthRow('quick')) && /^## Commit without 0d$/m.test(onboard));
  check('docs: a baseline committed at setup reaches the feature worktree on another base', setup.includes('cherry-pick <sha>') && ['fix-profile.md', 'change-profile.md'].every((f) => ref(f).includes('cherry-picked onto it first')));
  check('docs: a silent refresh with the Stack unchanged has no 0d', /\*\*Silent refresh\*\*[^\n]*skip 0c, 0c' and 0d/.test(onboard));
  check('docs: the researcher writes a quick baseline when asked', read('agents/references/researcher/workflow.md').includes('depth: quick'));

  /* the installer */
  const install = read('install.mjs');
  check('install: the scan runs unless --no-scan', install.includes("const scan = !flag('--no-scan')"));
  check('install: the next step is /muffy <request>, not /muffy onboard', install.includes('/muffy <what you want done>') && !/Run \/muffy onboard once/.test(install));
}
