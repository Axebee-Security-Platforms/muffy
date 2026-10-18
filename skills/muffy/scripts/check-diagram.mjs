#!/usr/bin/env node
// Validates diagram HTML files made from templates/diagram.html (references/diagram-style.md).
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
const LIMIT = { screenmap: 20, erd: 12, actors: 6, steps: 12, fields: 12, caption: 160 };

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
  if (![...Object.keys(GRID), 'erd', 'flow', 'screenmap'].includes(d.kind)) errs.push(`kind must be ${[...Object.keys(GRID), 'erd', 'flow', 'screenmap'].join(', ')}`);
  if (!text(d.title)) errs.push('title is required');
  if (!optText(d.subtitle) || !optText(d.caption)) errs.push('subtitle and caption must be plain strings');
  if (typeof d.caption === 'string' && d.caption.length > LIMIT.caption) errs.push(`caption is over ${LIMIT.caption} characters`);
  if (d.commit !== undefined && !/^[0-9a-f]{7,40}$/.test(String(d.commit))) errs.push('commit must be a git SHA (7 to 40 hex characters)');
  if (/(^|[\\/])docs[\\/]architecture[\\/]overview\.html$/.test(file) && d.commit === undefined) errs.push('the architecture overview needs commit (the SHA it was drawn from) so staleness is visible');
  // every label is drawn with textContent: anything but a string shows as [object Object] or "undefined"
  const items = [...(d.nodes ?? []), ...(d.edges ?? []), ...(d.relations ?? []), ...(d.actors ?? []), ...(d.steps ?? [])];
  if (items.some((n) => !optText(n?.label) || !optText(n?.note))) errs.push('every label and note must be a plain string');
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
      for (const f of n.fields ?? []) if (f.key && !['pk', 'fk'].includes(f.key)) errs.push(`${n.id}.${f.name}: key must be pk or fk`);
    }
    for (const r of rels) if (!r.label) errs.push(`relation ${r.from} -> ${r.to}: label is required (for example "1 : N")`);
    checkGrid(ents, rels, 'entity', errs);
  } else if (d.kind === 'flow') {
    const actors = d.actors ?? [], steps = d.steps ?? [], ids = new Set(actors.map((a) => a.id));
    if (!actors.length || actors.length > LIMIT.actors) errs.push(`actors must be 1 to ${LIMIT.actors}`);
    if (ids.size !== actors.length || actors.some((a) => !a.id)) errs.push('actor id missing or duplicate');
    for (const a of actors) if (!text(a.label)) errs.push(`actor ${a.id}: label is required`);
    if (!steps.length || steps.length > LIMIT.steps) errs.push(`steps must be 1 to ${LIMIT.steps}`);
    steps.forEach((s, i) => { if (!ids.has(s.from) || !ids.has(s.to)) errs.push(`step ${i + 1}: unknown actor`); if (!s.label) errs.push(`step ${i + 1}: label is required`); });
  }
  return errs;
}

// advisory lines: the diagram is valid but dense. The author runs the remove test (can a node be dropped or merged, can a link be implied by layout) before hand-off
export function warnings(html) {
  const m = html.match(JSON_BLOCK); let d;
  try { d = JSON.parse(m[2]); } catch { return []; }
  const soft = SOFT[d.kind]; if (!soft) return [];
  const items = (d.nodes ?? d.entities ?? []).length, links = (d.edges ?? d.relations ?? []).length, out = [];
  if (items > soft.items) out.push(`${items} ${d.kind === 'erd' ? 'entities' : 'nodes'} (soft limit ${soft.items}): split into an overview and a detail diagram unless this is the onboard overview`);
  if (links > soft.links) out.push(`${links} links (soft limit ${soft.links}): drop any link the layout already makes obvious`);
  return out;
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
