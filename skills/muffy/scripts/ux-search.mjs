#!/usr/bin/env node
// Read-only BM25 search over the UX/UI rule tables in skills/muffy/data/ux/ (the designer agent's lookup).
// Ported from the ui-ux-pro-max skill's search.py (MIT, notice in THIRD_PARTY_NOTICES.md at the skill root). It reads CSV and prints; it writes nothing.
//   node .claude/skills/muffy/scripts/ux-search.mjs "<query>" [--domain <domain> | --stack <stack>] [-n 3] [--json] [--full]
//   node .claude/skills/muffy/scripts/ux-search.mjs --info [--json]     (data counts, snapshot hash check, stale records)
//   domains: ux web chart typography reasoning style color landing product icons gsap react google-fonts phosphor; stacks: see STACKS below
//   results also carry facts from the JSON snapshots: font licence, Phosphor upstream check, provenance record
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'ux');
const TRUNCATE_AT = 300;
const UNTRUNCATED = new Set(['Code Example Good', 'Code Example Bad', 'CSS Import', 'Tailwind Config']);

const DOMAINS = {
  ux: {
    file: 'ux-guidelines.csv',
    search: ['Category', 'Issue', 'Description', 'Platform'],
    out: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
  web: {
    file: 'app-interface.csv',
    search: ['Category', 'Issue', 'Keywords', 'Description'],
    out: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
  chart: {
    file: 'charts.csv',
    search: ['Data Type', 'Keywords', 'Best Chart Type', 'When to Use', 'When NOT to Use', 'Accessibility Notes'],
    out: ['Data Type', 'Keywords', 'Best Chart Type', 'Secondary Options', 'When to Use', 'When NOT to Use', 'Data Volume Threshold', 'Color Guidance', 'Accessibility Grade', 'Accessibility Risk', 'Accessibility Notes', 'A11y Fallback', 'Interactive Level'],
  },
  typography: {
    file: 'typography.csv',
    search: ['Font Pairing Name', 'Category', 'Mood/Style Keywords', 'Best For', 'Heading Font', 'Body Font'],
    out: ['Font Pairing Name', 'Category', 'Heading Font', 'Body Font', 'Mood/Style Keywords', 'Best For', 'Google Fonts URL', 'CSS Import', 'Tailwind Config', 'Notes'],
  },
  reasoning: {
    file: 'ui-reasoning.csv',
    search: ['UI_Category', 'Recommended_Pattern', 'Style_Priority', 'Color_Mood', 'Typography_Mood', 'Key_Effects', 'Decision_Rules', 'Anti_Patterns'],
    out: ['UI_Category', 'Recommended_Pattern', 'Style_Priority', 'Color_Mood', 'Typography_Mood', 'Key_Effects', 'Decision_Rules', 'Anti_Patterns', 'Severity', 'Reasoning'],
  },
  style: {
    file: 'styles.csv',
    search: ['Style ID', 'Style Category', 'Aliases', 'Keywords', 'Best For', 'Type', 'AI Prompt Keywords'],
    out: ['Style ID', 'Style Category', 'Aliases', 'Status', 'Parent Style ID', 'Preferred Mode', 'Type', 'Keywords', 'Primary Colors', 'Effects & Animation', 'Best For', 'Light Mode ✓', 'Dark Mode ✓', 'Performance', 'Accessibility', 'Framework Compatibility', 'Complexity', 'AI Prompt Keywords', 'CSS/Technical Keywords', 'Implementation Checklist', 'Design System Variables'],
  },
  color: {
    file: 'colors.csv',
    search: ['Product Type', 'Notes'],
    out: ['Product Type', 'Primary', 'On Primary', 'Secondary', 'On Secondary', 'Accent', 'On Accent', 'Background', 'Foreground', 'Card', 'Card Foreground', 'Muted', 'Muted Foreground', 'Border', 'Destructive', 'On Destructive', 'Ring', 'Notes'],
  },
  landing: {
    file: 'landing.csv',
    search: ['Pattern ID', 'Pattern Name', 'Aliases', 'Keywords', 'Conversion Optimization', 'Section Order'],
    out: ['Pattern ID', 'Pattern Name', 'Aliases', 'Keywords', 'Section Order', 'Primary CTA Placement', 'Color Strategy', 'Conversion Optimization'],
  },
  product: {
    file: 'products.csv',
    search: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Key Considerations'],
    out: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Secondary Styles', 'Landing Page Pattern', 'Dashboard Style (if applicable)', 'Color Palette Focus'],
  },
  icons: {
    file: 'icons.csv',
    search: ['Category', 'Icon Name', 'Keywords', 'Best For', 'Library'],
    out: ['Category', 'Icon Name', 'Keywords', 'Library', 'Import Code', 'Usage', 'Best For', 'Style', 'Semantic Role', 'Allowed Contexts'],
  },
  gsap: {
    file: 'motion.csv',
    search: ['Category', 'Intensity Tier', 'Keywords', 'Trigger'],
    out: ['Category', 'Intensity Tier', 'Trigger', 'Duration', 'Easing', 'GSAP Snippet', 'Framework Notes', 'Do', "Don't", 'Performance Notes'],
  },
  react: {
    file: 'react-performance.csv',
    search: ['Category', 'Issue', 'Keywords', 'Description'],
    out: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
  phosphor: {
    file: 'phosphor-icons-upstream.json', // the full upstream Phosphor catalog (1,500+ icons), not the 100 curated rows in icons.csv
    rows: (j) => j.icons.map((i) => ({ 'Icon Name': i.name, Component: i.component, Categories: i.categories.join(', '), Tags: i.tags.join(', '), 'Client Import': i.clientImport, 'SSR Import': i.ssrImport, Since: String(i.publishedIn) })),
    search: ['Icon Name', 'Component', 'Categories', 'Tags'],
    out: ['Icon Name', 'Component', 'Categories', 'Tags', 'Client Import', 'SSR Import', 'Since'],
  },
  'google-fonts': {
    file: 'google-fonts.csv',
    search: ['Family', 'Category', 'Stroke', 'Classifications', 'Keywords', 'Subsets', 'Designers'],
    out: ['Family', 'Category', 'Stroke', 'Classifications', 'Styles', 'Variable Axes', 'Subsets', 'Designers', 'Popularity Rank', 'Google Fonts URL'],
  },
};
const NO_AUTO = new Set(['google-fonts', 'phosphor']); // 730 KB and 840 KB: only searched when asked for by name

const STACKS = ['react', 'nextjs', 'vue', 'svelte', 'astro', 'swiftui', 'react-native', 'flutter', 'nuxtjs', 'nuxt-ui', 'html-tailwind', 'shadcn', 'jetpack-compose', 'threejs', 'angular', 'laravel', 'javafx', 'wpf', 'winui', 'avalonia', 'uno', 'uwp'];
const STACK_CFG = {
  search: ['Category', 'Guideline', 'Description', 'Do', "Don't", 'Code Good', 'Code Bad'],
  out: ['Category', 'Guideline', 'Description', 'Do', "Don't", 'Code Good', 'Code Bad', 'Severity', 'Docs URL', 'Applies To', 'Status', 'Verified At'],
};
UNTRUNCATED.add('Code Good').add('Code Bad').add('Implementation Checklist').add('Design System Variables').add('GSAP Snippet');

const STOPWORDS = new Set(['to', 'in', 'on', 'at', 'is', 'of', 'by', 'or', 'an', 'if', 'no', 'so', 'do', 'be', 'we', 'it', 'as', 'the', 'and', 'for', 'are', 'was']);
const SYNONYMS = [['q&a', 'question answer'], ['e-commerce', 'ecommerce'], ['dark-mode', 'dark'], ['darkmode', 'dark'], ['light-mode', 'light'], ['lightmode', 'light'], ['a11y', 'accessibility'], ['nav', 'navigation'], ['sign-up', 'signup'], ['log-in', 'login'], ['colour', 'color'], ['colours', 'colors'], ['behaviour', 'behavior'], ['ux/ui', 'ux ui']]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([v, c]) => [new RegExp(`(?<![\\w])${v.replace(/[.*+?^${}()|[\]\\/&]/g, '\\$&')}(?![\\w])`, 'gi'), c]);

const tokenize = (text) => {
  let t = String(text).toLowerCase();
  for (const [re, c] of SYNONYMS) t = t.replace(re, c);
  return t.replace(/[^\p{L}\p{N}_\s]/gu, ' ').split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
};

// RFC 4180 reader: quoted fields may hold commas, doubled quotes and newlines.
const parseCsv = (text) => {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((v) => v !== '')) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ''), r[i] ?? ''])));
};

