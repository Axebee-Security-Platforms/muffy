// Offline checks for routing (skills/muffy/references/route.md):
//   - every scenario routes as expected through route-sim.mjs (the decision order)
//   - the doc's Examples table and evals/route-scenarios.json list the same prompts and routes
//   - every route in the Routes table has a minimum-intake row, and the sim knows every route
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { route, ROUTES } from './route-sim.mjs';

const unquote = (req) => req.replace(/^"|"$/g, '');
const toId = (label) => ({ 'full flow': 'full', 'ask first': 'ask' })[label] ?? label;
const tableRows = (section, skip) =>
  section
    .split(/\r?\n/)
    .filter((l) => /^\| /.test(l) && !/^\|[-| ]+\|$/.test(l) && !skip.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));

export function runRouteEvals({ check, root }) {
  const rel = (...p) => join(root, ...p);
  const doc = readFileSync(rel('skills/muffy/references/route.md'), 'utf8');
  const scenarios = JSON.parse(readFileSync(rel('evals/route-scenarios.json'), 'utf8'));
  const section = (h) => (doc.split(new RegExp(`^## ${h}\\s*$`, 'm'))[1] ?? '').split(/^## /m)[0];

  /* the decision order */
  for (const sc of scenarios) {
    const out = route(sc.signals);
    check(`route:${sc.id}`, out.route === sc.expect, `expected ${sc.expect}, got ${out.route} (step ${out.step})`);
  }
  for (const r of ['none', 'fix', 'lite', 'full', 'ask', 'resume']) check(`route: "${r}" has a scenario`, scenarios.some((x) => x.expect === r));
  check('route: a Thai prompt exists for at least half the scenarios', scenarios.filter((x) => /[฀-๿]/.test(x.request)).length * 2 >= scenarios.length);

  /* doc Examples ↔ scenarios */
  const examples = tableRows(section('Examples'), /^\| Prompt /);
  check('route-doc: Examples table found in route.md', examples.length >= 20, `rows=${examples.length}`);
  for (const [req, label] of examples) {
    const sc = scenarios.find((x) => x.request === unquote(req));
    check(`route-doc: "${unquote(req).slice(0, 40)}" has a scenario`, !!sc, 'add it to evals/route-scenarios.json');
    if (sc) check(`route-doc: route of "${unquote(req).slice(0, 40)}" matches`, sc.doc_route === label && toId(label) === sc.expect, `doc "${label}" vs scenario "${sc.doc_route}" → ${sc.expect}`);
  }
  check('route-doc: every scenario with a doc_route is in the Examples table', scenarios.filter((x) => x.doc_route).every((x) => examples.some(([r]) => unquote(r) === x.request)));

  /* Routes table ↔ minimum intake ↔ sim */
  const routes = tableRows(section('Routes'), /^\| The prompt asks for /).map((r) => r[1].replace(/\s*\(.*\)$/, ''));
  const intake = tableRows(section('Minimum intake \\(ask before spawning\\)'), /^\| Route /).map((r) => r[0]);
  const routed = routes.map(toId);
  for (const r of new Set(routes)) {
    if (['diagram', 'present', 'analyze', 'onboard', 'resume'].includes(r)) continue; // modes carry their own intake
    check(`route-doc: route "${r}" has a minimum-intake row`, intake.includes(r));
  }
  for (const r of routed) check(`route-sim: knows route "${r}"`, ROUTES.includes(r));
  check('route-doc: the decision order has seven steps', (section('Decision order').match(/^\d\. \*\*/gm) ?? []).length === 7);
}
