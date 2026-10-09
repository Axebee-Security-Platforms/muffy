#!/usr/bin/env node
// Usage: node build-diagram-page.mjs <out.html> <render-dir> [<render-dir> ...]
// Builds one self-contained HTML page for a Claude Artifact from PR Lens render folders
// (.pr-lens/<title>/ holding drawn.graph.json and the light + dark SVGs).
// One section per folder (FE, BE), tabs per view, light/dark SVGs swap with the viewer theme.
// Exit 0 = written, 2 = bad input.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [out, ...dirs] = process.argv.slice(2);
if (!out || !dirs.length) { console.error('usage: build-diagram-page.mjs <out.html> <render-dir>...'); process.exit(2); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function section(dir, n) {
  const g = JSON.parse(readFileSync(join(dir, 'drawn.graph.json'), 'utf8'));
  const files = readdirSync(dir);
  const views = (g.views ?? []).map((v) => [v.id, v.title]);
  const img = (v, theme) => {
    const f = files.find((x) => x.startsWith(`${v}-${theme}-`) && x.endsWith('.svg'));
    if (!f) throw new Error(`${dir}: no ${theme} SVG for view ${v}; render both themes`);
    const svg = readFileSync(join(dir, f));
    const [, w, h] = svg.toString('utf8').match(/viewBox="0 0 (\d+) (\d+)"/);
    return `<img class="${theme === 'light' ? 'lt' : 'dk'}" alt="${esc(v)}, ${theme} theme" width="${w}" height="${h}" src="data:image/svg+xml;base64,${svg.toString('base64')}">`;
  };
  const tabs = views.map(([v, l], i) => `<button role="tab" id="t${n}-${v}" aria-selected="${i === 0}" data-s="${n}" data-v="${v}">${esc(l)}</button>`).join('');
  const panels = views.map(([v], i) => `<div role="tabpanel" id="p${n}-${v}" ${i ? 'hidden' : ''}><div class="frame">${img(v, 'light')}${img(v, 'dark')}</div></div>`).join('');
  const rows = g.nodes.filter((x) => x.files?.length).flatMap((x) => x.files.map((f) => `<tr><td><span class="pill ${x.delta}">${x.delta}</span></td><td class="mono">${esc(f.path)}</td><td>${esc(g.lanes.find((l) => l.id === x.lane)?.label ?? '')}</td></tr>`)).join('');
  const s = g.stats ?? {};
  const chips = [`<li><b>${s.filesChanged ?? '?'}</b><span>files changed</span></li>`, `<li><b>+${s.additions ?? 0} / −${s.deletions ?? 0}</b><span>lines</span></li>`, ...(s.chips ?? []).map((c) => `<li class="${esc(c.tone)}"><b>${esc(c.value)}</b><span>${esc(c.label)}</span></li>`)].join('');
  return `<section><header><div class="eyebrow">PR Lens · ${esc(g.provenance?.repo?.name ?? '')} · ${esc((g.provenance?.head?.sha ?? '').slice(0, 7))}</div><h2>${esc(g.title)}</h2><p class="sum">${esc(g.summary ?? '')}</p></header><ul class="chips">${chips}</ul><div role="tablist" aria-label="Diagram views">${tabs}</div>${panels}<div class="tbl"><table><thead><tr><th>Change</th><th>File</th><th>Lane</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

let sections;
try { sections = dirs.map(section); } catch (e) { console.error(e.message); process.exit(2); }

const dark = '--bg:#0e1117;--surface:#161b24;--fg:#e6eaf2;--muted:#98a2b3;--line:#283040;--add:#56d364;--add-bg:#12301c;--mod:#e3b341;--mod-bg:#35290a;--rem:#ff7b72;--rem-bg:#3d1518;--unch:#98a2b3;--unch-bg:#222a38;--accent:#7aa2ff;--canvas:#0d1117;color-scheme:dark';
const page = `<title>PR Lens Change Map</title>
<style>
:root{--bg:#f6f7f9;--surface:#fff;--fg:#1b2230;--muted:#5d6778;--line:#dde1e8;--add:#1a7f37;--add-bg:#dcf4e3;--mod:#9a6700;--mod-bg:#fbefc9;--rem:#cf222e;--rem-bg:#fde3e5;--unch:#5d6778;--unch-bg:#e8ebf0;--accent:#2f5fd0;--canvas:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}
:root[data-theme="dark"]{${dark}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding-inline:16px;padding-block:28px}
main{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:40px}
section{display:flex;flex-direction:column;gap:18px;min-width:0}
.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
h2{font-size:clamp(22px,3.5vw,30px);line-height:1.15;margin:4px 0 8px;text-wrap:balance}
.sum{max-width:68ch;color:var(--muted);margin:0}
.chips{display:flex;flex-wrap:wrap;gap:10px;list-style:none;padding:0;margin:0}
.chips li{display:flex;flex-direction:column;padding:10px 14px;border:1px solid var(--line);border-radius:6px;background:var(--surface);min-width:120px}
.chips b{font-size:20px;font-variant-numeric:tabular-nums}.chips span{font-size:12px;color:var(--muted)}
.chips .added b{color:var(--add)}.chips .modified b{color:var(--mod)}.chips .removed b{color:var(--rem)}.chips .hero b{color:var(--accent)}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600}
.pill.added{background:var(--add-bg);color:var(--add)}.pill.modified{background:var(--mod-bg);color:var(--mod)}.pill.removed{background:var(--rem-bg);color:var(--rem)}.pill.unchanged{background:var(--unch-bg);color:var(--unch)}
[role=tablist]{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
[role=tab]{font:inherit;background:none;color:var(--muted);border:0;border-bottom:2px solid transparent;padding:8px 14px;cursor:pointer}
[role=tab][aria-selected=true]{color:var(--fg);border-bottom-color:var(--accent);font-weight:600}
[role=tab]:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.frame{background:var(--canvas);border:1px solid var(--line);border-radius:8px;padding:14px;overflow-x:auto}
.frame img{display:block;height:auto;max-width:none;margin:0 auto}
.dk{display:none!important}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .lt{display:none!important}:root:not([data-theme="light"]) .dk{display:block!important}}
:root[data-theme="dark"] .lt{display:none!important}:root[data-theme="dark"] .dk{display:block!important}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);white-space:nowrap}tr:last-child td{border-bottom:0}th{color:var(--muted);font-weight:600}
.mono{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace}
.foot{font-size:12px;color:var(--muted);margin:0}
</style>
<main>
<div class="legend"><span><span class="pill added">added</span> new</span><span><span class="pill modified">modified</span> changed</span><span><span class="pill removed">removed</span> deleted</span><span><span class="pill unchanged">unchanged</span> neighbour</span></div>
${sections.join('\n')}
<p class="foot">Static SVG export from @coldtea/pr-lens-cli. Payload panels and the walkthrough need the PR Lens canvas.</p>
</main>
<script>
(function(){var all=[].slice.call(document.querySelectorAll('[role=tab]'));function grp(t){return all.filter(function(x){return x.dataset.s===t.dataset.s})}
function show(t){grp(t).forEach(function(x){var on=x===t;x.setAttribute('aria-selected',on);document.getElementById('p'+x.dataset.s+'-'+x.dataset.v).hidden=!on})}
all.forEach(function(t){t.addEventListener('click',function(){show(t)});t.addEventListener('keydown',function(e){var g=grp(t),i=g.indexOf(t),n=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:-1;if(n<0)return;var x=g[(n+g.length)%g.length];x.focus();show(x);e.preventDefault()})})})();
</script>`;
writeFileSync(out, page);
console.log(`wrote ${out} (${dirs.length} section${dirs.length > 1 ? 's' : ''}, ${page.length} bytes)`);
