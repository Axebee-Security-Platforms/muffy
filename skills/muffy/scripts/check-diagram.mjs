#!/usr/bin/env node
// Validates diagram HTML files made from templates/diagram.html (agent-references/shared/diagram-style.md).
//   node check-diagram.mjs <file.html> [more.html ...]
// Checks: the page is the template with only <title> and the #diagram JSON changed; the JSON fits the schema and the size
// limits; every edge points at a real node; no two cards share a grid cell; a straight (same row or column) edge never passes
// through another card. Exit 1 on any FAIL. Zero dependencies.
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const JSON_BLOCK = /(<script type="application\/json" id="diagram">)([\s\S]*?)(<\/script>)/;
const TITLE = /<title>[\s\S]*?<\/title>/;
// kinds drawn as cards on the grid with labelled wires: the node types each allows and its hard limit
const GRID = {
  architecture: { types: ['app', 'service', 'store', 'external', 'queue'], max: 15 },
  state: { types: ['initial', 'state', 'final', 'error'], max: 12 },
  deployment: { types: ['host', 'container', 'store', 'external', 'queue'], max: 15 },
};
const SCREEN_TYPES = ['entry', 'screen', 'modal', 'external'];
// soft budget: above these a diagram is probably two (overview + detail). Printed as WARN, never a FAIL: the onboard overview may need the hard limit
const SOFT = { architecture: { items: 9, links: 12 }, state: { items: 8, links: 12 }, deployment: { items: 9, links: 12 }, screenmap: { items: 12, links: 16 }, erd: { items: 8, links: 10 } };
const UNITS = ['day', 'week', 'sprint', 'month'], AC_ID = /^AC-\d+$/;
export const LIMIT = { gantt: 12, phases: 4, span: 24, activities: 6, releases: 3, stories: 24, cell: 4, screenmap: 20, erd: 12, actors: 6, steps: 12, fields: 12 };
// the hard size of each kind, by its main item; diagram-import.mjs reads it to decide when a draft is too big
export const KIND_MAX = { ...Object.fromEntries(Object.entries(GRID).map(([k, v]) => [k, v.max])), erd: LIMIT.erd, flow: LIMIT.actors, screenmap: LIMIT.screenmap, gantt: LIMIT.gantt, 'story-map': LIMIT.stories };

const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../templates/diagram.html'), 'utf8');
const shell = (html) => html.replace(JSON_BLOCK, '$1$3').replace(TITLE, '<title></title>').replace(/\r\n/g, '\n');
const templateShell = shell(template);

function checkGrid(items, edges, label, errs) {
  const ids = new Set(), cells = new Map(), pos = {};
  for (const n of items) {
    if (!n.id || ids.has(n.id)) errs.push(`${label} id missing or duplicate: ${n.id}`);
    ids.add(n.id);
    if (!Number.isInteger(n.col) || !Number.isInteger(n.row) || n.col < 1 || n.row < 1) errs.push(`${n.id}: col and row must be integers >= 1`);
    const cell = `${n.col},${n.row}`;
    if (cells.has(cell)) errs.push(`${n.id} and ${cells.get(cell)} share grid cell ${cell}`);
    cells.set(cell, n.id); pos[n.id] = n;
  }
  for (const e of edges) {
    if (!pos[e.from] || !pos[e.to]) { errs.push(`edge ${e.from} -> ${e.to}: unknown node`); continue; }
    const a = pos[e.from], b = pos[e.to];
    const between = items.filter((m) => m !== a && m !== b && (
      (a.row === b.row && m.row === a.row && m.col > Math.min(a.col, b.col) && m.col < Math.max(a.col, b.col)) ||
      (a.col === b.col && m.col === a.col && m.row > Math.min(a.row, b.row) && m.row < Math.max(a.row, b.row))));
    if (between.length) errs.push(`edge ${e.from} -> ${e.to} passes through ${between.map((m) => m.id).join(', ')}: move a node so linked nodes are adjacent`);
  }
}