class BM25 {
  constructor(docs, k1 = 1.5, b = 0.75) {
    this.k1 = k1; this.b = b;
    this.docs = docs.map(tokenize);
    this.N = this.docs.length;
    this.len = this.docs.map((d) => d.length);
    this.avg = this.len.reduce((a, n) => a + n, 0) / (this.N || 1) || 1;
    this.tf = this.docs.map((d) => { const m = new Map(); for (const w of d) m.set(w, (m.get(w) ?? 0) + 1); return m; });
    const df = new Map();
    for (const m of this.tf) for (const w of m.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    this.idf = new Map([...df].map(([w, n]) => [w, Math.log((this.N - n + 0.5) / (n + 0.5) + 1)]));
  }
  score(query) {
    const q = tokenize(query);
    return this.tf.map((m, i) => {
      let s = 0;
      for (const w of q) {
        const idf = this.idf.get(w);
        if (idf === undefined) continue;
        const f = m.get(w) ?? 0;
        s += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * this.len[i]) / this.avg));
      }
      return [i, s];
    }).sort((a, b) => b[1] - a[1]);
  }
  coverage(query) {
    const q = new Set(tokenize(query));
    return q.size ? [...q].filter((w) => this.idf.has(w)).length / q.size : 0;
  }
}

const cfgFor = (domain) => (STACKS.includes(domain) ? { file: `stacks/${domain}.csv`, ...STACK_CFG } : DOMAINS[domain]);

