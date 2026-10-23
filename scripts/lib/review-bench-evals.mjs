// Offline checks for the reviewer miss-rate bench (scripts/review-bench.mjs). No LLM calls:
//   - every seeded case is well formed (snippets found once, clean cases have no defects, expected verdicts)
//   - the scorer tells a perfect, a demoting, a silent and a spamming reviewer apart, so the numbers mean something
//   - the parser, the line/keyword matcher, the gate and the inlined reviewer prompt behave as documented
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CASES, buildPatch, locateDefects, parseReview, matches, scoreReview, aggregate, gate, GATES, buildSystemPrompt, userPrompt } from './review-bench.mjs';

const section = (title, items) => `## ${title}\n${items.length ? items.map((i) => `- ${i}`).join('\n') : 'None'}\n`;
const review = (verdict, blockers, suggestions) => `**Verdict: ${verdict}**\n\n${section('Blockers', blockers)}\n${section('Suggestions', suggestions)}\n### Second brain\n- 2026-10-23 ${verdict}\n\n\`\`\`json\n{"role":"code-reviewer"}\n\`\`\`\n`;
const cite = (c, d) => (d.file ? `${d.file}:${d.line ?? 1} ${d.keywords[0]} problem (AC-1, BE)` : `${d.keywords[0]} not implemented (AC-2, BE)`);

