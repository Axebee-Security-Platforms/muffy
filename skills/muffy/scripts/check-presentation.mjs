#!/usr/bin/env node
// Validates a present-mode output folder (agents/references/product-manager/present/output-format.md).
//   node check-presentation.mjs [--content] <folder> [more folders ...]   (--content: deck.json and outline only, before the designer builds deck.html)
// Checks: deck.json fits the slide types and their limits; every number, date and timeframe the audience sees carries a
// source that exists (or "request"); numbers not in the data carry `derived`; no internal names; deck.html is the template
// with only <title>, the #theme style and the #deck JSON changed, and that JSON equals deck.json; #theme sets only deck
// variables, each value taken from docs/design-system/tokens.css; outline.md exists; data.csv exists when a chart,
// comparison or roadmap slide does. Exit 1 on any FAIL. Zero dependencies.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const JSON_BLOCK = /(<script type="application\/json" id="deck">)([\s\S]*?)(<\/script>)/;
const TITLE = /<title>[\s\S]*?<\/title>/;
const THEME_BLOCK = /(<style id="theme">)([\s\S]*?)(<\/style>)/;
// the deck variables a theme may set (templates/presentation.html :root); values come from docs/design-system/tokens.css
const THEME_VARS = ['paper', 'slide', 'ink', 'muted', 'line', 'soft', 'accent', 'good', 'warn', 's1', 's2', 's3', 's4', 'font', 'radius'];
const DARK_MEDIA = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^{}]*)\}\s*\}/g;
const ROOT_RULE = /(?::root|:root\[data-theme="dark"\])\s*\{([^{}]*)\}/g;
const TOKENS = 'docs/design-system/tokens.css';
const TYPES = ['title', 'agenda', 'bullets', 'timeline', 'roadmap', 'comparison', 'chart', 'metric', 'quote', 'diagram', 'section', 'steps', 'features', 'statement', 'cta'];
const KINDS = ['bar', 'grouped-bar', 'line', 'before-after'];
const STATUS = ['done', 'next', 'planned'];
const BACKGROUNDS = ['blueprint', 'plain', 'soft'];
const ROLES = ['decide', 'evaluate', 'use', 'operate', 'informed'];
const FAMILIARITY = ['none', 'some', 'deep'];
const CARES = ['cost', 'time', 'risk', 'ease', 'what-changes'];
const SETTINGS = ['live', 'read-alone'];
// a path, an optional #section, nothing after it: labels like "[assumed]" go in notes, not in the source
const SRC = /^(request|[^#\s[\]]+(#[^[\]]*[^\s[\]])?)$/;
const DIGIT = /\d/;
// what the audience must never see: internal paths, tool names, role names, AC ids, branch names
const INTERNAL = [
  [/\.team\b/, '.team'], [/\bmuffy\b/i, 'muffy'], [/\bAC-\d+/, 'AC id'],
  [/\b(orchestrator|frontend-dev|backend-dev|code-reviewer|qa-tester|docs-writer|product-manager)\b/i, 'agent name'],
  [/\b(feature|fe|be|fix|hotfix)\/[a-z0-9][\w-]*/i, 'branch name'], [/\bhand-?off\b/i, 'hand-off'],
];

const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../templates/presentation.html'), 'utf8');
const shell = (html) => html.replace(JSON_BLOCK, '$1$3').replace(TITLE, '<title></title>').replace(THEME_BLOCK, '$1$3').replace(/\r\n/g, '\n');
const templateShell = shell(template);

const text = (v) => typeof v === 'string' && v.trim() !== '';
const optText = (v) => v === undefined || typeof v === 'string';
// scripts written without spaces (Thai, CJK): word limits can't be counted, so a character cap stands in
const NO_SPACES = /[฀-๿぀-鿿]/;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const words = (v) => (typeof v === 'string' ? v.trim().split(/\s+/).filter(Boolean).length : 0);
// a word limit; scripts without spaces get about 5 characters per word instead
const over = (v, n) => typeof v === 'string' && (NO_SPACES.test(v) ? v.length > n * 5 : words(v) > n);
const limit = (n) => `${n} words (${n * 5} characters in Thai)`;
const nums = (s) => (typeof s === 'string' ? s.match(/\d[\d,]*(\.\d+)?/g) ?? [] : []).map((n) => Number(n.replace(/,/g, '')));

// every string the audience can see or a live presenter reads aloud: all but `source`
function visible(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => visible(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'source') visible(x, out);
  return out;
}

export function internalNames(strings) {
  const hits = new Set();
  for (const s of strings) for (const [re, what] of INTERNAL) { const m = s.match(re); if (m) hits.add(`${what} "${m[0]}"`); }
  return [...hits];
}

// root: when given, a source path (the part before #) must exist relative to it
export function checkDeck(d, { root } = {}) {
  const errs = [];
  const src = (where, s) => {
    if (!text(s)) { errs.push(`${where}: source is required (path#section, or "request")`); return; }
    if (!SRC.test(s)) { errs.push(`${where}: source "${s}" is not path#section or "request"`); return; }
    if (root && s !== 'request' && !existsSync(resolve(root, s.split('#')[0]))) errs.push(`${where}: source file ${s.split('#')[0]} does not exist`);
  };
  if (!d || typeof d !== 'object') return ['deck is not a JSON object'];
  if (!text(d.title)) errs.push('title is required');
  // the audience profile the requester answered (product-manager/present/required-inputs.md); the old "client" / "end-user" strings are not enough
  const a = d.audience;
  if (typeof a === 'string') errs.push(`audience "${a}" is the old form: write the profile object {who, role, familiarity, cares, setting}${a === 'client' ? ' (client was role decide)' : a === 'end-user' ? ' (end-user was role use)' : ''}`);
  else if (!a || typeof a !== 'object') errs.push('audience is required: {who, role, familiarity, cares, setting}');
  else {
    if (!text(a.who)) errs.push('audience.who is required (the requester\'s words)');
    if (!ROLES.includes(a.role)) errs.push(`audience.role must be one of ${ROLES.join(', ')}`);
    if (!FAMILIARITY.includes(a.familiarity)) errs.push(`audience.familiarity must be one of ${FAMILIARITY.join(', ')}`);
    if (!Array.isArray(a.cares) || a.cares.length < 1 || a.cares.length > 2 || !a.cares.every((c) => CARES.includes(c))) errs.push(`audience.cares must list one or two of ${CARES.join(', ')}`);
    if (!SETTINGS.includes(a.setting)) errs.push(`audience.setting must be one of ${SETTINGS.join(', ')}`);
  }
  // background follows the setting for legibility (designer/presentation.md); no source ties it to an audience type
  // optional: the designer's deck chooses its own surface; the draft template reads this
  if (d.background !== undefined && !BACKGROUNDS.includes(d.background)) errs.push(`background must be one of ${BACKGROUNDS.join(', ')}`);
  else if (d.background !== undefined && a?.setting === 'read-alone' && d.background !== 'plain') errs.push('a read-alone deck uses background plain (no presenter to direct attention; plain grounds read fastest)');
  const slides = Array.isArray(d.slides) ? d.slides : [];
  if (!slides.length) return [...errs, 'slides must be a non-empty array'];
  if (slides[0].type !== 'title' || slides.filter((s) => s.type === 'title').length !== 1) errs.push('exactly one title slide, and it comes first');
  if (slides.at(-1).type !== 'cta' || slides.filter((s) => s.type === 'cta').length !== 1) errs.push('exactly one cta slide, and it comes last');
  // the template draws with textContent: anything but a string shows as [object Object]
  const nonString = (v, path) => { if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) nonString(x, `${path}.${k}`); } else if (v !== undefined && typeof v !== 'string' && !(typeof v === 'number' && /\.(values\.\d+|number|duration)$/.test(path)) && typeof v !== 'boolean') errs.push(`${path}: must be a string`); };

  slides.forEach((s, i) => {
    const at = `slide ${i + 1} (${s?.type})`;
    if (!TYPES.includes(s?.type)) { errs.push(`slide ${i + 1}: type must be one of ${TYPES.join(', ')}`); return; }
    if (!text(s.headline)) errs.push(`${at}: headline is required (the takeaway, as a sentence)`);
    // assertion-evidence headlines (docs/research/presentation-layouts.md §4): a sentence, never a question, short enough for two lines
    else {
      if (/\?\s*$/.test(s.headline)) errs.push(`${at}: headline is a question; state the takeaway as a sentence`);
      if (NO_SPACES.test(s.headline)) { if (s.headline.length > 90) errs.push(`${at}: headline is over 90 characters`); }
      else {
        if (words(s.headline) > 15) errs.push(`${at}: headline is over 15 words`);
        if (s.type !== 'title' && words(s.headline) < 3) errs.push(`${at}: headline is under 3 words; write the takeaway as a sentence, not a label`);
      }
    }
    if (!optText(s.notes) || !optText(s.footnote) || !optText(s.derived)) errs.push(`${at}: notes, footnote and derived must be strings`);
    nonString(s, `${at}`);
    if (s.source !== undefined) src(at, s.source); // a source given where none is required must still be a real one
    // kicker: the small label above the headline ("The problem"); *word* in the headline marks the one accent the designer colours
    if (s.kicker !== undefined && (!text(s.kicker) || over(s.kicker, 3))) errs.push(`${at}: kicker is at most ${limit(3)}`);
    if (typeof s.headline === 'string') {
      const marks = (s.headline.match(/\*/g) ?? []).length;
      if (marks % 2 || marks > 2) errs.push(`${at}: headline emphasis is one *word or phrase* in a pair of asterisks`);
    }
    // narration: the voice-over of a read-alone deck (Auto-play shows it as a caption); duration: seconds on Auto-play
    if (s.narration !== undefined) {
      if (!text(s.narration)) errs.push(`${at}: narration must be a non-empty string`);
      else {
        if (over(s.narration, 40)) errs.push(`${at}: narration is over ${limit(40)} (two short sentences)`);
        if (DIGIT.test(s.narration)) src(`${at} narration (says a number)`, s.source);
      }
    }
    if (s.duration !== undefined && !(Number.isInteger(s.duration) && s.duration >= 4 && s.duration <= 30)) errs.push(`${at}: duration must be whole seconds from 4 to 30`);
    if (typeof s.caption === 'string') {
      if (s.caption.length > 120) errs.push(`${at}: caption is over 120 characters (one short sentence)`);
      if (DIGIT.test(s.caption)) src(`${at} caption (shows a number)`, s.source);
    }
    const needSlideSource = (strings) => { if (strings.some((t) => DIGIT.test(t))) src(`${at} (shows a number)`, s.source); };
    switch (s.type) {
      case 'title': needSlideSource([s.headline, s.subtitle].filter(Boolean)); break;
      case 'agenda':
        if (!Array.isArray(s.items) || s.items.length < 3 || s.items.length > 6) errs.push(`${at}: items must be 3 to 6`);
        break;
      case 'bullets':
        if (!Array.isArray(s.items) || !s.items.length || s.items.length > 5) errs.push(`${at}: items must be 1 to 5`);
        (s.items ?? []).forEach((t, j) => { if (over(t, 12)) errs.push(`${at}: item ${j + 1} is over ${limit(12)}`); });
        needSlideSource([s.headline, s.takeaway, ...(s.items ?? [])].filter(Boolean)); break;
      case 'timeline':
        if (!Array.isArray(s.events) || !s.events.length || s.events.length > 7) errs.push(`${at}: events must be 1 to 7`);
        (s.events ?? []).forEach((e, j) => {
          if (!text(e?.date) || !text(e?.label)) errs.push(`${at}: event ${j + 1} needs date and label`);
          if (!STATUS.includes(e?.status)) errs.push(`${at}: event ${j + 1} status must be done, next or planned`);
          src(`${at} event ${j + 1}`, e?.source);
        });
        break;
      case 'roadmap':
        if (!Array.isArray(s.columns) || s.columns.length < 2 || s.columns.length > 4) errs.push(`${at}: columns must be 2 to 4`);
        (s.columns ?? []).forEach((c, j) => {
          if (!text(c?.label)) errs.push(`${at}: column ${j + 1} label is required`);
          if (DIGIT.test(c?.label ?? '')) src(`${at} column "${c.label}" (a timeframe)`, c.source);
          if (!Array.isArray(c?.cards) || !c.cards.length || c.cards.length > 4) errs.push(`${at}: column ${j + 1} cards must be 1 to 4`);
          (c?.cards ?? []).forEach((k, n) => {
            if (!text(k?.title) || !text(k?.value)) errs.push(`${at}: column ${j + 1} card ${n + 1} needs title and value (what the audience gets)`);
            if (DIGIT.test(`${k?.title}${k?.value}`)) src(`${at} column ${j + 1} card ${n + 1}`, k?.source);
          });
        });
        break;
      case 'comparison': {
        const opts = s.options ?? [], crit = s.criteria ?? [];
        if (opts.length < 2 || opts.length > 3) errs.push(`${at}: options must be 2 to 3`);
        if (!crit.length || crit.length > 6) errs.push(`${at}: criteria must be 1 to 6`);
        if (opts.filter((o) => o?.recommended).length > 1) errs.push(`${at}: at most one recommended option`);
        opts.forEach((o, j) => { if (!text(o?.name)) errs.push(`${at}: option ${j + 1} name is required`); });
        crit.forEach((c, j) => { if (!text(c?.label) || !Array.isArray(c?.values) || c.values.length !== opts.length) errs.push(`${at}: criterion ${j + 1} needs a label and one value per option`); });
        needSlideSource([s.headline, ...visible(crit), ...visible(opts)]); break;
      }
      case 'chart': {
        const cats = s.categories ?? [], series = s.series ?? [];
        if (!KINDS.includes(s.kind)) errs.push(`${at}: kind must be one of ${KINDS.join(', ')}`);
        if (!text(s.unit)) errs.push(`${at}: unit is required`);
        if (!cats.length || cats.length > 12 || !cats.every(text)) errs.push(`${at}: categories must be 1 to 12 strings`);
        if (s.kind === 'before-after' && cats.length !== 2) errs.push(`${at}: before-after has exactly 2 categories`);
        if (!series.length || series.length > 4) errs.push(`${at}: series must be 1 to 4`);
        series.forEach((x, j) => {
          if (!text(x?.name)) errs.push(`${at}: series ${j + 1} name is required`);
          if (!Array.isArray(x?.values) || x.values.length !== cats.length) errs.push(`${at}: series ${j + 1} needs exactly one value per category`);
          else if (!x.values.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) errs.push(`${at}: series ${j + 1} values must be numbers >= 0 (axes start at zero)`);
        });
        src(at, s.source);
        const shown = new Set(series.flatMap((x) => x?.values ?? []).concat(cats.flatMap(nums)));
        if (nums(s.headline).some((n) => !shown.has(n)) && !text(s.derived)) errs.push(`${at}: the headline shows a number not in the data; add derived (the formula from source values)`);
        if (!optText(s.xLabel)) errs.push(`${at}: xLabel must be a string`);
        // one highlight, and it is the thing the headline names (Storytelling with Data: colour only where the eye should go)
        if (s.highlight !== undefined) {
          const h = s.highlight;
          if (!cats.includes(h?.category)) errs.push(`${at}: highlight.category must be one of the categories`);
          if (series.length > 1 && !series.some((x) => x?.name === h?.series)) errs.push(`${at}: highlight.series must name a series when there are several`);
          if (text(h?.category) && typeof s.headline === 'string' && !s.headline.toLowerCase().includes(h.category.toLowerCase())) errs.push(`${at}: the headline must name the highlighted category "${h.category}"`);
        }
        if (s.note !== undefined) {
          const n = s.note;
          if (!text(n?.text)) errs.push(`${at}: note.text is required`);
          else if (n.text.length > 60) errs.push(`${at}: note.text is over 60 characters`);
          if (n?.at !== undefined && !cats.includes(n.at)) errs.push(`${at}: note.at must be one of the categories`);
          if (DIGIT.test(n?.text ?? '')) src(`${at} note (shows a number or date)`, n?.source);
        }
        break;
      }
      case 'section': {
        const agenda = slides.find((x) => x?.type === 'agenda');
        if (slides.length < 10) errs.push(`${at}: section slides are for decks of 10 or more slides`);
        if (!agenda) errs.push(`${at}: a deck with section slides needs an agenda slide`);
        else if (slides.filter((x) => x?.type === 'section').length > (agenda.items ?? []).length) errs.push(`${at}: more section slides than agenda items`);
        if (s.number !== undefined && (!Number.isInteger(s.number) || s.number < 1 || (agenda && s.number > (agenda.items ?? []).length))) errs.push(`${at}: number must be the agenda position (1 to the number of agenda items)`);
        needSlideSource([s.headline]); break;
      }
      case 'steps': {
        // flat: 3-6 steps; grouped (a long process): 2-4 groups of 1-6 steps, 12 in all, numbered straight through
        const grouped = s.groups !== undefined;
        if (grouped && s.steps !== undefined) errs.push(`${at}: use steps or groups, not both`);
        if (grouped) {
          if (!Array.isArray(s.groups) || s.groups.length < 2 || s.groups.length > 4) errs.push(`${at}: groups must be 2 to 4`);
          (Array.isArray(s.groups) ? s.groups : []).forEach((g, j) => {
            if (!text(g?.label) || over(g.label, 3)) errs.push(`${at}: group ${j + 1} needs a label of at most ${limit(3)}`);
            if (!Array.isArray(g?.steps) || !g.steps.length || g.steps.length > 6) errs.push(`${at}: group ${j + 1} needs 1 to 6 steps`);
          });
        }
        const st = grouped ? (Array.isArray(s.groups) ? s.groups.flatMap((g) => (Array.isArray(g?.steps) ? g.steps : [])) : []) : s.steps ?? [];
        if (!grouped && (!Array.isArray(st) || st.length < 3 || st.length > 6)) errs.push(`${at}: steps must be 3 to 6 (a longer process uses groups)`);
        if (grouped && st.length > 12) errs.push(`${at}: grouped steps total ${st.length}; at most 12`);
        st.forEach((x, j) => {
          if (!text(x?.label)) errs.push(`${at}: step ${j + 1} label is required`);
          else if (/^\s*\d/.test(x.label)) errs.push(`${at}: step ${j + 1} label starts with a number; the template numbers the steps`);
          else if (over(x.label, 8)) errs.push(`${at}: step ${j + 1} label is over ${limit(8)}`);
          if (over(x?.detail, 12)) errs.push(`${at}: step ${j + 1} detail is over ${limit(12)}`);
        });
        // a step count in the headline ("three steps", "3 steps") must match; it needs no source
        const head = typeof s.headline === 'string' ? s.headline.toLowerCase() : '';
        const said = [...head.matchAll(/\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:simple\s+|quick\s+|easy\s+)?steps?\b/g), ...head.matchAll(/(\d+)\s*ขั้น/g)].map((m) => (/\d/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS.indexOf(m[1])));
        if (said.some((n) => n !== st.length)) errs.push(`${at}: the headline says ${said[0]} steps but there are ${st.length}`);
        const rest = head.replace(/\b\d+\s+(?:simple\s+|quick\s+|easy\s+)?steps?\b/g, '').replace(/\d+\s*ขั้น/g, '');
        needSlideSource([rest, ...st.flatMap((x) => [x?.label ?? '', x?.detail ?? ''])]); break;
      }
      case 'features': {
        // a grid of equal-standing items: roles, commands, capabilities, ways something helps
        const items = s.items ?? [];
        if (!Array.isArray(items) || items.length < 3 || items.length > 10) errs.push(`${at}: items must be 3 to 10`);
        (Array.isArray(items) ? items : []).forEach((x, j) => {
          if (!text(x?.title)) errs.push(`${at}: item ${j + 1} title is required`);
          else if (over(x.title, 6)) errs.push(`${at}: item ${j + 1} title is over ${limit(6)}`);
          if (over(x?.text, items.length > 6 ? 14 : 22)) errs.push(`${at}: item ${j + 1} text is over ${limit(items.length > 6 ? 14 : 22)} (shorter when there are more than 6 cards)`);
          if (over(x?.tag, 3)) errs.push(`${at}: item ${j + 1} tag is over ${limit(3)}`);
          if (DIGIT.test(`${x?.title ?? ''}${x?.text ?? ''}`) && x?.source !== undefined) src(`${at} item ${j + 1}`, x.source);
        });
        // a count in the headline ("10 roles", "6 ways", "หกทาง") must match the cards
        const count = [...String(s.headline ?? '').matchAll(/(\d+)\s*(?:[a-z]+|ตำแหน่ง|ทาง|ข้อ|คำสั่ง|เรื่อง|อย่าง)/gi)].map((m) => Number(m[1]));
        if (count.length && Array.isArray(items) && !count.includes(items.length)) errs.push(`${at}: the headline count ${count[0]} does not match ${items.length} cards`);
        const unsourced = (Array.isArray(items) ? items : []).filter((x) => x?.source === undefined).flatMap((x) => [x?.title ?? '', x?.text ?? '', x?.tag ?? '']);
        needSlideSource([String(s.headline ?? '').replace(/\d+\s*(?:[a-z]+|ตำแหน่ง|ทาง|ข้อ|คำสั่ง|เรื่อง|อย่าง)/gi, ''), ...unsourced]); break;
      }
      case 'statement': {
        if (!optText(s.support)) errs.push(`${at}: support must be a string`);
        else if (over(s.support, 20)) errs.push(`${at}: support is over ${limit(20)}`);
        if (slides[i - 1]?.type === 'statement') errs.push(`${at}: two statement slides in a row; put the evidence between them`);
        needSlideSource([s.headline, s.support ?? '']); break;
      }
      case 'metric':
        if (!Array.isArray(s.values) || !s.values.length || s.values.length > 4) errs.push(`${at}: values must be 1 to 4`);
        (s.values ?? []).forEach((m, j) => {
          if (!text(m?.value) || !text(m?.label)) errs.push(`${at}: value ${j + 1} needs value and label (strings)`);
          src(`${at} value ${j + 1}`, m?.source);
          if (m?.delta !== undefined && !text(m?.derived) && !text(s.derived)) errs.push(`${at}: value ${j + 1} has a delta; add derived (the formula from source values)`);
        });
        break;
      case 'quote':
        if (!text(s.text)) errs.push(`${at}: text is required`);
        if (over(s.text, 30)) errs.push(`${at}: quote is over ${limit(30)}`);
        src(at, s.source); break;
      case 'diagram': {
        const nodes = s.nodes ?? [], ids = new Set(nodes.map((n) => n?.id));
        if (!nodes.length || nodes.length > 7) errs.push(`${at}: nodes must be 1 to 7`);
        if (ids.size !== nodes.length || nodes.some((n) => !text(n?.id) || !text(n?.label))) errs.push(`${at}: every node needs a unique id and a label`);
        (s.edges ?? []).forEach((e, j) => { if (!ids.has(e?.from) || !ids.has(e?.to)) errs.push(`${at}: edge ${j + 1} points at an unknown node`); });
        needSlideSource([s.headline, ...nodes.map((n) => n?.label ?? ''), ...(s.edges ?? []).map((e) => e?.label ?? '')]); break;
      }
      case 'cta': {
        // decide for role decide/evaluate, act for the rest (product-manager/present/recipes.md "By audience")
        const want = ['decide', 'evaluate'].includes(d.audience?.role) ? 'decide' : ROLES.includes(d.audience?.role) ? 'act' : null;
        if (!['decide', 'act'].includes(s.kind)) errs.push(`${at}: kind must be decide or act`);
        else if (want && s.kind !== want) errs.push(`${at}: kind is ${s.kind} but audience role ${d.audience.role} needs ${want}`);
        if (s.kind === 'decide' && typeof s.ask === 'string' && !/\d|\b(by|before|at|on)\b|ภายใน|ก่อน/i.test(s.ask)) errs.push(`${at}: a decide ask names when the decision is needed (a date, or "by <meeting>")`);
      }
        if (!text(s.ask)) errs.push(`${at}: ask is required (the decision or action asked for)`);
        if (!Array.isArray(s.next) || !s.next.length) errs.push(`${at}: next must list at least one step`);
        // the close asks the audience for something they can do; open facts are TBDs for the requester, not steps
        (s.next ?? []).forEach((t, j) => { if (/\bTBD\b/.test(t)) errs.push(`${at}: next item ${j + 1} is a TBD, not something the audience can do; list open facts in the final message`); });
        if (/\bTBD\b/.test(s.ask ?? '')) errs.push(`${at}: ask is a TBD; ask for something the audience can do now`);
        needSlideSource([s.ask, ...(s.next ?? [])].filter(Boolean)); break;
    }
  });
  if (slides.filter((s) => s?.type === 'statement').length > 2) errs.push('at most 2 statement slides per deck');
  // bullets is the last resort (slide-types.md): more than half the deck means the content was not shaped
  const nb = slides.filter((s) => s?.type === 'bullets').length;
  if (nb > slides.length / 2) errs.push(`${nb} of ${slides.length} slides are bullets: use steps, timeline, roadmap, comparison, chart or metric, or merge slides`);
  const leaks = internalNames(visible(d));
  if (leaks.length) errs.push(`internal names in the deck: ${leaks.join(', ')}`);
  return [...new Set(errs)]; // a source checked twice (given and required) reports once
}

