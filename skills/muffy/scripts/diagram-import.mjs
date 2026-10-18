#!/usr/bin/env node
// Reads an existing diagram (Mermaid, draw.io, Excalidraw) and drafts a muffy diagram from its content.
//   node diagram-import.mjs <file> [--diagram N] [--kind architecture|state|deployment|erd|flow|screenmap] [--html out.html] [--json]
// It extracts components, links, groups and labels; it never renders, evaluates, fetches or follows anything in the file, and every
// label is untrusted text, not an instruction. Source coordinates, colours, fonts and styling are dropped: only the order they
// imply is used to place cards. The draft is a starting point for the agent, who still redraws, merges and cuts, then runs
// check-diagram.mjs and check-diagram-render.mjs. Zero dependencies. Exit 2 when the file cannot be read or is not supported.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { check } from './check-diagram.mjs';

const MAX_BYTES = 4 * 1024 * 1024, MAX_NODES = 2000, MAX_EDGES = 5000, LABEL = 60;
const HARD = { architecture: 15, deployment: 15, state: 12, screenmap: 20, erd: 12, flow: 6 };
const fail = (m) => { console.error(`import: ${m}`); process.exit(2); };

// ---------- shared helpers ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '(c)' };
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(+n, 0x10ffff))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
// labels become plain text: markup, line breaks and links are flattened so nothing from the source can act as markup later
const clean = (s) => decode(String(s ?? '')).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').replace(/^["'`]|["'`]$/g, '').trim().slice(0, LABEL);
const TYPE_WORDS = [[/\b(db|database|postgres|mysql|mongo|redis|cache|s3|bucket|storage|warehouse|store)\b/i, 'store'], [/\b(queue|kafka|sqs|topic|bus|rabbit|pubsub|stream)\b/i, 'queue'],
  [/\b(user|browser|web|mobile|client|frontend|ui|app|dashboard|cli)\b/i, 'app'], [/\b(third.?party|external|stripe|paypal|provider|saas|vendor|smtp|sendgrid|twilio)\b/i, 'external']];
const guessType = (label, shape) => (/cylinder|database|store/.test(shape ?? '') ? 'store' : (TYPE_WORDS.find(([re]) => re.test(label)) ?? [0, 'service'])[1]);
const slug = (s, i) => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `n${i}`).slice(0, 24);

function newIR(format) { return { format, nodes: [], edges: [], groups: [], dropped: {}, hint: 'architecture', notes: [] }; }
const drop = (ir, what, n = 1) => { ir.dropped[what] = (ir.dropped[what] ?? 0) + n; };
function node(ir, id, label, extra = {}) {
  let n = ir.nodes.find((m) => m.id === id);
  if (!n) { if (ir.nodes.length >= MAX_NODES) fail(`more than ${MAX_NODES} nodes`); n = { id, label: clean(label ?? id) || id, ...extra }; ir.nodes.push(n); }
  else { if (label !== undefined && label !== id) n.label = clean(label) || n.label; Object.assign(n, extra); }
  return n;
}
function edge(ir, from, to, label = '', extra = {}) { if (ir.edges.length >= MAX_EDGES) fail(`more than ${MAX_EDGES} edges`); ir.edges.push({ from, to, label: clean(label), ...extra }); }

