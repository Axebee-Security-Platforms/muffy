#!/usr/bin/env node
// Builds the body of the AskUserQuestion at a human gate from the task's files (references/steps.md 2b, 3c, 10), so nothing the
// user must see is left out by a hand-written summary:
//   2b  user stories, AC list, out of scope, plan phases with P0/P1/P2 counts, brief → AC gaps, every [assumed] item
//   3c  canvas URL, AC → artboard (missing ones flagged), design-system changes, [verify] items, open UX findings from the
//       latest design-review-<n>.md (a `high` one means the gate is not ready: send it to the designer first)
//   10  QA result, bugs and AC coverage gaps, the 3d smoke result when 3d ran, open V- questions. Release notes and the Deploy
//       hand-off come after this gate (step 11), so they are not shown here
//
// Usage: node gate-summary.mjs <.team/<task>> 2b|3c|10 [--plan docs/plan/<task>.md]
// Prints the summary (markdown, short lines) on stdout, then `ready=yes` or `ready=no` with the reasons.
// Exit 0 = ready to ask the user, 1 = not ready (fix the reasons first), 2 = usage error.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTask } from './check-artifacts.mjs';
import { redesignScope, laneOf } from './gate-rules.mjs';

const readIf = (p) => (p && existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null);
const section = (md, name) => md?.match(new RegExp(`^## ${name}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'mi'))?.[1]?.trim() ?? null;
const bullets = (text) => (text ?? '').split('\n').filter((l) => /^\s*[-*] /.test(l)).map((l) => l.replace(/^\s*[-*] /, '').trim());
const rows = (text) => (text ?? '').split('\n').filter((l) => /^\s*\|/.test(l) && !/^\s*\|\s*:?-{2,}/.test(l)).slice(1).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const short = (s, n = 90) => { const t = s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const none = (s) => !s || /^none\.?$/i.test(s.trim());
// the words after the marker are the point, so a long line is cut from shortly before it, not from its start
const markers = (text, tag) => (text ?? '').split('\n').filter((l) => l.includes(`[${tag}]`)).map((l) => {
  const t = l.replace(/^\s*[-*|]\s*/, '').replace(/\*\*/g, '');
  const at = t.indexOf(`[${tag}]`);
  return short(at > 50 ? `…${t.slice(at - 40)}` : t, 140);
});

function acList(ac) {
  // `- **AC-1** …` (product-manager), `- AC-1: …`, or `AC-1 | result | check` (the Orchestrator-written ac.md of the internal scope, verify, upgrade)
  return (ac ?? '').split('\n').map((l) => l.match(/\*\*(AC-\d+)\*\*\s*(.*)$/) ?? l.match(/^\s*[-*]\s*(AC-\d+)[:\s]+(.*)$/) ?? l.match(/^\s*\|?\s*(AC-\d+)\s*\|\s*([^|]+?)\s*(?:\||$)/)).filter(Boolean).map((m) => [m[1], short(m[2])]);
}
function latest(taskDir, re) {
  const dir = join(taskDir, 'handoff');
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).filter((n) => re.test(n)).sort((a, b) => Number(a.match(/-r(\d+)\.json$/)?.[1] ?? 0) - Number(b.match(/-r(\d+)\.json$/)?.[1] ?? 0)).at(-1);
  try { return f ? JSON.parse(readFileSync(join(dir, f), 'utf8')) : null; } catch { return null; }
}

export function gate2b(taskDir, { plan } = {}) {
  const ac = readIf(join(taskDir, 'ac.md'));
  const out = [];
  const notReady = [];
  if (!ac) return { lines: [], notReady: ['ac.md is missing'] };
  out.push('**User stories**', ...bullets(section(ac, 'User stories')).map((s) => `- ${short(s)}`));
  const acs = acList(ac);
  out.push('', `**Acceptance criteria (${acs.length})**`, ...acs.map(([id, t]) => `- ${id} ${t}`));
  const oos = section(ac, 'Out of scope');
  out.push('', `**Out of scope:** ${none(oos) ? 'none' : short(oos.replace(/\n/g, '; '), 160)}`);
  const cpText = readIf(join(taskDir, 'checkpoint.md'));
  const noPlan = !!(cpText && redesignScope(cpText)); // a visible change writes no plan phases (change-profile.md)
  const planText = readIf(plan);
  if (noPlan && !planText) {
    // nothing to show: the AC and out of scope above are the whole question
  } else if (planText) {
    const phases = planText.split(/^## /m).slice(1).map((p) => {
      const [title, ...rest] = p.split('\n');
      const body = rest.join('\n');
      const n = (t) => (body.match(new RegExp(`\\b${t}\\b`, 'g')) ?? []).length;
      return `- ${short(title, 60)} · P0 ${n('P0')} · P1 ${n('P1')} · P2 ${n('P2')}`;
    });
    out.push('', '**Plan phases**', ...(phases.length ? phases : ['- (no ## phase headings found)']));
    if (!phases.length) notReady.push('the plan has no ## phase headings');
  } else {
    out.push('', '**Plan phases:** plan file not given or missing (pass --plan docs/plan/<task>.md)');
    notReady.push('no plan file to show');
  }
  const gaps = checkTask(taskDir, 'ac').filter((e) => e.startsWith('traceability: brief'));
  if (gaps.length) { out.push('', '**Brief → AC gaps**', ...gaps.map((g) => `- ${g.replace('traceability: ', '')}`)); notReady.push(`${gaps.length} brief requirement(s) without an AC`); }
  const assumed = [...markers(ac, 'assumed'), ...markers(readIf(join(taskDir, 'requirements.md')), 'assumed')];
  out.push('', `**Assumed (${assumed.length}):** ${assumed.length ? '' : 'none'}`, ...assumed.map((a) => `- ${a}`));
  return { lines: out, notReady };
}

// logic-only change or upgrade: no designer ran, so the gate asks the user to approve the architect's contract (and ADR) with the AC
function gate3cContract(taskDir, ac) {
  const contract = readIf(join(taskDir, 'contract.md'));
  if (!contract) return { lines: [], notReady: ['contract.md is missing'] };
  const heads = contract.split('\n').filter((l) => /^#{1,3} /.test(l)).map((l) => `- ${short(l.replace(/^#+ /, ''), 80)}`);
  const verify = markers(contract, 'verify');
  const out = ['**Contract (no design.md: a logic-only change or an upgrade ADR)**', ...heads.slice(0, 16), '', '**Acceptance criteria**', ...acList(ac).map(([id, t]) => `- ${id} ${t}`), '', `**[verify] items (${verify.length}):** ${verify.length ? '' : 'none'}`, ...verify.map((v) => `- ${v}`)];
  return { lines: out, notReady: acList(ac).length ? [] : ['ac.md lists no AC'] };
}

export function gate3c(taskDir) {
  const design = readIf(join(taskDir, 'design.md'));
  const ac = readIf(join(taskDir, 'ac.md'));
  const out = [];
  const notReady = [];
  const checkpoint = readIf(join(taskDir, 'checkpoint.md'));
  const scope = checkpoint ? redesignScope(checkpoint) : null;
  if (scope === 'logic-only' || (checkpoint && laneOf(checkpoint) === 'upgrade')) return gate3cContract(taskDir, ac);
  if (!design) return { lines: [], notReady: ['design.md is missing'] };
  if (scope === 'ui-only') out.push('**Acceptance criteria** (approved together with the design)', ...acList(ac).map(([id, t]) => `- ${id} ${t}`), '');
  const canvas = design.match(/https?:\/\/\S+/)?.[0] ?? checkpoint?.match(/canvas:\s*(https?:\/\/\S+)/)?.[1];
  out.push(`**Canvas:** ${canvas ?? 'not published'}`);
  if (!canvas) notReady.push('no canvas URL in design.md or checkpoint');
  const map = new Map(rows(section(design, 'AC id (?:->|→) artboard')).map(([id, art]) => [id, art]));
  const ids = acList(ac).map(([id]) => id);
  out.push('', '**AC → artboard**', ...ids.map((id) => `- ${id} → ${map.get(id) || 'MISSING'}`));
  const missing = ids.filter((id) => !map.get(id));
  if (missing.length) notReady.push(`no artboard for ${missing.join(', ')}`);
  const ds = section(design, 'Design system changes');
  out.push('', `**Design system changes:** ${none(ds) ? 'none' : short(ds.replace(/\n/g, '; '), 200)}`);
  const verify = markers(design, 'verify');
  out.push('', `**[verify] items (${verify.length}):** ${verify.length ? '' : 'none'}`, ...verify.map((v) => `- ${v}`));
  const reviews = existsSync(taskDir) ? readdirSync(taskDir).filter((f) => /^design-review-\d+\.md$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])) : [];
  if (reviews.length) {
    const text = readIf(join(taskDir, reviews.at(-1)));
    const findings = text.split('\n').filter((l) => /\bUX-\d+\b/.test(l)).map((l) => {
      const sev = l.match(/\b(high|medium|low)\b/i)?.[1]?.toLowerCase() ?? '?';
      return { sev, line: short(l.replace(/^\s*[-*|]\s*/, '').replace(/\s*\|\s*/g, ' · '), 120) };
    });
    out.push('', `**UX/UI review (${reviews.at(-1)}): ${findings.length} finding(s)**`, ...findings.map((f) => `- ${f.line}`));
    const high = findings.filter((f) => f.sev === 'high');
    if (high.length) notReady.push(`${high.length} high UX finding(s): send to the designer before asking`);
  } else out.push('', '**UX/UI review:** none on file (say "review skipped: impeccable not installed" if so)');
  return { lines: out, notReady };
}

export function gate10(taskDir) {
  const out = [];
  const notReady = [];
  const qa = readIf(join(taskDir, 'qa-report.md'));
  if (!qa) notReady.push('qa-report.md is missing');
  else {
    out.push(`**QA:** ${short(section(qa, 'Results') ?? 'no ## Results', 160)}`);
    const bugs = section(qa, 'Bugs');
    out.push(`**Bugs:** ${none(bugs) ? 'none' : short(bugs.replace(/\n/g, '; '), 200)}`);
    if (!none(bugs)) notReady.push('qa-report.md lists open bugs');
    if (/\bfail(ed|s)?\b/i.test(section(qa, 'Results') ?? '') && !/\b0 fail/i.test(section(qa, 'Results'))) notReady.push('QA results mention failures');
    const gaps = checkTask(taskDir, 'qa').filter((e) => e.startsWith('traceability:'));
    if (gaps.length) { out.push('**AC coverage gaps**', ...gaps.map((g) => `- ${g.replace('traceability: ', '')}`)); notReady.push(`${gaps.length} AC coverage gap(s)`); }
  }
  const smoke = latest(taskDir, /^3d-devops-r\d+\.json$/);
  if (smoke) {
    out.push(`**Smoke (3d):** ${smoke.status}${smoke.verdict ? ` · ${smoke.verdict}` : ''} · ${short(smoke.summary ?? '', 120)}`);
    if (smoke.status !== 'done' || /^fail/i.test(smoke.verdict ?? '')) notReady.push('the 3d smoke did not pass');
  }
  const review = latest(taskDir, /^6-code-reviewer-r\d+\.json$/);
  const vs = review?.needs_validation ?? [];
  out.push(`**Open questions (V-):** ${vs.length ? '' : 'none'}`, ...vs.map((v) => `- ${v.id} ${short(v.question ?? '', 100)} (${v.owner ?? '-'})`));
  return { lines: out, notReady };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [taskDir, gate, ...rest] = process.argv.slice(2);
  const plan = rest[rest.indexOf('--plan') + 1];
  const fn = { '2b': gate2b, '3c': gate3c, '10': gate10 }[gate];
  if (!taskDir || !fn) { console.error('usage: gate-summary.mjs <.team/<task>> 2b|3c|10 [--plan docs/plan/<task>.md]'); process.exit(2); }
  const { lines, notReady } = fn(taskDir, { plan: rest.includes('--plan') ? plan : undefined });
  if (lines.length) console.log(lines.join('\n'));
  console.log(notReady.length ? `ready=no\n${notReady.map((r) => `reason: ${r}`).join('\n')}` : 'ready=yes');
  process.exit(notReady.length ? 1 : 0);
}
