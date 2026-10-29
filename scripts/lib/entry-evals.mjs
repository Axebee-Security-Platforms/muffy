// Offline checks for the simple entry (skills/muffy/references/menu.md, route.md "Say the plan" and "Stop points", README):
//   - the plan card shows every step a lane runs, none it skips, and cuts at a stop point
//   - a bare /muffy, /muffy todo and /muffy resume with no task show the menu
//   - each lane asks its plan card first at pause:scope; route.md no longer prescribes a `Route:` line
//   - every README example is a route scenario with the same route, so the README never promises a route the order does not give
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { LANES, SCOPES, VISIBLE_SCOPES, STEP_LABELS, skipsOf, planCard } from '../../skills/muffy/scripts/lanes.mjs';
import { route, ROUTES, NON_CODE_ROUTES } from './route-sim.mjs';

export function runEntryEvals({ check, root }) {
  const read = (...p) => readFileSync(join(root, ...p), 'utf8').replace(/\r\n/g, '\n');
  const ref = (f) => read('skills/muffy/references', f);

  /* the plan card */
  const pairs = [...Object.keys(LANES).filter((l) => l !== 'change').map((l) => [l, undefined]), ...SCOPES.map((s) => ['change', s])];
  for (const [lane, scope] of pairs) {
    for (const lang of ['th', 'en']) {
      const card = planCard(lane, { scope, lang });
      const steps = card[1];
      const runs = Object.keys(STEP_LABELS).filter((s) => !skipsOf(lane, scope).includes(s) && (lane === 'fix' || !['4a', '4b'].includes(s)));
      check(`plan card: ${lane}${scope ? ` (${scope})` : ''} ${lang} lists one step per step the lane runs`, steps.split(' → ').length === runs.length, steps);
      check(`plan card: ${lane}${scope ? ` (${scope})` : ''} ${lang} names no lane id and ends at the default stop`, !/\b(lite|fix lane|redesign|feature)\b/i.test(card.slice(1).join('\n')) && /docker local/.test(card.at(-1)), card.join(' | '));
    }
  }
  check('plan card: --until cuts the steps at the stop point', planCard('feature', { until: '2b' })[1].split(' → ').length === 3 && planCard('feature', { until: '2b' }).at(-1).includes(STEP_LABELS['2b'].th));
  check('plan card: a run skip (3d) leaves the card', !planCard('lite', { skip: ['3d'] })[1].includes(STEP_LABELS['3d'].th) && planCard('lite')[1].includes(STEP_LABELS['3d'].th));
  let refused = '';
  try { planCard('redesign'); } catch (e) { refused = e.message; }
  check('plan card: redesign without a scope is refused (the scope is asked first)', /needs a scope/.test(refused), refused);

  /* where the card is shown */
  const routeDoc = ref('route.md');
  check('docs: route.md shows the plan, not a `Route:` line', /^## Say the plan$/m.test(routeDoc) && routeDoc.includes('next-action.mjs plan-card') && !routeDoc.includes('`Route: <name> → <agents>'));
  for (const [f, lane] of [['setup.md', 'feature'], ['fix-profile.md', 'fix --scope <bug | cosmetic>'], ['change-profile.md', 'change --scope internal']]) {
    check(`docs: ${f} asks the plan card first at pause:scope`, ref(f).includes(`**Plan**: the card from \`next-action.mjs plan-card ${lane}\``));
  }
  check('docs: a visible change asks the scope alone, then the card', /the \*\*Scope\*\* question alone, then one call with the plan card/.test(ref('change-profile.md')));
  const stops = (routeDoc.split(/^## Stop points$/m)[1] ?? '').split(/^## /m)[0].split('\n').filter((l) => /^\| (?!The requester|---)/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  check('docs: the Stop points table has a row per stop', stops.length >= 5, `rows=${stops.length}`);
  // a single-step route shows one line; a stop inside a lane is that lane's card with --until at a step the lane runs
  const laneStop = (r, card) => { const m = card.match(/^(\w+) `--until (\w+)`$/); return !!m && m[1] === r && !!LANES[r] && !skipsOf(r).includes(m[2]) && !!STEP_LABELS[m[2]]; };
  check('docs: every stop point is a single-step route shown as one line, or a lane stopped at a step it runs, never a card it would not run', stops.every(([, , r, card]) => (r.split(/ or /).every((x) => NON_CODE_ROUTES.includes(x.trim())) && card === 'one line') || laneStop(r.trim(), card)), JSON.stringify(stops.map((s) => [s[2], s[3]])));
  check('docs: the Stop points table has the diagnose-only stop', stops.some(([, , r, card]) => r === 'fix' && card === 'fix `--until 4b`'));
  check('docs: fix and internal-change cards offer no stop earlier (no stop point exists inside them)', /plan-card fix --scope <bug \| cosmetic>`, go \/ bigger \(/.test(ref('fix-profile.md')) && /plan-card change --scope internal`, go \/ bigger \(/.test(ref('change-profile.md')));

  /* the menu */
  check('menu: menu.md exists and SKILL.md, resume.md and todo.md send to it', existsSync(join(root, 'skills/muffy/references/menu.md')) && read('skills/muffy/SKILL.md').includes('[menu.md](references/menu.md)') && ref('resume.md').includes('[menu.md](menu.md)') && ref('todo.md').includes('[menu.md](menu.md)'));
  check('menu: a bare /muffy routes to the menu; /muffy resume with no task stays resume', route({ bare: true }).route === 'menu' && route({ bare: true, resume: true }).route === 'resume');
  check('menu: resume.md, menu.md and route.md agree on /muffy resume with no task', ref('resume.md').includes('Several, or none → show the menu') && ref('menu.md').includes('not exactly one unfinished task') && routeDoc.includes('one unfinished task goes straight in'));
  check('menu: the menu shows no lane names or pause ids to the requester', /Never show lane names, step numbers or pause ids/.test(ref('menu.md')));

  /* the README examples */
  const scenarios = JSON.parse(read('evals/route-scenarios.json'));
  const readme = read('README.md');
  const rows = (readme.split(/^### Use it$/m)[1] ?? '').split(/^### /m)[0].split('\n').filter((l) => /^\| `\/muffy/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  check('readme: the Use it table has examples', rows.length >= 8, `rows=${rows.length}`);
  for (const [typed, , under] of rows) {
    const prompt = typed.replace(/^`\/muffy /, '').replace(/`$/, '');
    const sc = scenarios.find((x) => x.request === prompt);
    const want = under === 'full flow' ? 'full' : under;
    check(`readme: "${prompt.slice(0, 40)}" is a route scenario routed to ${want}`, !!sc && sc.expect === want && route(sc.signals).route === want, sc ? `scenario expects ${sc.expect}` : 'add it to evals/route-scenarios.json');
  }
  const sample = (readme.split(/^Before anything starts you see the plan, for example:$/m)[1] ?? '').match(/```text\n([\s\S]*?)\n```/)?.[1];
  check('readme: the sample card is what planCard("fix") prints today', sample === planCard('fix').join('\n'), sample);
  check('plan card: step 11 is "if needed" exactly where the lane may skip docs (not redesign)', ['feature', 'fix', 'lite'].every((l) => planCard(l)[1].endsWith('(ถ้าจำเป็น)')) && VISIBLE_SCOPES.every((s) => !planCard('redesign', { scope: s })[1].endsWith('(ถ้าจำเป็น)')));
  check('readme: the commands table leads with /muffy <request> and a bare /muffy', /\| `\/muffy <request>` \|[^\n]*\n\| `\/muffy` \|/.test(readme));
}
