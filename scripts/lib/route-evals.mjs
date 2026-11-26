// Offline checks for routing (skills/muffy/references/route.md):
//   - every scenario routes as expected through route-sim.mjs (the decision order)
//   - the doc's Examples table and evals/route-scenarios.json list the same prompts and routes
//   - every route in the Routes table has a minimum-intake row, and the sim knows every route
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { route, routeAsk, INTAKE, ROUTES, NOT_DESIGNED_ROUTE } from './route-sim.mjs';

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
  for (const r of ['none', 'fix', 'change', 'full', 'ask', 'resume', 'diagram', 'diagram-in-task']) check(`route: "${r}" has a scenario`, scenarios.some((x) => x.expect === r));
  check('route: a Thai prompt exists for at least half the scenarios', scenarios.filter((x) => /[฀-๿]/.test(x.request)).length * 2 >= scenarios.length);

  /* doc Examples ↔ scenarios */
  const exDoc = readFileSync(rel('skills/muffy/references/route-examples.md'), 'utf8');
  const examples = tableRows(exDoc, /^\| Prompt /);
  check('route-doc: Examples table found in route-examples.md', examples.length >= 20, `rows=${examples.length}`);
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
    if (['diagram', 'diagram-in-task', 'present', 'todo', 'onboard', 'resume'].includes(r)) continue; // modes carry their own intake
    check(`route-doc: route "${r}" has a minimum-intake row`, intake.includes(r));
  }
  for (const r of routed) check(`route-sim: knows route "${r}"`, ROUTES.includes(r));
  /* held-out live set: valid routes, and never copied into route.md (that would leak the answers) */
  const live = JSON.parse(readFileSync(rel('evals/route-live-scenarios.json'), 'utf8')).scenarios;
  check('route-live: every expected route is a known route', live.every((x) => ROUTES.includes(x.expect)), live.filter((x) => !ROUTES.includes(x.expect)).map((x) => x.id).join(', '));
  check('route-live: no held-out prompt appears in route.md or route-examples.md', live.every((x) => !doc.includes(x.prompt) && !exDoc.includes(x.prompt)), live.filter((x) => doc.includes(x.prompt) || exDoc.includes(x.prompt)).map((x) => x.id).join(', '));
  check('route-live: ids are unique', new Set(live.map((x) => x.id)).size === live.length);
  /* diagram kinds: the sim and diagram.md's Kinds table agree on each kind's not-designed route */
  const dia = readFileSync(rel('skills/muffy/references/diagram.md'), 'utf8');
  const kinds = tableRows((dia.split(/^## Kinds.*$/m)[1] ?? '').split(/^## /m)[0], /^\| Kind /);
  check('diagram-doc: the Kinds table lists all eight kinds', kinds.flatMap((r) => r[0].match(/`[a-z-]+`/g) ?? []).length === 8, `rows=${kinds.length}`);
  for (const [k, , nd] of kinds) for (const kind of (k.match(/`([a-z-]+)`/g) ?? []).map((x) => x.slice(1, -1))) check(`diagram-doc: not-designed route of ${kind} matches the sim`, nd.split(' ')[0] === NOT_DESIGNED_ROUTE[kind], `doc "${nd}" vs sim "${NOT_DESIGNED_ROUTE[kind]}"`);
  check('route-doc: the decision order has seven steps', (section('Decision order').match(/^\d\. \*\*/gm) ?? []).length === 7);

  /* the script the Orchestrator runs (route.mjs): the printed route, the lane to start, and the one question when nothing fits */
  const cli = (signals, ...extra) => { const r = spawnSync(process.execPath, [rel('skills/muffy/scripts/route.mjs'), JSON.stringify(signals), ...extra], { encoding: 'utf8' }); return { status: r.status, out: r.stdout, err: r.stderr }; };
  const fixed = cli({ outcome: 'code', bug: true, fix: { has_symptom: true, has_location: true } });
  check('route.mjs: a bug with a symptom and a place prints the fix route and the lane to start (exit 0)', fixed.status === 0 && /next=route:fix step=6/.test(fixed.out) && /lane=fix/.test(fixed.out), fixed.out);
  check('route.mjs: a new capability is the full flow, started as the feature lane', /next=route:full/.test(cli({ outcome: 'code', new_capability: true }).out) && /lane=feature/.test(cli({ outcome: 'code', new_capability: true }).out));
  check('route.mjs: diagnose only is the fix lane stopping at 4b', /next=route:fix step=4 until=4b/.test(cli({ stop_point: 'diagnose', fix: { has_symptom: true, has_location: true } }).out));
  const ask1 = cli({ outcome: 'code' });
  check('route.mjs: a code change of unknown kind asks "is something broken" first, in Thai by default (exit 1)', ask1.status === 1 && /question=broken/.test(ask1.out) && /[฀-๿]/.test(ask1.out), ask1.out);
  check('route.mjs: --lang en asks in English', /text=Is something broken or wrong\?/.test(cli({ outcome: 'code' }, '--lang', 'en').out));
  check('route.mjs: after "not broken" the next question is exists-or-new, then visible', /question=exists-or-new/.test(cli({ outcome: 'code', bug: false }).out) && /question=visible/.test(cli({ outcome: 'code', bug: false, new_capability: false, change_existing: false }).out));
  check('route.mjs: a route that misses an intake fact asks for that fact, not a route', /question=intake:fix/.test(cli({ outcome: 'code', bug: true, missing_intake: true }).out) && /question=intake:verify/.test(cli({ outcome: 'verify', missing_intake: true }).out));
  check('route.mjs: bad input is a usage error (exit 2)', cli('x').status !== undefined && spawnSync(process.execPath, [rel('skills/muffy/scripts/route.mjs'), '{not json'], { encoding: 'utf8' }).status === 2 && spawnSync(process.execPath, [rel('skills/muffy/scripts/route.mjs')], { encoding: 'utf8' }).status === 2);
  check('route.mjs: every question id and every intake route has words in both languages', ['broken', 'exists-or-new', 'visible', 'which-route'].every((id) => { const q = routeAsk(id === 'broken' ? { outcome: 'code' } : id === 'exists-or-new' ? { outcome: 'code', bug: false } : id === 'visible' ? { outcome: 'code', bug: false, change_existing: false, new_capability: false } : {}); return q.id === id && q.th && q.en; }) && Object.values(INTAKE).every((q) => q.th && q.en));
}
