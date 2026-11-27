#!/usr/bin/env node
// Scripted half of the designer's adaptive, glass and motion rules (agent-references/designer/ux-ui-rules.md: rules tagged [scripted]).
//   node check-design.mjs <.team/<task>> [--tokens <tokens.css>]
// Reads <task>/canvas/project/*.dc.html (the artboards), <task>/design.md and docs/design-system/tokens.css
// (<task>/docs/design-system/tokens.css, else the nearest one above the task). No canvas yet = nothing to check, exit 0.
// Checks (each failure names its rule id):
//   MOTION-2  every duration and easing in the canvas is var(--duration-*) / var(--ease-*); tokens.css defines both
//   MOTION-3  transition and animation never name width, height, top, left, margin, padding or all
//   MOTION-7  any transition, animation or @keyframes comes with a prefers-reduced-motion block
//   GLASS-2   a backdrop-filter takes its blur from var(--glass-blur); tokens.css defines --glass-blur, --glass-tint, --glass-border
//   GLASS-3   a backdrop-filter comes with a prefers-reduced-transparency (or prefers-contrast) fallback
//   GLASS-5   a canvas that uses glass lists it under design.md "## Glass" (where it is used, and why that layer floats over content)
//   LAYOUT-7  no fixed container width of 480px or more; layout is intrinsic (@container, minmax, auto-fit/auto-fill, clamp or flex-wrap)
//   LAYOUT-9  a fixed or sticky bar reserves env(safe-area-inset-*)
//   LAYOUT-10 :hover effects sit behind @media (hover: hover) so touch screens get no stuck hover
//   TYPE-4    no raw hex colour in a <style> block or style="" attribute of the canvas (tokens only)
//   INVENTORY every component in design.md "## Component inventory" is named in at least one artboard
// Exit 0 = ok, 2 = violation (one line each) or unreadable input. Zero dependencies.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const readIf = (p) => (p && existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null);
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// every CSS the page carries: <style> blocks and style="" attributes
export function cssOf(html) {
  const blocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const attrs = [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => `x{${m[1]}}`);
  return stripComments([...blocks, ...attrs].join('\n'));
}

// split a stylesheet into rules, each with the at-rule context it sits in ("@media (hover: hover)" and so on)
export function rules(css) {
  const out = [];
  const walk = (text, ctx) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@media') || head.startsWith('@container') || head.startsWith('@supports') || head.startsWith('@layer')) walk(body, [...ctx, head]);
      else if (head.startsWith('@keyframes') || head.startsWith('@-webkit-keyframes')) out.push({ head, body, ctx, keyframes: true });
      else if (!head.startsWith('@')) out.push({ head, body, ctx });
      i = j;
    }
  };
  walk(css, []);
  return out;
}

