#!/usr/bin/env node
// Validates diagram HTML files made from templates/diagram.html (references/diagram-style.md).
//   node check-diagram.mjs <file.html> [more.html ...]
// Checks: the page is the template with only <title> and the #diagram JSON changed; the JSON fits the schema and the size
// limits; every edge points at a real node; no two cards share a grid cell; a straight (same row or column) edge never passes
// through another card. Exit 1 on any FAIL. Zero dependencies.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const JSON_BLOCK = /(<script type="application\/json" id="diagram">)([\s\S]*?)(<\/script>)/;
const TITLE = /<title>[\s\S]*?<\/title>/;
const NODE_TYPES = ['app', 'service', 'store', 'external', 'queue'];
const LIMIT = { architecture: 15, erd: 12, actors: 6, steps: 12, fields: 12, caption: 160 };

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

export function check(html) {
  const errs = [];
  const m = html.match(JSON_BLOCK);
  if (!m) return ['no <script type="application/json" id="diagram"> block'];
  if (shell(html) !== templateShell) errs.push('page differs from templates/diagram.html outside <title> and the #diagram JSON: copy the template and edit only those');
  let d;
  try { d = JSON.parse(m[2]); } catch (e) { return [...errs, `diagram JSON does not parse: ${e.message}`]; }
  if (m[2].includes('</script')) errs.push('diagram JSON contains "</script"');
  if (!['architecture', 'erd', 'flow'].includes(d.kind)) errs.push('kind must be architecture, erd or flow');
  if (!d.title || typeof d.title !== 'string') errs.push('title is required');
  if (d.caption && d.caption.length > LIMIT.caption) errs.push(`caption is over ${LIMIT.caption} characters`);
  if (d.kind === 'architecture') {
    const nodes = d.nodes ?? [], edges = d.edges ?? [];
    if (!nodes.length || nodes.length > LIMIT.architecture) errs.push(`nodes must be 1 to ${LIMIT.architecture}`);
    for (const n of nodes) { if (!NODE_TYPES.includes(n.type)) errs.push(`${n.id}: type must be one of ${NODE_TYPES.join(', ')}`); if (!n.label) errs.push(`${n.id}: label is required`); }
    for (const e of edges) if (!e.label) errs.push(`edge ${e.from} -> ${e.to}: label is required`);
    checkGrid(nodes, edges, 'node', errs);
  } else if (d.kind === 'erd') {
    const ents = d.entities ?? [], rels = d.relations ?? [];
    if (!ents.length || ents.length > LIMIT.erd) errs.push(`entities must be 1 to ${LIMIT.erd}`);
    for (const n of ents) {
      if (!n.name) errs.push(`${n.id}: name is required`);
      if ((n.fields ?? []).length > LIMIT.fields) errs.push(`${n.id}: more than ${LIMIT.fields} fields; list only keys and the columns this change touches`);
      for (const f of n.fields ?? []) if (f.key && !['pk', 'fk'].includes(f.key)) errs.push(`${n.id}.${f.name}: key must be pk or fk`);
    }
    for (const r of rels) if (!r.label) errs.push(`relation ${r.from} -> ${r.to}: label is required (for example "1 : N")`);
    checkGrid(ents, rels, 'entity', errs);
  } else if (d.kind === 'flow') {
    const actors = d.actors ?? [], steps = d.steps ?? [], ids = new Set(actors.map((a) => a.id));
    if (!actors.length || actors.length > LIMIT.actors) errs.push(`actors must be 1 to ${LIMIT.actors}`);
    if (!steps.length || steps.length > LIMIT.steps) errs.push(`steps must be 1 to ${LIMIT.steps}`);
    steps.forEach((s, i) => { if (!ids.has(s.from) || !ids.has(s.to)) errs.push(`step ${i + 1}: unknown actor`); if (!s.label) errs.push(`step ${i + 1}: label is required`); });
  }
  return errs;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: check-diagram.mjs <file.html> [more.html ...]'); process.exit(1); }
  let bad = 0;
  for (const f of files) {
    let errs;
    try { errs = check(readFileSync(f, 'utf8')); } catch (e) { errs = [e.message]; }
    if (errs.length) { bad++; console.log(`FAIL ${f}`); errs.forEach((e) => console.log(`  - ${e}`)); } else console.log(`PASS ${f}`);
  }
  process.exit(bad ? 1 : 0);
}