// tokens: the text of docs/design-system/tokens.css, null when the project has none, undefined to skip the source check
export function checkTheme(css, tokens) {
  const errs = [], decls = [];
  const rest = css.replace(DARK_MEDIA, (_, b) => { decls.push(b); return ''; }).replace(ROOT_RULE, (_, b) => { decls.push(b); return ''; });
  if (rest.trim()) return ['#theme may hold only :root, :root[data-theme="dark"] and the prefers-color-scheme dark :root:not([data-theme="light"]) rules, with variable declarations inside'];
  for (const d of decls.join(';').split(';').map((x) => x.trim()).filter(Boolean)) {
    const m = d.match(/^--([a-z0-9-]+)\s*:\s*(.+)$/i);
    if (!m) { errs.push(`#theme: "${d}" is not a --variable: value declaration`); continue; }
    const [, name, value] = m;
    if (!THEME_VARS.includes(name)) errs.push(`#theme: --${name} is not a deck variable (${THEME_VARS.map((v) => `--${v}`).join(', ')})`);
    if (/url\(|@|<|expression|\\/i.test(value)) errs.push(`#theme: --${name} value may not hold url(), @, < or escapes`);
    else if (tokens === null && !(name === 'accent' && /^#[0-9a-f]{6}$/i.test(value))) errs.push(`#theme: --${name} has no source: without ${TOKENS} only --accent (the requester's #rrggbb brand color) may be set`);
    else if (typeof tokens === 'string' && !tokens.includes(value)) errs.push(`#theme: --${name} value "${value}" is not in ${TOKENS}`);
  }
  return errs;
}

export function checkHtml(html, deck, { tokens } = {}) {
  const errs = [];
  const m = html.match(JSON_BLOCK);
  if (!m) return ['deck.html has no <script type="application/json" id="deck"> block'];
  if (shell(html) !== templateShell) errs.push('deck.html differs from templates/presentation.html outside <title>, the #theme style and the #deck JSON: copy the template and edit only those');
  const th = html.match(THEME_BLOCK);
  if (th) errs.push(...checkTheme(th[2], tokens));
  if (/<\/script|<!--|<script/i.test(m[2])) errs.push('deck JSON in deck.html contains "</script", "<script" or "<!--": write "<" as \\u003c');
  let j;
  try { j = JSON.parse(m[2]); } catch (e) { return [...errs, `deck JSON in deck.html does not parse: ${e.message}`]; }
  if (deck && JSON.stringify(j) !== JSON.stringify(deck)) errs.push('the JSON in deck.html differs from deck.json: paste deck.json into #deck again');
  return errs;
}

// the designer's deck (templates/presentation-stage.html): free layout, so the check is on content, not on markup.
// Every slide's headline is in its own <section class="slide">, in order; every number on screen is one deck.json holds;
// nothing internal is visible; the only outside requests are Google Fonts; the frame and the #deck copy are kept.
const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/;
const visibleText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const squash = (t) => String(t).replace(/\*/g, '').replace(/\s+/g, '');

export function checkDesigned(html, deck) {
  const errs = [];
  const m = html.match(JSON_BLOCK);
  if (!m) return ['deck.html has no <script type="application/json" id="deck"> block (keep the copy of deck.json the stage reads narration from)'];
  try { if (JSON.stringify(JSON.parse(m[2])) !== JSON.stringify(deck)) errs.push('the JSON in deck.html differs from deck.json: paste deck.json into #deck again'); }
  catch (e) { errs.push(`deck JSON in deck.html does not parse: ${e.message}`); }
  for (const [re, what] of [[/id="stage"/, 'the stage'], [/class="ui"/, 'the controls'], [/id="caption"/, 'the caption'], [/class="sheet"/, 'the sheet label']]) if (!re.test(html)) errs.push(`deck.html lost ${what} of templates/presentation-stage.html`);
  const sections = [...html.replace(/<!--[\s\S]*?-->/g, ' ').matchAll(/<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>([\s\S]*?)<\/section>/gi)].map((x) => x[1]);
  const slides = deck?.slides ?? [];
  if (sections.length !== slides.length) errs.push(`deck.html has ${sections.length} slide sections; deck.json has ${slides.length}`);
  slides.forEach((s, i) => { if (sections[i] !== undefined && text(s?.headline) && !squash(visibleText(sections[i])).includes(squash(s.headline))) errs.push(`slide ${i + 1}: its headline from deck.json is not on the slide word for word`); });
  // every number shown must come from deck.json (or be a slide counter); a designer adds layout, never facts
  const known = new Set(visible(deck).flatMap(nums).concat(slides.flatMap((s) => (s?.series ?? []).flatMap((x) => x?.values ?? []))));
  const shown = visibleText(sections.join(' ')).match(/\d[\d,]*(\.\d+)?/g) ?? [];
  const extra = [...new Set(shown.map((n) => Number(n.replace(/,/g, ''))).filter((n) => !known.has(n) && !(Number.isInteger(n) && n >= 1 && n <= slides.length)))];
  if (extra.length) errs.push(`numbers on the slides that deck.json does not hold: ${extra.slice(0, 8).join(', ')}`);
  const leaks = internalNames([visibleText(html)]);
  if (leaks.length) errs.push(`internal names on the slides: ${leaks.join(', ')}`);
  const urls = [...html.replace(/<!--[\s\S]*?-->/g, ' ').matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)/gi)].map((x) => x[1] ?? x[2]).filter((u) => /^(https?:)?\/\//i.test(u));
  const bad = urls.filter((u) => !FONT_HOSTS.test(u));
  if (bad.length) errs.push(`outside requests other than Google Fonts: ${[...new Set(bad)].slice(0, 3).join(', ')}`);
  if (/<script\b[^>]*\bsrc=/i.test(html)) errs.push('no external scripts');
  if (/<img\b|<video\b|<iframe\b/i.test(html)) errs.push('no images, video or frames: draw with SVG and CSS');
  return errs;
}

export function checkFolder(dir, { root, contentOnly = false } = {}) {
  const p = (f) => join(dir, f);
  if (!existsSync(p('outline.md'))) return ['outline.md is missing'];
  const errs = [];
  const outlineLeaks = internalNames([readFileSync(p('outline.md'), 'utf8')]);
  if (outlineLeaks.length) errs.push(`internal names in outline.md: ${outlineLeaks.join(', ')}`);
  if (!existsSync(p('deck.json'))) return [...errs, 'deck.json is missing (round 1 ends at outline.md and is not checked)'];
  let deck;
  try { deck = JSON.parse(readFileSync(p('deck.json'), 'utf8')); } catch (e) { return [...errs, `deck.json does not parse: ${e.message}`]; }
  errs.push(...checkDeck(deck, { root }));
  // --content: the product-manager's check before the designer builds deck.html
  if (contentOnly) { /* deck.html is the designer's */ }
  else if (!existsSync(p('deck.html'))) errs.push('deck.html is missing');
  else {
    const html = readFileSync(p('deck.html'), 'utf8');
    if (html.includes('id="stage"')) errs.push(...checkDesigned(html, deck));
    else {
      const tok = root === undefined ? undefined : existsSync(resolve(root, TOKENS)) ? readFileSync(resolve(root, TOKENS), 'utf8') : null;
      errs.push(...checkHtml(html, deck, { tokens: tok }));
    }
  }
  if ((deck.slides ?? []).some((s) => ['chart', 'comparison', 'roadmap'].includes(s?.type)) && !existsSync(p('data.csv'))) errs.push('data.csv is missing (the deck has chart, comparison or roadmap slides)');
  return errs;
}

// compared by file name, like the other checkers: argv[1] is not resolved through a symlink or junction, import.meta.url is
if (basename(process.argv[1] ?? '') === 'check-presentation.mjs') {
  const contentOnly = process.argv.includes('--content'), dirs = process.argv.slice(2).filter((a) => a !== '--content');
  if (!dirs.length) { console.error('usage: check-presentation.mjs [--content] <folder> [more folders ...]'); process.exit(1); }
  let bad = 0;
  for (const d of dirs) {
    let errs;
    try { errs = checkFolder(d, { root: process.cwd(), contentOnly }); } catch (e) { errs = [e.message]; }
    if (errs.length) { bad++; console.log(`FAIL ${d}`); errs.forEach((e) => console.log(`  - ${e}`)); } else console.log(`PASS ${d}`);
  }
  process.exit(bad ? 1 : 0);
}
