// Reviewer miss-rate bench: builds the review inputs, parses a review, scores it against the seeded defects.
// No LLM calls here. scripts/review-bench.mjs runs the model; scripts/eval.mjs checks this file offline.
import { readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES } from '../../evals/review-bench/cases.mjs';

export { CASES };
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LINE_SLACK = 3;

/** New-file unified diff: every line is an added line, so a diff line number is the file line number. */
export function buildPatch(files) {
  return Object.entries(files).map(([path, text]) => {
    const lines = text.replace(/\n$/, '').split('\n');
    return `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((l) => '+' + l).join('\n')}\n`;
  }).join('');
}

/** Line (1-based) of each defect's snippet; null for an omission. Throws when a snippet is absent or ambiguous. */
export function locateDefects(c) {
  return c.defects.map((d) => {
    if (!d.snippet) return { ...d, line: null };
    const lines = (c.files[d.file] ?? '').replace(/\n$/, '').split('\n');
    const hits = lines.flatMap((l, i) => (l.includes(d.snippet) ? [i + 1] : []));
    if (hits.length !== 1) throw new Error(`${c.id}/${d.id}: snippet found on ${hits.length} lines of ${d.file}`);
    return { ...d, line: hits[0] };
  });
}

const HEAD = {
  verdict: /verdict\W*\**\s*(approve|reject)/i,
  blockers: /^\s*(?:#{1,6}\s*|[-*]\s*)?\**\s*blockers?\b/i,
  suggestions: /^\s*(?:#{1,6}\s*|[-*]\s*)?\**\s*suggestions?\b/i,
  // any other heading closes the section: a # heading, a line that is only a bold label, or a short plain label ending in a colon
  other: /^\s*#{1,6}\s|^\s*\*\*[^*\n]{1,60}\*\*:?\s*$|^[A-Z][^.\n]{0,40}:\s*$/,
  stop: /^\s*(?:#{1,6}\s*|[-*]\s*)?\**\s*(?:second brain|hand-?off)\b|^\s*```json/i,
};
const NONE = /^\W*(none|no blockers?|n\/a|nothing)\b\W*$/i;

/** Split a review into verdict, blocker findings and suggestion findings. Tolerates ## or **bold** headings. */
export function parseReview(text) {
  const lines = String(text).split(/\r?\n/);
  const verdict = (text.match(HEAD.verdict)?.[1] ?? '').toLowerCase();
  let section = null;
  const buckets = { blockers: [], suggestions: [] };
  for (const raw of lines) {
    if (HEAD.stop.test(raw)) break; // Second brain and the hand-off line come last; their bullets are not findings
    const open = (name, re) => {
      section = name;
      const rest = raw.replace(re, '').replace(/^[\s:*\-—]+/, '');
      if (rest && NONE.test(rest)) section = null; // "Blockers: none." closes the section on the same line
      else if (rest) buckets[name].push(rest);
    };
    if (HEAD.blockers.test(raw) && !HEAD.verdict.test(raw)) { open('blockers', HEAD.blockers); continue; }
    if (HEAD.suggestions.test(raw) && !HEAD.verdict.test(raw)) { open('suggestions', HEAD.suggestions); continue; }
    if (section && HEAD.other.test(raw)) { section = null; continue; } // any other heading ends the section
    if (section && raw.trim()) buckets[section].push(raw.replace(/\s+$/, ''));
  }
  const group = (arr) => {
    const out = [];
    // a finding starts at a top-level bullet; indented sub-bullets (snippet, scenario, fix) belong to it
    // an unindented "- **Scenario:**" label right after a "**B-1**" header is part of that blocker, not a new one
    const label = /^[-*]\s+\*\*[^*\n]{1,40}:\*\*/;
    for (const l of arr) {
      const inBlocker = out.length && /^\W*B-\d+/.test(out[out.length - 1]);
      if (!out.length || (/^ {0,1}([-*]\s|\d+[.)]\s|\**B-\d+|\|)/.test(l) && !(inBlocker && label.test(l)))) out.push(l.trim());
      else out[out.length - 1] += ' ' + l.trim();
    }
    return out.filter((l) => !NONE.test(l.replace(/^([-*]|\d+[.)])\s*/, '')));
  };
  return { verdict: verdict === 'approve' ? 'Approve' : verdict === 'reject' ? 'Reject' : null, blockers: group(buckets.blockers), suggestions: group(buckets.suggestions) };
}

const REF = /([\w./\\-]+\.(?:ts|tsx|js|jsx|py|go|md))(?::(\d+)(?:\s*[-–]\s*(\d+))?)?/g;

/** True when a finding is about this defect: it cites the defect's line (+/- slack) in the right file, or names its keywords. */
export function matches(finding, d) {
  const text = finding.toLowerCase();
  const kw = d.keywords.some((k) => text.includes(k.toLowerCase()));
  if (!d.file) return kw;
  const base = basename(d.file).toLowerCase();
  const cited = [...finding.matchAll(REF)].filter((m) => basename(m[1].replace(/\\/g, '/')).toLowerCase() === base);
  if (d.line != null && cited.some((m) => m[2] && Number(m[3] ?? m[2]) >= d.line - LINE_SLACK && Number(m[2]) <= d.line + LINE_SLACK)) return true;
  return kw && (cited.length > 0 || text.includes(base));
}

/** Score one review of one case. status per defect: blocker | suggestion (demoted) | missed. */
export function scoreReview(c, reviewText) {
  const parsed = parseReview(reviewText);
  const defects = locateDefects(c).map((d) => ({
    id: d.id,
    status: parsed.blockers.some((f) => matches(f, d)) ? 'blocker' : parsed.suggestions.some((f) => matches(f, d)) ? 'suggestion' : 'missed',
  }));
  const unmatched = parsed.blockers.filter((f) => !locateDefects(c).some((d) => matches(f, d)));
  return {
    id: c.id, kind: c.kind, verdict: parsed.verdict, verdictOk: parsed.verdict === c.expect, parsed: parsed.verdict !== null,
    defects,
    falseBlockers: c.kind === 'clean' ? unmatched.length : 0,
    extraBlockers: c.kind === 'defect' ? unmatched.length : 0,
    falseReject: c.kind === 'clean' && (parsed.verdict === 'Reject' || unmatched.length > 0),
  };
}

const rate = (n, d) => (d ? Math.round((n / d) * 1000) / 1000 : null);

/** Aggregate scored runs. miss_rate = defects not filed as a blocker; demotion_rate = the part of that filed only as a suggestion. */
export function aggregate(scores) {
  const defects = scores.flatMap((s) => s.defects);
  const clean = scores.filter((s) => s.kind === 'clean');
  const D = defects.length;
  const byStatus = (st) => defects.filter((d) => d.status === st).length;
  return {
    runs: scores.length, defects: D, clean_runs: clean.length,
    miss_rate: rate(D - byStatus('blocker'), D),
    hard_miss_rate: rate(byStatus('missed'), D),
    demotion_rate: rate(byStatus('suggestion'), D),
    false_reject_rate: rate(clean.filter((s) => s.falseReject).length, clean.length),
    false_blockers_per_clean_run: rate(clean.reduce((n, s) => n + s.falseBlockers, 0), clean.length),
    extra_blockers_per_defect_run: rate(scores.filter((s) => s.kind === 'defect').reduce((n, s) => n + s.extraBlockers, 0), scores.filter((s) => s.kind === 'defect').length),
    verdict_accuracy: rate(scores.filter((s) => s.verdictOk).length, scores.length),
    unparsed_runs: scores.filter((s) => !s.parsed).length,
  };
}

/** Metrics where higher is worse, and the baseline keys that gate them. */
export const GATES = { miss_rate: 'max_miss_rate', demotion_rate: 'max_demotion_rate', false_reject_rate: 'max_false_reject_rate', false_blockers_per_clean_run: 'max_false_blockers_per_clean_run' };

export function gate(metrics, baseline) {
  return Object.entries(GATES).flatMap(([m, key]) => (baseline[key] != null && metrics[m] != null && metrics[m] > baseline[key] ? [`${m} ${metrics[m]} > ${key} ${baseline[key]}`] : []));
}

/** System prompt for a bare reviewer run: the agent file plus the references it would load on demand, inlined. */
export function buildSystemPrompt() {
  const strip = (t) => t.replace(/^---[\s\S]*?---\r?\n/, '');
  const ref = (n) => readFileSync(join(root, 'agents/references/code-reviewer', n), 'utf8');
  const parts = [strip(readFileSync(join(root, 'agents/code-reviewer.md'), 'utf8'))];
  for (const n of ['purpose', 'required-inputs', 'rules-and-guardrails', 'workflow', 'principles', 'output-format', 'quality-checks']) parts.push(ref(`${n}.md`));
  return 'The reference files named below are inlined after this line; do not try to open them.\n\n' + parts.join('\n\n');
}

export const userPrompt = (id) => `Task ${id}, step 6, round 1. Review .team/${id}/diff-1.patch against .team/${id}/ac.md and .team/${id}/contract.md (all in the current directory). Return the review in your Output Format: Verdict, Blockers, Suggestions, Second brain, then the JSON hand-off line.`;