// semantic patterns: an optional `pattern` says what the diagram must make visible, and the rules below enforce the primitives it needs.
// A pattern only adds checks; it never changes the layout or raises a limit
const CAPACITY = /\d+(?:\.\d+)?\s*(?:\/\s*(?:s|sec|min|h|hr|hour|day)\b|per\s+\w+|slots?\b|msgs?\b|jobs?\b|rps\b|rpm\b|tps\b|workers?\b|concurrent\b)/i;
const PATTERNS = {
  'queue-bottleneck': { kinds: ['architecture', 'deployment'], what: 'many producers feeding one finite queue or consumer' },
  lifecycle: { kinds: ['state'], what: 'one subject moving through states to terminal outcomes' },
  'trust-boundary': { kinds: ['architecture', 'deployment'], what: 'which routes cross a trust boundary and which are blocked' },
  'db-schema': { kinds: ['erd'], what: 'physical tables with constraints, references and indexes' },
  delta: { kinds: ['architecture', 'deployment'], what: 'what a change adds, removes or alters in a topology' },
};
const DELTAS = ['added', 'removed', 'changed'];
// readability of the words a reader sees (labels, notes, subtitle). Deterministic heuristics, not a judgement of meaning: the
// wording itself is reviewed by a reader. A note over NOTE_MAX characters, or a label over LABEL_MAX, is a FAIL; a note that packs
// several points into one line (";", "•", " | ", or three or more sentences) is a WARN, because it reads as one block
export const OPTION_MAX = 40, MAX_GROUPS = 2;
export const NOTE_MAX = 160, LABEL_MAX = 60, SUBTITLE_MAX = 140;
export function readability(d) {
  const errs = [], texts = [...(d.nodes ?? []), ...(d.edges ?? []), ...(d.relations ?? []), ...(d.actors ?? []), ...(d.steps ?? []), ...(d.entities ?? [])];
  for (const n of texts) {
    const id = n.id ?? `${n.from} -> ${n.to}`;
    if (typeof n.label === 'string' && n.label.length > LABEL_MAX) errs.push(`${id}: label is ${n.label.length} characters (max ${LABEL_MAX}): shorten it and move the rest to note`);
    if (typeof n.note === 'string' && n.note.length > NOTE_MAX) errs.push(`${id}: note is ${n.note.length} characters (max ${NOTE_MAX}): cut it to the facts a reader needs, or split it with line breaks, one point per line`);
  }
  if (typeof d.subtitle === 'string' && d.subtitle.length > SUBTITLE_MAX) errs.push(`subtitle is ${d.subtitle.length} characters (max ${SUBTITLE_MAX}): one plain sentence`);
  return errs;
}
// plain words for a reader who is not an engineer. Heuristics, so WARN only: code-like tokens, a short list of engineering words,
// and capitalised acronyms in the sentences a reader meets first (subtitle, notes, flow step labels). A name on a card is the code's name and is left alone
const JARGON = /\b(idempoten\w*|payload|endpoint|middleware|webhook|latency|throughput|serializ\w*|deserializ\w*|asynchronous|synchronous|race condition|rollback|cron|regex|oauth|jwt|csrf|cors|ttl|upsert|orchestrat\w*|instantiat\w*|refactor\w*|deprecat\w*|polling|handshake|sharding|failover|backoff|mutex)\b/i;
const CODEISH = /[a-z]+_[a-z_]+|\b[a-z]+[A-Z][A-Za-z]+\b|`|\b(GET|POST|PUT|PATCH|DELETE)\b|(^|\s)\/[a-z{][\w/{}-]*/;
const KNOWN = new Set(['API', 'URL', 'PDF', 'SMS', 'ID', 'UI', 'OK', 'AI', 'FAQ', 'CSV', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']); // everyday, or an HTTP verb (the code check reports those)
const ACRONYM = /\b[A-Z]{2,6}\b/g;
function plainWords(d) {
  const out = [], seenAcr = new Set();
  const spots = [['subtitle', d.subtitle], ...[...(d.nodes ?? []), ...(d.steps ?? []), ...(d.entities ?? [])].flatMap((n) => [[n.id ?? `step ${n.from} -> ${n.to}`, n.note], ...(d.kind === 'flow' && n.label ? [[`step ${n.from} -> ${n.to} label`, n.label]] : [])])];
  for (const [where, t] of spots) {
    if (typeof t !== 'string') continue;
    const j = t.match(JARGON); if (j) out.push(`${where}: "${j[0]}" is an engineering word: say what happens in everyday words`);
    if (CODEISH.test(t)) out.push(`${where}: reads like code (an identifier, path or HTTP verb): say it in a sentence a non-engineer follows, keep the exact name on the card`);
    for (const a of t.match(ACRONYM) ?? []) if (!KNOWN.has(a) && !seenAcr.has(a) && !t.includes(`(${a})`)) { seenAcr.add(a); out.push(`${where}: "${a}" is an acronym: write it out in full where it first appears`); }
  }
  return out;
}
// the order of a flow, read by someone who did not write it
function sequenceReadability(d) {
  if (d.kind !== 'flow') return [];
  const out = [], steps = d.steps ?? [], actors = d.actors ?? [];
  if (steps.length > 8) out.push(`${steps.length} steps (readable limit 8): a non-engineer loses the thread past eight; draw the happy path, and the failure as a second diagram`);
  if (actors.length > 4) out.push(`${actors.length} actors (readable limit 4): merge actors the reader does not need to tell apart`);
  if (steps.length > 5 && !steps.some((s) => s.note)) out.push('no step has a note: with more than five steps, say in a few words why the key steps happen');
  if (steps[0] && actors[0] && steps[0].from !== actors[0].id) out.push(`the first step starts at ${steps[0].from}, not the first actor (${actors[0].id}): put the actor who starts it on the left`);
  for (const a of actors) if (!steps.some((s) => s.from === a.id || s.to === a.id)) out.push(`actor ${a.id} takes part in no step: remove it`);
  steps.forEach((s, i) => { if (s.fail && !s.note) out.push(`step ${i + 1} (${s.label}) fails but does not say what the user sees or what happens next`); });
  return out;
}
function blockNotes(d) {
  const out = [];
  for (const n of [...(d.nodes ?? []), ...(d.steps ?? [])]) {
    const t = n.note;
    if (typeof t !== 'string' || t.includes('\n')) continue;
    const sentences = t.split(/[.!?]\s+/).filter(Boolean).length;
    if (/[;•]| \| /.test(t) || sentences >= 3) out.push(`${n.id ?? `step ${n.from} -> ${n.to}`}: note packs several points into one line: put each point on its own line (use "\\n- point")`);
  }
  return out;
}
// states no one can leave, or reach: a lifecycle diagram that hides a stuck state misleads
export function lifecycleGaps(d) {
  const nodes = d.nodes ?? [], edges = d.edges ?? [], out = [], start = nodes.find((n) => n.type === 'initial');
  const next = (id) => edges.filter((e) => e.from === id).map((e) => e.to);
  const seen = new Set(start ? [start.id] : []), queue = start ? [start.id] : [];
  while (queue.length) for (const t of next(queue.shift())) if (!seen.has(t)) { seen.add(t); queue.push(t); }
  for (const n of nodes) {
    if (start && !seen.has(n.id)) out.push(`${n.id} cannot be reached from the initial node`);
    if ((n.type === 'state' || n.type === 'initial') && !next(n.id).length) out.push(`${n.id} is a dead end: add a transition out, or make it final or error`);
    if (n.type === 'final' && next(n.id).length) out.push(`${n.id} is final but has a transition out`);
  }
  if (!nodes.some((n) => n.type === 'final' || n.type === 'error')) out.push('no final or error node: say how the subject ends');
  return out;
}
function patternErrors(d) {
  const nodes = d.nodes ?? d.entities ?? [], edges = d.edges ?? d.relations ?? [], errs = [], p = PATTERNS[d.pattern];
  if (!p) return [`pattern must be one of ${Object.keys(PATTERNS).join(', ')}`];
  if (!p.kinds.includes(d.kind)) return [`pattern ${d.pattern} is for kind ${p.kinds.join(' or ')}, not ${d.kind}`];
  if (d.pattern === 'db-schema') {
    for (const t of d.entities ?? []) {
      if (!(t.fields ?? []).some((f) => f.key === 'pk')) errs.push(`${t.id}: db-schema needs a primary key (a field with key pk)`);
      for (const f of t.fields ?? []) {
        if (!text(f.type)) errs.push(`${t.id}.${f.name}: db-schema needs the SQL type`);
        if (f.key === 'fk' && !f.ref) errs.push(`${t.id}.${f.name}: a foreign key needs ref ("table_id.column")`);
      }
      if ((t.indexes ?? []).length > 4) errs.push(`${t.id}: at most 4 indexes shown; keep the ones queries depend on`);
    }
    if ((d.entities ?? []).length > 8) errs.push(`db-schema shows at most 8 tables (this has ${d.entities.length}): split by domain`);
    for (const t of d.entities ?? []) for (const f of t.fields ?? []) if (f.ref) { const target = f.ref.split('.')[0]; if (!edges.some((r) => (r.from === t.id && r.to === target) || (r.from === target && r.to === t.id))) errs.push(`${t.id}.${f.name} points at ${f.ref} but no relation is drawn between them`); }
  } else if (d.pattern === 'queue-bottleneck') {
    const qs = nodes.filter((n) => n.type === 'queue');
    if (!qs.length) errs.push('queue-bottleneck needs a node of type queue');
    for (const q of qs) {
      const into = edges.filter((e) => e.to === q.id), out = edges.filter((e) => e.from === q.id);
      if (into.length < 2) errs.push(`queue ${q.id}: needs two or more producers, otherwise there is no contention to show`);
      if (into.length > 5) errs.push(`queue ${q.id}: ${into.length} producers (at most 5): group the rest as one named cohort`);
      if (!out.length) errs.push(`queue ${q.id}: needs an edge to its consumer`);
      if (!CAPACITY.test(q.note ?? '')) errs.push(`queue ${q.id}: note must state a capacity or rate with a unit (for example "8 jobs/min" or "3 workers"), not just "high"`);
    }
  } else if (d.pattern === 'lifecycle') {
    errs.push(...lifecycleGaps(d));
    if (nodes.length > 8) errs.push(`lifecycle shows at most 8 states (this has ${nodes.length}): collapse sub-states`);
  } else if (d.pattern === 'delta') {
    const marked = [...nodes.map((n) => ({ ...n, what: n.id })), ...edges.map((e) => ({ ...e, what: `${e.from} -> ${e.to}` }))].filter((m) => m.delta);
    if (!marked.length) errs.push('delta needs at least one node or link marked added, removed or changed');
    if (marked.length > 8) errs.push(`delta lists at most 8 changes (this has ${marked.length}): show the ones that decide the review`);
    for (const m of marked) if (!text(m.why)) errs.push(`${m.what}: every change needs a why (one short reason)`);
    const gone = new Set(nodes.filter((n) => n.delta === 'removed').map((n) => n.id));
    for (const e of edges) if (e.delta !== 'removed' && (gone.has(e.from) || gone.has(e.to))) errs.push(`link ${e.from} -> ${e.to} touches a removed component: mark it removed too`);
    for (const e of edges.filter((e) => e.delta === 'added')) { const ends = [e.from, e.to].map((i) => nodes.find((n) => n.id === i)); if (ends.some((n) => n?.delta === 'removed')) errs.push(`added link ${e.from} -> ${e.to} points at a removed component`); }
  } else if (d.pattern === 'trust-boundary') {
    const zone = Object.fromEntries(nodes.map((n) => [n.id, n.zone])), zones = new Set(nodes.map((n) => n.zone).filter(Boolean));
    for (const n of nodes) if (!text(n.zone)) errs.push(`${n.id}: trust-boundary needs a zone on every node`);
    if (zones.size < 2 || zones.size > 3) errs.push(`trust-boundary needs 2 or 3 zones (this has ${zones.size})`);
    const cross = edges.filter((e) => zone[e.from] && zone[e.to] && zone[e.from] !== zone[e.to]);
    if (!cross.length) errs.push('no link crosses a zone: the boundary shows nothing');
    if (!cross.some((e) => e.blocked)) errs.push('mark at least one forbidden crossing with blocked: true (the route that must not exist)');
    for (const e of edges.filter((e) => e.blocked)) if (zone[e.from] === zone[e.to]) errs.push(`blocked link ${e.from} -> ${e.to} stays inside one zone: it is not a boundary crossing`);
    if (nodes.length > 9) errs.push(`trust-boundary shows at most 9 nodes (this has ${nodes.length})`);
  }
  return errs;
}

const text = (v) => typeof v === 'string' && v.trim() !== '';
const optText = (v) => v === undefined || typeof v === 'string';

// file: the path the page is saved at; the onboard overview (docs/architecture/overview.html) must carry the commit it was drawn from
export function check(html, file = '') {
  const errs = [];
  const m = html.match(JSON_BLOCK);
  if (!m) return ['no <script type="application/json" id="diagram"> block'];
  if (shell(html) !== templateShell) errs.push('page differs from templates/diagram.html outside <title> and the #diagram JSON: copy the template and edit only those');
  let d;
  try { d = JSON.parse(m[2]); } catch (e) { return [...errs, `diagram JSON does not parse: ${e.message}`]; }
  // the browser ends the block at </script in any case, and <!-- or <script inside it can swallow the real closer
  if (/<\/script|<!--|<script/i.test(m[2])) errs.push('diagram JSON contains "</script", "<script" or "<!--": write "<" as \\u003c');
  if (!Object.hasOwn(KIND_MAX, d.kind)) errs.push(`kind must be ${Object.keys(KIND_MAX).join(', ')}`);
  if (d.pattern !== undefined) errs.push(...patternErrors(d));
  if ([...(d.nodes ?? []), ...(d.edges ?? [])].some((m) => (m?.delta !== undefined && !DELTAS.includes(m.delta)) || !optText(m?.why))) errs.push(`delta must be one of ${DELTAS.join(', ')} and why must be a plain string`);
  if ((d.nodes ?? []).some((n) => !optText(n?.zone)) || (d.edges ?? []).some((e) => e?.blocked !== undefined && typeof e.blocked !== 'boolean')) errs.push('zone must be a plain string and blocked must be true or false');
  if (!text(d.title)) errs.push('title is required');
  if (!optText(d.subtitle)) errs.push('subtitle must be a plain string');
  if (d.caption !== undefined) errs.push('caption was removed from the format: put the one sentence in subtitle, or leave it out');
  if (d.commit !== undefined && !/^[0-9a-f]{7,40}$/.test(String(d.commit))) errs.push('commit must be a git SHA (7 to 40 hex characters)');
  if (/(^|[\\/])docs[\\/]architecture[\\/]overview\.html$/.test(file) && d.commit === undefined) errs.push('the architecture overview needs commit (the SHA it was drawn from) so staleness is visible');
  // every label is drawn with textContent: anything but a string shows as [object Object] or "undefined"
  const items = [...(d.nodes ?? []), ...(d.edges ?? []), ...(d.relations ?? []), ...(d.actors ?? []), ...(d.steps ?? [])];
  if (items.some((n) => !optText(n?.label) || !optText(n?.note))) errs.push('every label and note must be a plain string');
  errs.push(...readability(d));
  for (const n of d.entities ?? []) if (!optText(n?.name) || !optText(n?.note) || (n.fields ?? []).some((f) => !text(f?.name) || !optText(f?.type))) errs.push(`${n?.id}: name, note and field name/type must be plain strings`);
  if (d.kind === 'screenmap') {
    const nodes = d.nodes ?? [], edges = d.edges ?? [];
    if (!nodes.length || nodes.length > LIMIT.screenmap) errs.push(`nodes must be 1 to ${LIMIT.screenmap}`);
    for (const n of nodes) { if (!SCREEN_TYPES.includes(n.type)) errs.push(`${n.id}: type must be one of ${SCREEN_TYPES.join(', ')}`); if (!n.label) errs.push(`${n.id}: label is required`); }
    for (const e of edges) if (!e.label) errs.push(`edge ${e.from} -> ${e.to}: label is required (the action that causes it)`);
    checkGrid(nodes, edges, 'node', errs);
  } else if (GRID[d.kind]) {
    const { types, max } = GRID[d.kind], nodes = d.nodes ?? [], edges = d.edges ?? [];
    if (!nodes.length || nodes.length > max) errs.push(`nodes must be 1 to ${max}`);
    for (const n of nodes) { if (!types.includes(n.type)) errs.push(`${n.id}: type must be one of ${types.join(', ')}`); if (!n.label) errs.push(`${n.id}: label is required`); }
    for (const e of edges) if (!e.label) errs.push(`edge ${e.from} -> ${e.to}: label is required${d.kind === 'state' ? ' (event, and the guard in [brackets] when there is one)' : ''}`);
    // a state machine starts in exactly one place; without it the reader cannot tell where the subject begins
    if (d.kind === 'state' && nodes.filter((n) => n.type === 'initial').length !== 1) errs.push('a state diagram needs exactly one node of type initial');
    checkGrid(nodes, edges, 'node', errs);
  } else if (d.kind === 'erd') {
    const ents = d.entities ?? [], rels = d.relations ?? [];
    if (!ents.length || ents.length > LIMIT.erd) errs.push(`entities must be 1 to ${LIMIT.erd}`);
    for (const n of ents) {
      if (!n.name) errs.push(`${n.id}: name is required`);
      if ((n.fields ?? []).length > LIMIT.fields) errs.push(`${n.id}: more than ${LIMIT.fields} fields; list only keys and the columns this change touches`);
      for (const f of n.fields ?? []) {
        if (f.key && !['pk', 'fk'].includes(f.key)) errs.push(`${n.id}.${f.name}: key must be pk or fk`);
        if (['notNull', 'unique'].some((k) => f[k] !== undefined && typeof f[k] !== 'boolean') || !optText(f.default) && typeof f.default !== 'number' && typeof f.default !== 'boolean') errs.push(`${n.id}.${f.name}: notNull and unique are true or false, default is plain text`);
        if (f.ref !== undefined) {
          const m = typeof f.ref === 'string' && f.ref.match(/^([\w-]+)\.([\w-]+)$/), target = m && ents.find((e) => e.id === m[1]);
          if (!m) errs.push(`${n.id}.${f.name}: ref must look like "table_id.column"`);
          else if (!target || !(target.fields ?? []).some((g) => g.name === m[2])) errs.push(`${n.id}.${f.name}: ref ${f.ref} names a table or column that is not in this diagram`);
        }
      }
      for (const x of n.indexes ?? []) if (!Array.isArray(x.columns) || !x.columns.length || x.columns.some((c) => !(n.fields ?? []).some((f) => f.name === c))) errs.push(`${n.id}: every index needs columns that exist on the table`);
    }
    for (const r of rels) if (!r.label) errs.push(`relation ${r.from} -> ${r.to}: label is required (for example "1 : N")`);
    checkGrid(ents, rels, 'entity', errs);
  } else if (d.kind === 'gantt') {
    const phases = d.phases ?? [], tasks = d.tasks ?? [], pid = new Set(phases.map((p) => p.id)), byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    if (!UNITS.includes(d.unit)) errs.push(`unit must be one of ${UNITS.join(', ')} (start and length are counted in it, not dates)`);
    if (!phases.length || phases.length > LIMIT.phases) errs.push(`phases must be 1 to ${LIMIT.phases}`);
    if (pid.size !== phases.length || phases.some((p) => !p.id || !text(p.label))) errs.push('phase id missing or duplicate, or label missing');
    if (!tasks.length || tasks.length > LIMIT.gantt) errs.push(`tasks must be 1 to ${LIMIT.gantt}`);
    if (Object.keys(byId).length !== tasks.length || tasks.some((t) => !t.id)) errs.push('task id missing or duplicate');
    const end = (t) => (t.start ?? 0) + (t.milestone ? 0 : (t.length ?? 1));
    for (const t of tasks) {
      if (!text(t.label)) errs.push(`${t.id}: label is required`);
      if (!pid.has(t.phase)) errs.push(`${t.id}: phase must be one of the phases`);
      if (!Number.isInteger(t.start) || t.start < 0) errs.push(`${t.id}: start must be an integer of 0 or more`);
      if (t.milestone) { if (t.length !== undefined) errs.push(`${t.id}: a milestone has no length`); } else if (!Number.isInteger(t.length) || t.length < 1) errs.push(`${t.id}: length must be an integer of 1 or more`);
      if (end(t) > LIMIT.span) errs.push(`${t.id}: ends after unit ${LIMIT.span}: split the plan or use a larger unit`);
      for (const a of t.after ?? []) { const dep = byId[a]; if (!dep || a === t.id) errs.push(`${t.id}: after names an unknown task: ${a}`); else if ((t.start ?? 0) < end(dep)) errs.push(`${t.id} starts at ${t.start} but ${a} ends at ${end(dep)}: start no earlier than its dependencies end`); }
      for (const a of t.ac ?? []) if (!AC_ID.test(a)) errs.push(`${t.id}: ac must be ids like AC-3`);
    }
  } else if (d.kind === 'story-map') {
    const acts = d.activities ?? [], rels = d.releases ?? [], stories = d.stories ?? [], aid = new Set(acts.map((a) => a.id)), rid = new Set(rels.map((r) => r.id));
    if (!acts.length || acts.length > LIMIT.activities) errs.push(`activities must be 1 to ${LIMIT.activities}`);
    if (!rels.length || rels.length > LIMIT.releases) errs.push(`releases must be 1 to ${LIMIT.releases}`);
    if (aid.size !== acts.length || rid.size !== rels.length || [...acts, ...rels].some((x) => !x.id || !text(x.label))) errs.push('activity or release id missing or duplicate, or label missing');
    if (!stories.length || stories.length > LIMIT.stories) errs.push(`stories must be 1 to ${LIMIT.stories}`);
    if (new Set(stories.map((s) => s.id)).size !== stories.length || stories.some((s) => !s.id)) errs.push('story id missing or duplicate');
    if (d.cut !== undefined && !rid.has(d.cut)) errs.push('cut must be a release id');
    const cells = {};
    for (const s of stories) {
      if (!text(s.label)) errs.push(`${s.id}: label is required`);
      if (!aid.has(s.activity)) errs.push(`${s.id}: activity must be one of the activities`);
      if (!rid.has(s.release)) errs.push(`${s.id}: release must be one of the releases`);
      for (const a of s.ac ?? []) if (!AC_ID.test(a)) errs.push(`${s.id}: ac must be ids like AC-3`);
      const k = `${s.release}/${s.activity}`; cells[k] = (cells[k] ?? 0) + 1;
      if (cells[k] === LIMIT.cell + 1) errs.push(`${s.release} / ${s.activity} holds more than ${LIMIT.cell} stories: move some to a later release`);
    }
  } else if (d.kind === 'flow') {
    const actors = d.actors ?? [], steps = d.steps ?? [], ids = new Set(actors.map((a) => a.id));
    if (!actors.length || actors.length > LIMIT.actors) errs.push(`actors must be 1 to ${LIMIT.actors}`);
    if (ids.size !== actors.length || actors.some((a) => !a.id)) errs.push('actor id missing or duplicate');
    for (const a of actors) if (!text(a.label)) errs.push(`actor ${a.id}: label is required`);
    if (!steps.length || steps.length > LIMIT.steps) errs.push(`steps must be 1 to ${LIMIT.steps}`);
    steps.forEach((s, i) => { if (!ids.has(s.from) || !ids.has(s.to)) errs.push(`step ${i + 1}: unknown actor`); if (!s.label) errs.push(`step ${i + 1}: label is required`); });
    // either/or frames: a step with group + option belongs to one branch; the steps of a group are adjacent, each option is one run, one level only
    const groups = new Map(), seenRun = new Set();
    steps.forEach((s, i) => {
      if ((s.group === undefined) !== (s.option === undefined)) { errs.push(`step ${i + 1}: group and option go together`); return; }
      if (s.group === undefined) return;
      if (!text(s.group) || !text(s.option)) errs.push(`step ${i + 1}: group and option must be non-empty text`);
      else if (s.option.length > OPTION_MAX) errs.push(`step ${i + 1}: option is ${s.option.length} characters (max ${OPTION_MAX}): name the case in a few words`);
      const p = steps[i - 1], runKey = `${s.group}|${s.option}`;
      if (!p || p.group !== s.group) { if (groups.has(s.group)) errs.push(`step ${i + 1}: group "${s.group}" is not adjacent: keep its steps together`); groups.set(s.group, new Set()); }
      if (!p || p.group !== s.group || p.option !== s.option) { if (seenRun.has(runKey)) errs.push(`step ${i + 1}: option "${s.option}" is split in two: keep its steps together`); seenRun.add(runKey); }
      groups.get(s.group)?.add(s.option);
    });
    for (const [g, opts] of groups) if (opts.size < 2) errs.push(`group "${g}" has one option: an either/or needs at least two, otherwise drop group and option`);
    if (groups.size > MAX_GROUPS) errs.push(`at most ${MAX_GROUPS} either/or groups: split the flow`);
  }
  return errs;
}

// advisory lines: the diagram is valid but dense. The author runs the remove test (can a node be dropped or merged, can a link be implied by layout) before hand-off
export function warnings(html) {
  const m = html.match(JSON_BLOCK); let d;
  try { d = JSON.parse(m[2]); } catch { return []; }
  const blocks = [...blockNotes(d), ...plainWords(d), ...sequenceReadability(d)];
  if (d.kind === 'gantt') return (d.tasks ?? []).length > 8 ? [`${d.tasks.length} tasks (soft limit 8): show phases or the critical path, and keep the rest in docs/plan`] : [];
  if (d.kind === 'story-map') {
    const out = [], first = (d.releases ?? [])[0]?.id;
    if ((d.stories ?? []).length > 16) out.push(`${d.stories.length} stories (soft limit 16): the map should be readable at a glance`);
    for (const a of d.activities ?? []) if (first && !(d.stories ?? []).some((s) => s.activity === a.id && s.release === first)) out.push(`${a.id} has no story in the first release: it is not an end-to-end slice`);
    for (const s of (d.stories ?? []).filter((s) => s.release === first && !(s.ac ?? []).length)) out.push(`${s.id} is in the first release but links no acceptance criteria (ac)`);
    return out;
  }
  const soft = SOFT[d.kind]; if (!soft) return blocks;
  const items = (d.nodes ?? d.entities ?? []).length, links = (d.edges ?? d.relations ?? []).length, out = [];
  if (d.kind === 'state' && d.pattern !== 'lifecycle') out.push(...lifecycleGaps(d).map((g) => `${g} (set pattern: "lifecycle" to make this a failure)`));
  if (items > soft.items) out.push(`${items} ${d.kind === 'erd' ? 'entities' : 'nodes'} (soft limit ${soft.items}): split into an overview and a detail diagram unless this is the onboard overview`);
  if (links > soft.links) out.push(`${links} links (soft limit ${soft.links}): drop any link the layout already makes obvious`);
  return [...blocks, ...out];
}

// compared by file name, like the other checkers: argv[1] is not resolved through a symlink or junction, import.meta.url is
if (basename(process.argv[1] ?? '') === 'check-diagram.mjs') {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: check-diagram.mjs <file.html> [more.html ...]'); process.exit(1); }
  let bad = 0;
  for (const f of files) {
    let errs;
    try { errs = check(readFileSync(f, 'utf8'), f); } catch (e) { errs = [e.message]; }
    if (errs.length) { bad++; console.log(`FAIL ${f}`); errs.forEach((e) => console.log(`  - ${e}`)); } else { console.log(`PASS ${f}`); warnings(readFileSync(f, 'utf8')).forEach((w) => console.log(`  WARN ${w}`)); }
  }
  process.exit(bad ? 1 : 0);
}