export function runReviewBenchEvals({ check, root }) {
  const n = 'review-bench';
  const ids = CASES.map((c) => c.id);
  check(`${n}: case ids are unique`, new Set(ids).size === ids.length);
  check(`${n}: has defect and clean cases`, CASES.some((c) => c.kind === 'defect') && CASES.filter((c) => c.kind === 'clean').length >= 3);

  const core = CASES.filter((c) => c.core);
  check(`${n}: core cases are small and cover both kinds`, core.length <= 8 && core.some((c) => c.kind === 'clean') && core.filter((c) => c.kind === 'defect').length >= 3);
  check(`${n}: core cases include a defect and its clean twin, and the rule cases`, ['tautological-test', 'skipped-test', 'swallowed-error', 'clean-error-paths', 'clean-decoys'].every((id) => core.some((c) => c.id === id)));
  for (const c of CASES) {
    let located = null;
    try { located = locateDefects(c); } catch (e) { check(`${n}: ${c.id} defects locate`, false, e.message); continue; }
    check(`${n}: ${c.id} defects locate`, true);
    check(`${n}: ${c.id} kind matches defects and verdict`, c.kind === 'clean' ? c.defects.length === 0 && c.expect === 'Approve' : c.defects.length > 0 && c.expect === 'Reject');
    check(`${n}: ${c.id} every defect has keywords`, c.defects.every((d) => d.keywords?.length > 0));
    const patch = buildPatch(c.files);
    check(`${n}: ${c.id} patch is added lines only`, patch.split('\n').filter((l) => /^[-+ ]/.test(l) && !/^(---|\+\+\+)/.test(l)).every((l) => l[0] === '+'));
    check(`${n}: ${c.id} defect line is that file's line`, located.every((d) => d.line == null || c.files[d.file].split('\n')[d.line - 1].includes(d.snippet)));
    check(`${n}: ${c.id} code carries no hint`, !/\b(bug|vulnerab|defect|TODO|FIXME|injection)\b/i.test(Object.values(c.files).join('\n')));
  }

  /* four synthetic reviewers: the metrics must separate them */
  const runWith = (make) => aggregate(CASES.map((c) => scoreReview(c, make(c))));
  const perfect = runWith((c) => (c.kind === 'clean' ? review('Approve', [], ['Optional: rename a local.']) : review('Reject', locateDefects(c).map((d) => cite(c, d)), [])));
  check(`${n}: perfect reviewer has no misses and no false rejects`, perfect.miss_rate === 0 && perfect.hard_miss_rate === 0 && perfect.demotion_rate === 0 && perfect.false_reject_rate === 0 && perfect.verdict_accuracy === 1);
  const demoting = runWith((c) => (c.kind === 'clean' ? review('Approve', [], []) : review('Approve', [], locateDefects(c).map((d) => cite(c, d)))));
  check(`${n}: a reviewer that demotes every defect shows demotion_rate 1`, demoting.miss_rate === 1 && demoting.demotion_rate === 1 && demoting.hard_miss_rate === 0 && demoting.verdict_accuracy < 1);
  const silent = runWith(() => review('Approve', [], []));
  check(`${n}: a silent reviewer shows hard_miss_rate 1 and no false rejects`, silent.hard_miss_rate === 1 && silent.demotion_rate === 0 && silent.false_reject_rate === 0);
  const spam = runWith((c) => review('Reject', [`${Object.keys(c.files)[0]}:2 magic number 200, add error handling (BE)`], []));
  check(`${n}: a spamming reviewer shows false_reject_rate 1 and false blockers`, spam.false_reject_rate === 1 && spam.false_blockers_per_clean_run >= 1);
  check(`${n}: unrelated blockers on a defect case do not hide the miss`, (() => { const c = CASES.find((x) => x.kind === 'defect'); const s = scoreReview(c, review('Reject', ['src/other.ts:9 unrelated nit (BE)'], [])); return s.defects[0].status === 'missed' && s.extraBlockers === 1; })());

  /* parser */
  const bold = parseReview('**Verdict:** Reject\n\n**Blockers**\n1. src/a.ts:4 sql injection (AC-1, BE)\n2. src/b.ts:9 no auth (AC-2, BE)\n\n**Suggestions**\n- rename x\n');
  check(`${n}: parser reads bold headings and numbered findings`, bold.verdict === 'Reject' && bold.blockers.length === 2 && bold.suggestions.length === 1);
  const inline = parseReview('Verdict: Approve\nBlockers: None\nSuggestions: none\n');
  check(`${n}: parser reads "Blockers: None" as no blockers`, inline.verdict === 'Approve' && inline.blockers.length === 0 && inline.suggestions.length === 0);
  const wrapped = parseReview('## Verdict: Reject\n## Blockers\n- src/a.ts:4 the query is built by\n  string concatenation (AC-1, BE)\n### Second brain\n- Blockers: B-1\n');
  check(`${n}: parser joins wrapped lines and stops at Second brain`, wrapped.blockers.length === 1 && /concatenation/.test(wrapped.blockers[0]));
  const nested = parseReview('**Verdict: Reject**\n\n### Blockers\n- **B-1** `src/a.ts:4` injectable (AC-1, BE)\n  - Snippet: `x`\n  - Scenario:\n    - Input: y\n  - Fix: z\n- **B-2** `src/b.ts:9` no auth (AC-2, BE)\n\n### Suggestions\n- rename\n');
  check(`${n}: parser keeps sub-bullets inside their finding`, nested.blockers.length === 2 && /Scenario/.test(nested.blockers[0]) && nested.suggestions.length === 1);
  const labelled = parseReview('**Verdict: Reject**\n\n### Blockers\n\n**B-1** `a.ts:4` N+1 (AC-1, BE)\n- **Scenario:** N orders run N queries\n- **Fix:** batch them\n\n**B-2** `b.ts:9` no auth (AC-2, BE)\n\n### Suggestions\n- **Note:** tidy\n');
  check(`${n}: parser keeps unindented bold-label bullets inside their blocker`, labelled.blockers.length === 2 && /Fix:/.test(labelled.blockers[0]) && labelled.suggestions.length === 1);
  const closed = parseReview('**Verdict:** Approve\n\n**Blockers:** none.\n\nAC → code:\n- AC-1: `a.ts:9` ok\n- AC-2: `a.ts:13` ok\n\n**Suggestions**\n- tidy\n');
  check(`${n}: "Blockers: none." closes the section and later bullets are not findings`, closed.blockers.length === 0 && closed.suggestions.length === 1);
  const ended = parseReview('**Verdict: Reject**\n\n### Blockers\n- **B-1** `a.ts:4` bad (AC-1, BE)\n\n**AC → code**\n- AC-1 → `a.ts:4`\n\n### AC coverage\n- AC-2: ok\n\n### Suggestions\n- tidy\n');
  check(`${n}: a heading after Blockers ends the section`, ended.blockers.length === 1 && ended.suggestions.length === 1);
  check(`${n}: parser returns null verdict when none is stated`, parseReview('looks fine').verdict === null);

  /* matcher */
  const d = { file: 'src/users/repo.ts', line: 10, keywords: ['inject'] };
  check(`${n}: matcher accepts the defect line and slack`, matches('src/users/repo.ts:10 bad', d) && matches('src/users/repo.ts:13 bad', d) && matches('repo.ts:8-9 bad', d));
  check(`${n}: matcher rejects a far line in the same file with no keyword`, !matches('src/users/repo.ts:40 bad', d));
  check(`${n}: matcher rejects the keyword without the file`, !matches('possible injection somewhere', d));
  check(`${n}: matcher accepts the keyword with the file and no line`, matches('src/users/repo.ts SQL injection', d));
  check(`${n}: matcher for an omission needs only the keyword`, matches('AC-2 is not implemented', { file: null, keywords: ['AC-2'] }) && !matches('AC-1 is fine', { file: null, keywords: ['AC-2'] }));

  /* gate */
  const base = { max_miss_rate: 0.2, max_demotion_rate: null, max_false_reject_rate: 0, max_false_blockers_per_clean_run: null };
  check(`${n}: gate fails above a limit and ignores null limits`, gate({ miss_rate: 0.3, demotion_rate: 1, false_reject_rate: 0, false_blockers_per_clean_run: 5 }, base).length === 1 && gate({ miss_rate: 0.2, false_reject_rate: 0 }, base).length === 0);
  const baseline = JSON.parse(readFileSync(join(root, 'evals/review-bench/baseline.json'), 'utf8'));
  check(`${n}: baseline.json has every gate key`, Object.values(GATES).every((k) => k in baseline));

  /* the runner reviews with the current reviewer rules */
  const sys = buildSystemPrompt();
  const principles = readFileSync(join(root, 'agents/references/code-reviewer/principles.md'), 'utf8');
  check(`${n}: runner prompt inlines the current reviewer principles`, sys.includes(principles.trim().split('\n')[0]) && sys.includes('A Blocker Must Be Provable'));
  check(`${n}: runner prompt names the patch, AC and contract`, ['diff-1.patch', 'ac.md', 'contract.md'].every((f) => userPrompt('x').includes(f)));
}