const jsonCache = new Map();
const readJson = (name) => {
  if (!jsonCache.has(name)) {
    const file = join(DATA, name);
    if (!existsSync(file)) throw new Error(`missing data file ${name}`);
    jsonCache.set(name, JSON.parse(readFileSync(file, 'utf8')));
  }
  return jsonCache.get(name);
};

const load = (domain) => {
  const cfg = cfgFor(domain);
  const file = join(DATA, cfg.file);
  if (!existsSync(file)) throw new Error(`missing data file ${cfg.file}`);
  const rows = cfg.rows ? cfg.rows(readJson(cfg.file)) : parseCsv(readFileSync(file, 'utf8'));
  return { rows, index: new BM25(rows.map((r) => cfg.search.map((c) => r[c] ?? '').join(' '))) };
};

// Extra facts from the JSON snapshots, added to a result row: font licence, Phosphor upstream check, provenance record.
const DAY = 86400000;
const enrich = (domain, cfg, row) => {
  const extra = {};
  if (domain === 'google-fonts') {
    const lic = readJson('google-font-licenses.json');
    const hit = lic.families.find((f) => f.name === row.Family);
    const out = lic.excludedFamilies.find((f) => f.name === row.Family);
    extra.License = hit ? `${hit.license} (verified ${hit.verifiedAt})` : out ? `not verified: ${out.reason}` : 'no licence record; do not ship until checked';
  }
  if (domain === 'icons' && /^Phosphor/.test(row.Library ?? '')) {
    const up = readJson('phosphor-icons-upstream.json').icons.find((i) => i.name === String(row['Icon Name']).toLowerCase());
    extra['Phosphor upstream'] = up ? `found (${up.component}, since ${up.publishedIn})` : 'not found in the upstream catalog; check the name';
  }
  const prov = readJson('data-provenance.json');
  const rec = prov.records.find((r) => r.sourceFile === cfg.file && r.sourceKey && Object.entries(r.sourceKey).every(([k, v]) => row[k] === v));
  if (rec) {
    const limit = prov.freshnessPolicy[`${rec.sla}Days`];
    const age = Math.floor((Date.now() - Date.parse(rec.verifiedAt)) / DAY);
    extra.Provenance = `${rec.status}, ${rec.sla}, verified ${rec.verifiedAt}${limit && age > limit ? ` (stale: ${age} days, limit ${limit})` : ''}`;
  }
  return extra;
};

const search = (query, domain, max, stack) => {
  const key = stack ?? domain;
  const { rows, index } = load(key);
  const cfg = cfgFor(key);
  const results = index.score(query).filter(([, s]) => s > 0).slice(0, max)
    .map(([i]) => ({ ...Object.fromEntries(cfg.out.filter((c) => c in rows[i]).map((c) => [c, rows[i][c]])), ...enrich(key, cfg, rows[i]) }));
  return { domain: stack ? `stack:${stack}` : domain, query, file: cfgFor(key).file, count: results.length, coverage: index.coverage(query), results };
};