// ---------- Mermaid ----------
const OPEN = [['[[', ']]', 'subroutine'], ['[(', ')]', 'cylinder'], ['(((', ')))', 'double-circle'], ['((', '))', 'circle'], ['([', '])', 'stadium'], ['{{', '}}', 'hexagon'], ['[', ']', 'rect'], ['(', ')', 'round'], ['{', '}', 'diamond'], ['>', ']', 'flag']];
const ID_RE = /^[\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*/;

function mermaidBlocks(text, path) {
  if (!/\.(md|markdown)$/i.test(path)) return [text];
  const blocks = []; const re = /^(`{3,}|~{3,})\s*mermaid[^\n]*\n([\s\S]*?)\n\1[ \t]*$/gm; let m;
  while ((m = re.exec(text))) blocks.push(m[2]);
  return blocks;
}

function parseNodeRef(s, pos, ir, container) {
  const m = ID_RE.exec(s.slice(pos)); if (!m) return null;
  const id = m[0]; let p = pos + id.length, label, shape = 'rect';
  const rest = s.slice(p); const open = OPEN.find(([o]) => rest.startsWith(o));
  if (open) {
    const [o, c, sh] = open; let i = o.length, q = null;
    for (; i < rest.length; i++) { const ch = rest[i]; if (q) { if (ch === q) q = null; } else if (ch === '"') q = ch; else if (rest.startsWith(c, i)) break; }
    if (i >= rest.length) return null;
    label = rest.slice(o.length, i); shape = sh; p += i + c.length;
  }
  const cls = /^:::[\w-]+/.exec(s.slice(p)); if (cls) { p += cls[0].length; drop(ir, 'style classes'); }
  node(ir, id, label ?? undefined, { ...(open ? { shape } : {}), ...(container ? { group: container } : {}) });
  return { id, pos: p };
}

function mermaidFlow(lines, ir) {
  const stack = [], LINK = /^\s*(<?)(?:(-{2,}|={2,}|-\.+-?|\.{0,}-)(?:>|x|o)?)/;
  for (let raw of lines) {
    const line = raw.trim();
    if (/^(style|classDef|class|linkStyle|click|accTitle|accDescr|direction)\b/.test(line)) { drop(ir, /^click/.test(line) ? 'click targets' : 'styling lines'); continue; }
    const sg = /^subgraph\s+(.+)$/.exec(line);
    if (sg) { const m = /^([\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*)\s*(?:\[(.*)\])?$/.exec(sg[1].trim()); const id = m ? m[1] : slug(sg[1], ir.groups.length); ir.groups.push({ id, label: clean(m?.[2] ?? sg[1]) || id, parent: stack[stack.length - 1] }); stack.push(id); continue; }
    if (line === 'end') { stack.pop(); continue; }
    let s = line.replace(/\s*;\s*$/, '')
      .replace(/--\s+([^->|][^>]*?)\s+(-->|---)/g, '$2|$1|').replace(/==\s+([^=>|][^>]*?)\s+(==>|===)/g, '$2|$1|').replace(/-\.\s+([^.>|][^>]*?)\s+(\.->|\.-)/g, '$2|$1|');
    let pos = 0; let prev = null;
    const group = stack[stack.length - 1];
    for (let guard = 0; guard < 200 && pos < s.length; guard++) {
      const heads = [];
      for (;;) {
        while (s[pos] === ' ') pos++;
        const r = parseNodeRef(s, pos, ir, group); if (!r) return void drop(ir, 'unparsed lines');
        heads.push(r.id); pos = r.pos; while (s[pos] === ' ') pos++;
        if (s[pos] === '&') { pos++; continue; } break;
      }
      if (prev) for (const a of prev.ids) for (const b of heads) edge(ir, a, b, prev.label, prev.dir ? { dir: 'both' } : {});
      while (s[pos] === ' ') pos++;
      if (pos >= s.length) break;
      const lm = LINK.exec(s.slice(pos)); if (!lm) { drop(ir, 'unparsed lines'); break; }
      pos += lm[0].length; let label = '';
      if (s[pos] === '|') { const e = s.indexOf('|', pos + 1); if (e < 0) break; label = s.slice(pos + 1, e); pos = e + 1; }
      prev = { ids: heads, label, dir: lm[1] === '<' };
    }
  }
  ir.hint = 'architecture';
}

function mermaidState(lines, ir) {
  let start = false, end = false; const depth = [];
  const ref = (t, asSource) => (t === '[*]' ? (asSource ? (start = true, '__start') : (end = true, '__end')) : t);
  for (const raw of lines) {
    const line = raw.trim(); if (!line) continue;
    if (/^(note|classDef|class|style|click|hide|scale|direction)\b/i.test(line)) { drop(ir, 'notes and styling'); continue; }
    if (/^\}$/.test(line)) { depth.pop(); continue; }
    const comp = /^state\s+(?:"([^"]*)"\s+as\s+)?([\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*)\s*\{$/.exec(line); if (comp) { depth.push(comp[2]); node(ir, comp[2], comp[1] ?? comp[2]); drop(ir, 'composite state nesting'); continue; }
    const decl = /^state\s+"([^"]*)"\s+as\s+([\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*)$/.exec(line); if (decl) { node(ir, decl[2], decl[1]); continue; }
    if (/^state\s+\S+\s+<<(fork|join|choice)>>/.test(line)) { const id = line.split(/\s+/)[1]; node(ir, id, id); continue; }
    const t = /^(\[\*\]|[\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*)\s*-->\s*(\[\*\]|[\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*)\s*(?::\s*(.*))?$/.exec(line);
    if (t) { const a = ref(t[1], true), b = ref(t[2], false); node(ir, a); node(ir, b); edge(ir, a, b, t[3] ?? ''); continue; }
    const d = /^([\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*)\s*:\s*(.*)$/.exec(line); if (d) { node(ir, d[1]); drop(ir, 'state descriptions'); continue; }
    drop(ir, 'unparsed lines');
  }
  if (start) node(ir, '__start', 'Start', { type: 'initial' });
  if (end) node(ir, '__end', 'End', { type: 'final' });
  ir.hint = 'state';
}

const CARD = { '||': '1', '|o': '0..1', 'o|': '0..1', '}o': '0..N', 'o{': '0..N', '}|': '1..N', '|{': '1..N' };
function mermaidEr(lines, ir) {
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim(); if (!line) continue;
    if (cur) { if (line === '}') { cur = null; continue; } const f = /^(\S+)\s+(\S+)(?:\s+(.*))?$/.exec(line); if (f) { const keys = (f[3] ?? '').toUpperCase(); (cur.fields ??= []).push({ name: clean(f[2]), type: clean(f[1]), ...(/\bPK\b/.test(keys) ? { key: 'pk' } : /\bFK\b/.test(keys) ? { key: 'fk' } : {}) }); } continue; }
    const ob = /^("[^"]+"|[^\s{]+)\s*(?:\[[^\]]*\])?\s*\{$/.exec(line); if (ob) { cur = node(ir, clean(ob[1]) || ob[1], undefined, { fields: [] }); continue; }
    const r = /^("[^"]+"|\S+)\s+(\S\S)(--|\.\.)(\S\S)\s+("[^"]+"|\S+)\s*(?::\s*(.*))?$/.exec(line);
    if (r) { const a = clean(r[1]), b = clean(r[5]); node(ir, a); node(ir, b); edge(ir, a, b, `${CARD[r[2]] ?? '?'} : ${CARD[[...r[4]].reverse().join('')] ?? CARD[r[4]] ?? '?'}`); continue; }
    if (/^[\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*$/.test(line)) { node(ir, line); continue; }
    drop(ir, 'unparsed lines');
  }
  ir.hint = 'erd';
}

function mermaidSequence(lines, ir) {
  for (const raw of lines) {
    const line = raw.trim(); if (!line) continue;
    const p = /^(?:participant|actor)\s+(?:"([^"]*)"|(\S+))(?:\s+as\s+(.*))?$/.exec(line); if (p) { const id = p[2] ?? slug(p[1], ir.nodes.length); node(ir, id, p[3] ?? p[1] ?? id); continue; }
    const m = /^([\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*)\s*(--?>>?|--?[x)]|<<--?>>)\s*[+-]?([\w\u0080-\uffff.]+(?:-[\w\u0080-\uffff.]+)*)\s*:\s*(.*)$/.exec(line);
    if (m) { node(ir, m[1]); node(ir, m[3]); edge(ir, m[1], m[3], m[4], /^--/.test(m[2]) ? { dashed: true } : {}); continue; }
    if (/^(loop|alt|else|opt|par|and|critical|break|rect|end)\b/.test(line)) { drop(ir, 'fragments (loop/alt/opt/par)'); continue; }
    if (/^(note|activate|deactivate|autonumber|title|box)\b/i.test(line)) { drop(ir, 'notes and activations'); continue; }
    drop(ir, 'unparsed lines');
  }
  ir.hint = 'flow';
}

function fromMermaid(text, path, which) {
  const blocks = mermaidBlocks(text, path); if (!blocks.length) fail('no mermaid block found');
  const src = blocks[which] ?? fail(`diagram ${which} not found (${blocks.length} mermaid block(s))`);
  const ir = newIR('mermaid');
  const lines = src.replace(/^\uFEFF/, '').replace(/^---[\s\S]*?\n---\n/, '').split(/\r?\n/).map((l) => l.replace(/%%.*$/, '')).filter((l) => l.trim());
  const head = (lines.shift() ?? '').trim();
  if (/^(flowchart|graph)\b/.test(head)) mermaidFlow(lines, ir);
  else if (/^stateDiagram(-v2)?\b/.test(head)) mermaidState(lines, ir);
  else if (/^erDiagram\b/.test(head)) mermaidEr(lines, ir);
  else if (/^sequenceDiagram\b/.test(head)) mermaidSequence(lines, ir);
  else fail(`unsupported mermaid diagram "${head.split(/\s+/)[0]}"; supported: flowchart, graph, stateDiagram-v2, erDiagram, sequenceDiagram`);
  if (blocks.length > 1) ir.notes.push(`file has ${blocks.length} mermaid blocks; imported block ${which}`);
  return ir;
}

// ---------- draw.io ----------
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
function drawioModels(text) {
  const pages = [...text.matchAll(/<diagram\b([^>]*)>([\s\S]*?)<\/diagram>/g)];
  if (!pages.length) return /<mxGraphModel/.test(text) ? [text] : [];
  return pages.map((p) => {
    const body = p[2].trim();
    if (body.includes('<mxGraphModel')) return body;
    try { return decodeURIComponent(inflateRawSync(Buffer.from(body, 'base64')).toString('utf8')); } catch { return fail('cannot decompress a draw.io page; in draw.io use File > Properties > uncheck Compressed, then save again'); }
  });
}
function fromDrawio(text, which) {
  const models = drawioModels(text); if (!models.length) fail('no draw.io diagram found');
  const xml = models[which] ?? fail(`diagram ${which} not found (${models.length} page(s))`);
  const ir = newIR('drawio'); const cells = []; let pendingObj = null;
  for (const m of xml.matchAll(/<(mxCell|object|UserObject)\b([^>]*?)(\/?)>/g)) {
    const a = attrs(m[2]);
    if (m[1] !== 'mxCell') { pendingObj = a; if (m[3]) { pendingObj = null; } continue; }
    if (pendingObj) { a.id = pendingObj.id ?? a.id; a.value = pendingObj.label ?? pendingObj.value ?? a.value; pendingObj = null; }
    cells.push(a);
  }
  const byId = Object.fromEntries(cells.map((c) => [c.id, c])); const geo = {};
  for (const m of xml.matchAll(/<mxCell\b[^>]*\bid="([^"]*)"[^>]*>\s*<mxGeometry\b([^>]*)>/g)) geo[decode(m[1])] = attrs(m[2]);
  const isGroup = (c) => /swimlane|group|container=1|shape=umlFrame/.test(c.style ?? '');
  const verts = cells.filter((c) => c.vertex === '1' && !/text;|edgeLabel/.test(c.style ?? '') || (c.vertex === '1' && c.value));
  for (const c of cells.filter((c) => c.vertex === '1')) {
    const label = clean(c.value);
    if (isGroup(c)) { ir.groups.push({ id: c.id, label: label || c.id, parent: byId[c.parent]?.vertex === '1' ? c.parent : undefined }); continue; }
    if (/edgeLabel/.test(c.style ?? '') || (!label && !/shape=|ellipse|rhombus|rounded|cylinder/.test(c.style ?? ''))) { drop(ir, 'shapes without a label (decoration)'); continue; }
    const st = c.style ?? ''; const shape = /cylinder|shape=mxgraph\.(aws|azure|gcp).*(database|storage)/i.test(st) ? 'cylinder' : /rhombus/.test(st) ? 'diamond' : /ellipse/.test(st) ? 'circle' : 'rect';
    const g = geo[c.id] ?? {};
    node(ir, c.id, label || c.id, { shape, x: +g.x || 0, y: +g.y || 0, ...(byId[c.parent]?.vertex === '1' && isGroup(byId[c.parent]) ? { group: c.parent } : {}) });
  }
  void verts;
  const edgeLabels = {}; for (const c of cells) if (c.vertex === '1' && byId[c.parent]?.edge === '1' && clean(c.value)) edgeLabels[c.parent] = clean(c.value);
  for (const c of cells.filter((c) => c.edge === '1')) {
    if (!c.source || !c.target || !ir.nodes.some((n) => n.id === c.source) || !ir.nodes.some((n) => n.id === c.target)) { drop(ir, 'edges not attached to two shapes'); continue; }
    edge(ir, c.source, c.target, clean(c.value) || edgeLabels[c.id] || '', /startArrow=(?!none)/.test(c.style ?? '') && /endArrow=(?!none)/.test(c.style ?? '') ? { dir: 'both' } : {});
  }
  if (models.length > 1) ir.notes.push(`file has ${models.length} pages; imported page ${which}`);
  return ir;
}

// ---------- Excalidraw ----------
function fromExcalidraw(text) {
  let doc; try { doc = JSON.parse(text); } catch { fail('not valid JSON'); }
  const els = (doc.elements ?? []).filter((e) => !e.isDeleted); if (!Array.isArray(doc.elements)) fail('no elements array: not an excalidraw file');
  const ir = newIR('excalidraw'); const textOf = {};
  for (const e of els) if (e.type === 'text' && e.containerId) textOf[e.containerId] = clean(e.text ?? e.originalText);
  for (const e of els) {
    if (e.type === 'frame') { ir.groups.push({ id: e.id, label: clean(e.name) || e.id }); continue; }
    if (!['rectangle', 'ellipse', 'diamond'].includes(e.type)) continue;
    const label = textOf[e.id]; if (!label) { drop(ir, 'shapes without a label (decoration)'); continue; }
    node(ir, e.id, label, { shape: e.type === 'ellipse' ? 'circle' : e.type === 'diamond' ? 'diamond' : 'rect', x: Math.round(e.x), y: Math.round(e.y), ...(e.frameId ? { group: e.frameId } : {}) });
  }
  for (const e of els) {
    if (e.type !== 'arrow' && e.type !== 'line') continue;
    const a = e.startBinding?.elementId, b = e.endBinding?.elementId;
    if (!a || !b || !ir.nodes.some((n) => n.id === a) || !ir.nodes.some((n) => n.id === b)) { drop(ir, 'arrows not attached to two shapes'); continue; }
    edge(ir, a, b, textOf[e.id] ?? '', e.startArrowhead && e.endArrowhead ? { dir: 'both' } : {});
  }
  const stray = els.filter((e) => e.type === 'text' && !e.containerId).length; if (stray) drop(ir, 'free-floating text', stray);
  return ir;
}

// ---------- draft ----------
function layers(ir) {
  const ids = ir.nodes.map((n) => n.id), out = Object.fromEntries(ids.map((i) => [i, []])), back = new Set(), state = {};
  for (const e of ir.edges) if (out[e.from] && out[e.to]) out[e.from].push(e.to);
  const order = [...ir.nodes].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0)).map((n) => n.id);
  const visit = (u) => { state[u] = 1; for (const v of out[u]) { if (state[v] === 1) back.add(`${u}>${v}`); else if (!state[v]) visit(v); } state[u] = 2; };
  const indeg = Object.fromEntries(ids.map((i) => [i, 0])); for (const e of ir.edges) if (e.from !== e.to && indeg[e.to] !== undefined) indeg[e.to]++;
  [...order.filter((i) => !indeg[i]), ...order].forEach((i) => { if (!state[i]) visit(i); });
  const layer = Object.fromEntries(ids.map((i) => [i, 0]));
  for (let pass = 0; pass < ids.length; pass++) { let moved = false; for (const e of ir.edges) if (layer[e.from] !== undefined && layer[e.to] !== undefined && !back.has(`${e.from}>${e.to}`) && e.from !== e.to && layer[e.to] < layer[e.from] + 1) { layer[e.to] = layer[e.from] + 1; moved = true; } if (!moved) break; }
  return layer;
}

function draft(ir, kind, title) {
  const ids = new Map(); ir.nodes.forEach((n, i) => { let s = slug(n.id, i), k = 2; while ([...ids.values()].includes(s)) s = `${slug(n.id, i)}_${k++}`; ids.set(n.id, s); });
  const base = { kind, title: title || 'Imported diagram', subtitle: `Imported from a ${ir.format} file.`, caption: 'Draft import: review every label and link before relying on it.' };
  if (kind === 'flow') {
    const actors = ir.nodes.map((n) => ({ id: ids.get(n.id), label: n.label, type: guessType(n.label, n.shape) }));
    return { ...base, actors, steps: ir.edges.map((e) => ({ from: ids.get(e.from), to: ids.get(e.to), label: e.label || '(unlabelled)' })) };
  }
  const layer = layers(ir), cols = {};
  const sorted = [...ir.nodes].sort((a, b) => layer[a.id] - layer[b.id] || (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
  const cell = {}; for (const n of sorted) { const c = layer[n.id] + 1; cols[c] = (cols[c] ?? 0) + 1; cell[n.id] = { col: c, row: cols[c] }; }
  // a straight link (same row or column) must not run over a card between its ends: move the target to a free cell
  const taken = (c, r) => Object.values(cell).some((p) => p.col === c && p.row === r);
  for (let pass = 0; pass < 30; pass++) {
    const bad = ir.edges.find((e) => {
      const a = cell[e.from], b = cell[e.to]; if (!a || !b || e.from === e.to) return false;
      return Object.entries(cell).some(([id, m]) => id !== e.from && id !== e.to && ((a.row === b.row && m.row === a.row && m.col > Math.min(a.col, b.col) && m.col < Math.max(a.col, b.col)) || (a.col === b.col && m.col === a.col && m.row > Math.min(a.row, b.row) && m.row < Math.max(a.row, b.row))));
    });
    if (!bad) break;
    const t = cell[bad.to]; let r = 1; while (taken(t.col, r)) r++; t.row = r;
  }
  const links = ir.edges.map((e) => ({ from: ids.get(e.from), to: ids.get(e.to), label: e.label || (kind === 'erd' ? '?' : '(unlabelled)'), ...(e.dir ? { dir: e.dir } : {}) })).filter((e) => e.from && e.to);
  if (kind === 'erd') return { ...base, entities: sorted.map((n) => ({ id: ids.get(n.id), name: n.label, ...cell[n.id], fields: (n.fields ?? []).sort((a, b) => !!b.key - !!a.key).slice(0, 12) })), relations: links.map(({ dir, ...r }) => r) };
  const typeOf = (n) => {
    if (kind === 'state') return n.type ?? 'state';
    if (kind === 'screenmap') return 'screen';
    const t = n.type ?? guessType(n.label, n.shape); return kind === 'deployment' ? (t === 'app' || t === 'service' ? 'container' : t) : t;
  };
  return { ...base, nodes: sorted.map((n) => ({ id: ids.get(n.id), label: n.label, type: typeOf(n), ...cell[n.id] })), edges: links };
}

// ---------- main ----------
function digest(ir, kind, d, errs) {
  const deg = {}; for (const e of ir.edges) { deg[e.from] = (deg[e.from] ?? 0) + 1; deg[e.to] = (deg[e.to] ?? 0) + 1; }
  const label = (id) => ir.nodes.find((n) => n.id === id)?.label ?? id, linked = new Set(ir.edges.flatMap((e) => [e.from, e.to]));
  const hubs = Object.entries(deg).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, n]) => n >= 3).map(([id, n]) => `${label(id)} (${n})`);
  const lone = ir.nodes.filter((n) => !linked.has(n.id)).map((n) => n.label);
  const L = [`source: ${ir.format} · ${ir.nodes.length} nodes · ${ir.edges.length} links · ${ir.groups.length} groups`, `suggested kind: ${kind}`];
  if (hubs.length) L.push(`hubs (likely focal): ${hubs.join(', ')}`);
  if (lone.length) L.push(`unconnected (cut or merge first): ${lone.slice(0, 8).join(', ')}${lone.length > 8 ? ', ...' : ''}`);
  if (ir.groups.length) L.push(`groups (collapse candidates): ${ir.groups.slice(0, 6).map((g) => g.label).join(', ')}`);
  if (!d) L.push(`NO DRAFT: ${ir.nodes.length} nodes is over the ${HARD[kind]} limit for ${kind}. Cut to the components the reader needs (start with the unconnected and the groups), then pass a smaller source or draw the JSON by hand`);
  else if (errs.length) { L.push('draft does not pass check-diagram.mjs yet:'); errs.forEach((e) => L.push(`  - ${e}`)); }
  else L.push('draft passes check-diagram.mjs (layout is a first guess: run check-diagram-render.mjs too)');
  const dr = Object.entries(ir.dropped); if (dr.length) L.push(`dropped: ${dr.map(([k, v]) => `${v} ${k}`).join(', ')}`);
  ir.notes.forEach((n) => L.push(`note: ${n}`));
  L.push('fidelity ledger to report: source count, drawn count, every merge / cut / guessed type (types and unlabelled links are guesses)');
  return L.join('\n');
}

const argv = process.argv.slice(2), flag = (n) => { const i = argv.indexOf(n); return i < 0 ? undefined : argv.splice(i, 2)[1]; };
if (basename(process.argv[1] ?? '') === 'diagram-import.mjs') {
  const which = +(flag('--diagram') ?? 0), kindFlag = flag('--kind'), html = flag('--html'), json = argv.includes('--json'); if (json) argv.splice(argv.indexOf('--json'), 1);
  const file = argv[0]; if (!file) fail('usage: diagram-import.mjs <file> [--diagram N] [--kind K] [--html out.html] [--json]');
  let text; try { if (statSync(file).size > MAX_BYTES) fail('file is over 4 MB'); text = readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); } catch (e) { fail(`cannot read ${file}: ${e.message}`); }
  const ext = extname(file).toLowerCase();
  const ir = /\.(mmd|mermaid|md|markdown)$/.test(ext) ? fromMermaid(text, file, which) : /\.excalidraw$/.test(ext) || (ext === '.json' && /"elements"/.test(text.slice(0, 4000))) ? fromExcalidraw(text) : /\.(drawio|xml)$/.test(ext) ? fromDrawio(text, which) : fail(`unsupported file type "${ext}" (.mmd .mermaid .md .drawio .excalidraw)`);
  if (!ir.nodes.length) fail('no nodes found in the source');
  const kind = kindFlag ?? ir.hint; if (!(kind in HARD)) fail(`--kind must be one of ${Object.keys(HARD).join(', ')}`);
  const tooBig = (kind === 'flow' ? ir.nodes.length > HARD.flow || ir.edges.length > 12 : ir.nodes.length > HARD[kind]);
  const d = tooBig ? null : draft(ir, kind, clean(basename(file, ext)).replace(/[-_]+/g, ' '));
  let errs = [], page = null;
  if (d) {
    const tpl = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../templates/diagram.html'), 'utf8');
    page = tpl.replace(/(<script type="application\/json" id="diagram">)[\s\S]*?(<\/script>)/, (_, a, b) => `${a}\n${JSON.stringify(d, null, 2).replace(/</g, '\\u003c')}\n${b}`);
    errs = check(page, html ?? '');
    if (html) { writeFileSync(html, page); }
  }
  console.log(digest(ir, kind, d, errs));
  if (html && d) console.log(`wrote ${html}`);
  if (json && d) console.log(JSON.stringify(d, null, 2));
}
