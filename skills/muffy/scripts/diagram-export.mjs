#!/usr/bin/env node
// Exports a finished muffy diagram as a still image, for a deck, a document or a chat message. Manual: run it only when asked.
//   node diagram-export.mjs <file.html> --png out.png [--theme light|dark] [--scale 2] [--width 1280]
//   node diagram-export.mjs <flow-file.html> --svg out.svg [--theme light|dark]
// PNG works for every kind: the page is opened in a headless Chrome or Edge frozen on its finished frame (no animation, no
// controls) and photographed at its full height. SVG works only for flow diagrams, which are drawn as one SVG; the other kinds are
// HTML cards and an SVG of the wires alone would be useless. Run check-diagram.mjs first: a page that fails is not exported.
// Browser: $MUFFY_BROWSER, else the usual Chrome/Edge locations (see check-diagram-render.mjs). Zero dependencies.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { check } from './check-diagram.mjs';
import { findBrowser } from './check-diagram-render.mjs';

const fail = (m) => { console.error(`export: ${m}`); process.exit(2); };
const argv = process.argv.slice(2), flag = (n) => { const i = argv.indexOf(n); return i < 0 ? undefined : argv.splice(i, 2)[1]; };

export function snapshot(browser, file, theme, extra = []) {
  const profile = mkdtempSync(join(tmpdir(), 'muffy-export-'));
  try {
    return { profile, run: (args) => execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--user-data-dir=${profile}`, '--virtual-time-budget=4000', ...extra, ...args, `${pathToFileURL(resolve(file)).href}#measure,${theme}`], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }), done: () => rmSync(profile, { recursive: true, force: true }) };
  } catch (e) { rmSync(profile, { recursive: true, force: true }); throw e; }
}

// the standalone SVG of a flow diagram: the rendered <svg> plus the rules it needs, with the chosen theme's colours baked in
export function flowSvg(dom, page, theme) {
  const m = dom.match(/<svg\b[^>]*\sviewBox="([^"]+)"[^>]*>[\s\S]*?<\/svg>/);
  if (!m) return null;
  const [, , w, h] = m[1].split(/\s+/).map(Number);
  const vars = (page.match(theme === 'dark' ? /:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/ : /:root \{([\s\S]*?)\n\}/) ?? [])[1] ?? '';
  const rules = page.slice(page.indexOf('.wire {'), page.indexOf('\n.cap {'));
  const body = m[0].replace(/<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m[1]}" width="${w}" height="${h}" role="img" aria-label="${(page.match(/"title":\s*"([^"]*)"/) ?? [, 'diagram'])[1].replace(/[<>&"]/g, '')}">`);
  const css = `svg { ${vars.replace(/\s+/g, ' ')} }\n${rules}\n.step { opacity: 1; animation: none; cursor: default; } .step.future { opacity: 1 !important; }`;
  return body.replace(/(<svg\b[^>]*>)/, `$1<style>${css}</style><rect x="0" y="0" width="${w}" height="${h}" fill="var(--paper)"/>`);
}

if (basename(process.argv[1] ?? '') === 'diagram-export.mjs') {
  const png = flag('--png'), svg = flag('--svg'), theme = flag('--theme') ?? 'light', scale = +(flag('--scale') ?? 2), width = +(flag('--width') ?? 1280);
  const file = argv[0];
  if (!file || (!png && !svg)) fail('usage: diagram-export.mjs <file.html> --png out.png | --svg out.svg [--theme light|dark] [--scale 2] [--width 1280]');
  if (!['light', 'dark'].includes(theme)) fail('--theme must be light or dark');
  if (!(scale >= 1 && scale <= 4) || !(width >= 480 && width <= 3840)) fail('--scale is 1 to 4 and --width is 480 to 3840');
  if (png && extname(png).toLowerCase() !== '.png') fail('--png must end in .png');
  if (svg && extname(svg).toLowerCase() !== '.svg') fail('--svg must end in .svg');
  if ([png, svg].some((o) => o && resolve(o) === resolve(file))) fail('the output path is the source file');
  const page = readFileSync(file, 'utf8'), errs = check(page, file);
  if (errs.length) fail(`${file} does not pass check-diagram.mjs, not exported:\n  - ${errs.join('\n  - ')}`);
  const browser = findBrowser(); if (!browser) fail('no Chrome or Edge found (set MUFFY_BROWSER to a Chromium executable)');
  const kind = JSON.parse(page.match(/id="diagram">([\s\S]*?)<\/script>/)[1]).kind;
  const s = snapshot(browser, file, theme, [`--window-size=${width},900`]);
  try {
    const dom = s.run(['--dump-dom']), h = Math.min(Math.max(+(dom.match(/<html[^>]*\sdata-h="(\d+)"/)?.[1] ?? 900), 300), 8000);
    if (svg) {
      if (kind !== 'flow') fail(`--svg works for flow diagrams only (this is ${kind}): the other kinds are HTML cards. Use --png`);
      const out = flowSvg(dom, page, theme); if (!out) fail('no svg found in the rendered page');
      writeFileSync(svg, out); console.log(`wrote ${svg} (flow, ${theme})`);
    }
    if (png) {
      const s2 = snapshot(browser, file, theme, [`--window-size=${width},${h}`, `--force-device-scale-factor=${scale}`]);
      try { s2.run([`--screenshot=${resolve(png)}`]); } finally { s2.done(); }
      if (!existsSync(png)) fail('the browser did not write the image');
      console.log(`wrote ${png} (${width}x${h} at ${scale}x, ${theme})`);
    }
  } finally { s.done(); }
}
