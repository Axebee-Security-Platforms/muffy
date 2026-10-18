#!/usr/bin/env node
// Renders diagram HTML files in a headless Chrome or Edge and reports what the template's layout audit found
// (a label on a card or on another label, a wire running behind a card it does not join). Architecture, erd and screenmap only.
//   node check-diagram-render.mjs <file.html> [more.html ...]
// Run check-diagram.mjs first: this needs a valid page. Browser: $MUFFY_BROWSER, else the usual Chrome/Edge/Chromium locations.
// No browser found: prints SKIP and exits 0 (the check is advisory, never a gate that blocks a machine without one). Zero dependencies.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [
  process.env.MUFFY_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
].filter(Boolean);

export const findBrowser = () => CANDIDATES.find((p) => existsSync(p));

// the issues the page wrote to data-layout: [] when clean, null when the page has no audit (flow) or never ran it
export function layoutIssues(file, browser = findBrowser()) {
  const profile = mkdtempSync(join(tmpdir(), 'muffy-diagram-'));
  try {
    const dom = execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, '--window-size=1280,900',
      '--virtual-time-budget=4000', '--dump-dom', `${pathToFileURL(resolve(file)).href}#measure`], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    const m = dom.match(/<main[^>]*\sdata-layout="([^"]*)"/);
    if (!m) return null;
    const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return raw ? JSON.parse(raw) : [];
  } finally { rmSync(profile, { recursive: true, force: true }); }
}

if (basename(process.argv[1] ?? '') === 'check-diagram-render.mjs') {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: check-diagram-render.mjs <file.html> [more.html ...]'); process.exit(1); }
  const browser = findBrowser();
  if (!browser) { console.log('SKIP no Chrome or Edge found (set MUFFY_BROWSER to a Chromium executable); the layout was not rendered'); process.exit(0); }
  let bad = 0;
  for (const f of files) {
    let issues;
    try { if (!/id="diagram"/.test(readFileSync(f, 'utf8'))) throw new Error('not a muffy diagram'); issues = layoutIssues(f, browser); } catch (e) { bad++; console.log(`FAIL ${f}\n  - ${e.message}`); continue; }
    if (issues === null) console.log(`SKIP ${f} (flow diagrams have their own layout and no audit)`);
    else if (issues.length) { bad++; console.log(`FAIL ${f}`); issues.forEach((i) => console.log(`  - ${i}`)); } else console.log(`PASS ${f}`);
  }
  process.exit(bad ? 1 : 0);
}