const detect = (query) => {
  const scored = Object.keys(DOMAINS).filter((d) => !NO_AUTO.has(d)).map((d) => { const { index } = load(d); const top = index.score(query)[0]?.[1] ?? 0; return [d, top * (0.5 + index.coverage(query))]; });
  scored.sort((a, b) => b[1] - a[1]);
  return { domain: scored[0][1] > 0 ? scored[0][0] : 'ux', runnerUp: scored[1][1] > 0 ? scored[1][0] : null };
};

const format = (r, full) => {
  const out = ['## UX rule search', `Domain: ${r.domain}${r.autoDetected ? ` (auto-detected${r.runnerUp ? `, runner-up: ${r.runnerUp}` : ''})` : ''} | Query: ${r.query}`, `Source: ${r.file} | Found: ${r.count}\n`];
  if (!r.count) {
    out.push('No matches. Retry once with different keywords or an explicit --domain; if it still fails, say no database match was found and label any general guidance as a fallback.');
    return out.join('\n');
  }
  r.results.forEach((row, i) => {
    out.push(`### Result ${i + 1}`);
    for (const [k, v] of Object.entries(row)) out.push(`- ${k}: ${!full && !UNTRUNCATED.has(k) && v.length > TRUNCATE_AT ? `${v.slice(0, TRUNCATE_AT)}...` : v}`);
    out.push('');
  });
  return out.join('\n');
};

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n, short) => { const i = args.findIndex((a) => a === n || a === short); return i >= 0 ? args[i + 1] : undefined; };
const valueFlags = new Set(['--domain', '-d', '--stack', '-s', '--max-results', '-n']);
const query = args.filter((a, i) => !a.startsWith('-') && !valueFlags.has(args[i - 1])).join(' ').trim();
const domainArg = value('--domain', '-d');
const stackArg = value('--stack', '-s');
const max = Number(value('--max-results', '-n') ?? 3);

// --info: what the data holds, whether the pinned snapshots still match their recorded sha256, and how many records are stale.
if (flag('--info')) {
  try {
    const sum = readJson('catalog-summary.json');
    const prov = readJson('data-provenance.json');
    const snaps = Object.entries(sum.snapshots).map(([f, { sha256 }]) => {
      // recorded on LF content; a Windows checkout with autocrlf holds CRLF, so hash the LF form
      const got = createHash('sha256').update(readFileSync(join(DATA, f), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
      return { file: f, ok: got === sha256 };
    });
    const stale = prov.records.filter((r) => { const lim = prov.freshnessPolicy[`${r.sla}Days`]; return lim && (Date.now() - Date.parse(r.verifiedAt)) / DAY > lim; }).length;
    const info = { verifiedAt: sum.verifiedAt, counts: sum.counts, snapshots: snaps, provenanceRecords: prov.records.length, staleRecords: stale, pendingCandidates: sum.pendingCandidates.length };
    console.log(flag('--json') ? JSON.stringify(info, null, 2) : [
      `## UX data info (catalog verified ${info.verifiedAt})`,
      `Counts: ${Object.entries(info.counts).map(([k, v]) => `${k} ${typeof v === 'object' ? v.total : v}`).join(', ')}`,
      `Snapshots: ${snaps.map((s) => `${s.file} ${s.ok ? 'matches' : 'DIFFERS from'} its recorded sha256`).join('; ')}`,
      `Provenance: ${info.provenanceRecords} records, ${stale} past their freshness limit; ${info.pendingCandidates} pending font candidates`,
    ].join('\n'));
    process.exit(snaps.every((s) => s.ok) ? 0 : 1);
  } catch (e) {
    console.error(`ux-search: ${e.message}`);
    process.exit(1);
  }
}

if (!query || (domainArg && !DOMAINS[domainArg]) || (stackArg && !STACKS.includes(stackArg)) || (domainArg && stackArg) || !Number.isInteger(max) || max < 1 || max > 20) {
  console.error(`usage: ux-search.mjs "<query>" [--domain ${Object.keys(DOMAINS).join('|')} | --stack ${STACKS.join('|')}] [-n 1-20] [--json] [--full]`);
  process.exit(2);
}

try {
  const picked = domainArg || stackArg ? { domain: domainArg } : detect(query);
  const result = { ...search(query, picked.domain, max, stackArg), autoDetected: !domainArg && !stackArg, runnerUp: picked.runnerUp ?? null };
  console.log(flag('--json') ? JSON.stringify(result, null, 2) : format(result, flag('--full')));
} catch (e) {
  console.error(`ux-search: ${e.message}`);
  process.exit(1);
}