const decls = (body) => body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const k = d.indexOf(':'); return k < 0 ? null : [d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim()]; }).filter(Boolean);
const TIME = /(?<![\w-])\d*\.?\d+m?s\b/;
const BAD_PROP = /\b(width|height|top|left|right|bottom|margin[\w-]*|padding[\w-]*|all)\b/;
const EASING_LITERAL = /\b(ease|ease-in|ease-out|ease-in-out|linear)\b|cubic-bezier\(|steps\(|spring\(/;

// css: the artboards' CSS in one string; tokens: tokens.css text or null; design: design.md text or null
export function checkCss(css, { tokens = null, design = null, names = null } = {}) {
  const errs = [];
  const rs = rules(css);
  const motion = [];
  let usesMotion = css.includes('@keyframes');
  for (const r of rs) {
    if (r.keyframes) continue;
    for (const [prop, val] of decls(r.body)) {
      if (prop === 'transition' || prop === 'animation' || prop.startsWith('transition-') || prop.startsWith('animation-')) {
        if (prop === 'transition' || prop === 'animation' || prop === 'transition-property' || prop === 'animation-name' || prop === 'transition-duration' || prop === 'animation-duration') usesMotion = true;
        motion.push([r.head, prop, val]);
      }
    }
  }
  for (const [head, prop, val] of motion) {
    const bare = val.replace(/var\([^)]*\)/g, ''); // a var() is a token; what is left is a literal
    if ((prop === 'transition' || prop === 'transition-property') && BAD_PROP.test(bare.replace(/[\d.]+m?s/g, ''))) errs.push(`MOTION-3: ${head} { ${prop}: ${val} } animates a layout property (or all): transform and opacity only`);
    if (!/^(animation-name|animation-fill-mode|animation-iteration-count|animation-direction|animation-play-state|transition-property)$/.test(prop) && TIME.test(bare)) errs.push(`MOTION-2: ${head} { ${prop}: ${val} } has a literal duration: use var(--duration-*)`);
    if (!/^(animation-name|animation-fill-mode|animation-iteration-count|animation-direction|animation-play-state|transition-property|transition-duration|animation-duration|transition-delay|animation-delay)$/.test(prop) && EASING_LITERAL.test(bare)) errs.push(`MOTION-2: ${head} { ${prop}: ${val} } has a literal easing: use var(--ease-*)`);
  }
  if (usesMotion) {
    if (!/prefers-reduced-motion/.test(css)) errs.push('MOTION-7: the canvas animates but has no @media (prefers-reduced-motion) block');
    if (tokens !== null) for (const t of ['--duration-', '--ease-']) if (!tokens.includes(t)) errs.push(`MOTION-2: tokens.css has no ${t}* token but the canvas animates`);
  }

  const glass = rs.filter((r) => !r.keyframes && decls(r.body).some(([p, v]) => (p === 'backdrop-filter' || p === '-webkit-backdrop-filter') && v !== 'none'));
  for (const r of glass) for (const [p, v] of decls(r.body)) if ((p === 'backdrop-filter' || p === '-webkit-backdrop-filter') && !/var\(--glass-blur/.test(v)) errs.push(`GLASS-2: ${r.head} { ${p}: ${v} } must take its blur from var(--glass-blur)`);
  if (glass.length) {
    if (tokens !== null) for (const t of ['--glass-blur', '--glass-tint', '--glass-border']) if (!tokens.includes(t)) errs.push(`GLASS-2: tokens.css does not define ${t}`);
    if (!/prefers-reduced-transparency|prefers-contrast/.test(css)) errs.push('GLASS-3: backdrop-filter without a prefers-reduced-transparency (or prefers-contrast) fallback to an opaque surface');
    if (design !== null && !/^## Glass\b/m.test(design)) errs.push('GLASS-5: the canvas uses glass but design.md has no "## Glass" section (where, and why that layer floats over content)');
  }

  for (const r of rs) {
    if (r.keyframes) continue;
    const ds = decls(r.body);
    for (const [p, v] of ds) {
      const m = (p === 'width' || p === 'min-width') && v.match(/^(\d+(?:\.\d+)?)px$/);
      if (m && Number(m[1]) >= 480) errs.push(`LAYOUT-7: ${r.head} { ${p}: ${v} } is a fixed container width: use max-width, minmax(), clamp() or a container query`);
    }
    const pos = ds.find(([p]) => p === 'position')?.[1];
    if ((pos === 'fixed' || pos === 'sticky') && /\b(top|bottom|left|right)\s*:\s*0\b|inset\s*:\s*0/.test(r.body) && !/env\(safe-area-inset-/.test(r.body)) errs.push(`LAYOUT-9: ${r.head} is a ${pos} bar with no env(safe-area-inset-*) padding or offset`);
    if (/:hover/.test(r.head) && !r.ctx.some((c) => /\(hover:\s*hover\)|\(any-hover:\s*hover\)/.test(c))) errs.push(`LAYOUT-10: ${r.head} is not inside @media (hover: hover): touch screens would keep the hover effect after a tap`);
  }
  if (rs.length && !/@container|minmax\(|auto-fit|auto-fill|clamp\(|flex-wrap\s*:\s*wrap/.test(css)) errs.push('LAYOUT-7: no intrinsic layout in the canvas (@container, minmax(), auto-fit/auto-fill, clamp() or flex-wrap): it adapts only through screen breakpoints');

  for (const r of rs) {
    if (r.keyframes) continue;
    for (const [p, v] of decls(r.body)) if (!p.startsWith('--') && /#[0-9a-f]{3,8}\b/i.test(v)) errs.push(`TYPE-4: ${r.head} { ${p}: ${v} } is a raw colour: use a semantic token`);
  }

  if (design !== null && names) {
    const inv = design.match(/^## Component inventory[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1];
    if (!inv) errs.push('INVENTORY: design.md has no "## Component inventory" section');
    else {
      const rows = inv.split('\n').filter((l) => /^\|/.test(l) && !/^\|[\s:|-]+\|?$/.test(l)).slice(1);
      if (!rows.length) errs.push('INVENTORY: "## Component inventory" has no rows');
      const hay = names.toLowerCase();
      for (const row of rows) {
        const name = row.split('|')[1]?.trim().replace(/[`*]/g, '');
        if (name && !hay.includes(name.toLowerCase())) errs.push(`INVENTORY: "${name}" is in the inventory but no artboard names it`);
      }
    }
  }
  return errs;
}

function findTokens(taskDir, given) {
  if (given) return readIf(resolve(given));
  for (let d = resolve(taskDir); ; d = dirname(d)) {
    const p = join(d, 'docs', 'design-system', 'tokens.css');
    if (existsSync(p)) return readIf(p);
    if (dirname(d) === d) return null;
  }
}

export function checkTask(taskDir, { tokens: tokensPath } = {}) {
  const dir = join(taskDir, 'canvas', 'project');
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.dc.html'));
  const html = files.map((f) => readFileSync(join(dir, f), 'utf8'));
  const css = html.map(cssOf).join('\n');
  const names = html.join('\n').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ') + html.join('\n');
  return checkCss(css, { tokens: findTokens(taskDir, tokensPath), design: readIf(join(taskDir, 'design.md')), names });
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const o = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) argv[i].startsWith('--') ? (o[argv[i].slice(2)] = argv[++i]) : pos.push(argv[i]);
  if (!pos[0]) { console.error('usage: check-design.mjs <.team/<task>> [--tokens <tokens.css>]'); process.exit(2); }
  let errs;
  try { errs = checkTask(pos[0], { tokens: o.tokens }); } catch (e) { console.error(`check-design: ${e.message}`); process.exit(2); }
  for (const e of errs) console.log(e);
  if (!errs.length) console.log('ok');
  process.exit(errs.length ? 2 : 0);
}
