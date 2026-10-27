// Offline checks for the redesign lane (skills/muffy/references/redesign-profile.md) and the changes that came with it:
//   - the lane is read from the checkpoint Run profile, with its scope; it is gated like the feature lane, and 2b may be skipped
//   - gate 3c shows the AC for ui-only and the contract for logic-only
//   - no staging or production step remains; docs-writer is step 11, after the Human gate
//   - route, SKILL, run-profile and the pause table point at the lane
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { laneOf, redesignScope, gatesForSpawn, gateErrors } from '../../skills/muffy/scripts/gate-rules.mjs';
import { recordGate, PAUSES } from '../../skills/muffy/scripts/checkpoint.mjs';
import { gate3c, gate10 } from '../../skills/muffy/scripts/gate-summary.mjs';
import { NEVER_SKIP, SMOKE_TRIGGERS } from '../../skills/muffy/scripts/next-action.mjs';

const CP = (profile, status = '') =>
  `# Checkpoint: t\n\nUpdated: step 3\n\n## Goal\n\nx\n\n## Run profile\n\n${profile}\n\n## Status\n\n${status}\n`;

export function runRedesignLaneEvals({ check, root }) {
  const read = (...p) => readFileSync(join(root, ...p), 'utf8');
  const doc = read('skills/muffy/references/redesign-profile.md');
  const refs = (f) => read('skills/muffy/references', f);

  /* lane and scope come from the Run profile line */
  const ui = 'redesign lane (ui-only): skipped 1, 2b, architect, 3d';
  check('redesign: laneOf reads the redesign lane', laneOf(CP(ui)) === 'redesign' && laneOf(CP('fix lane: skipped 1')) === 'fix' && laneOf(CP('Full flow.')) === 'feature');
  check('redesign: redesignScope reads all three scopes', redesignScope(CP(ui)) === 'ui-only' && redesignScope(CP('redesign lane (ui+logic): skipped 1')) === 'ui+logic' && redesignScope(CP('redesign lane (logic-only): skipped 1')) === 'logic-only' && redesignScope(CP('Full flow.')) === null);
  check('redesign: gated like the feature lane', JSON.stringify(gatesForSpawn('frontend-dev', '', 'redesign')) === '["2b","3c"]' && gatesForSpawn('product-manager', '', 'redesign').length === 0);
  check('redesign: a step past an open gate is an error', gateErrors(CP(ui), ['4'], { lane: 'redesign' }).length === 2);

  /* gate 2b may be skipped in the redesign lane (ui-only) but not in the feature lane */
  const mk = (profile) => {
    const d = mkdtempSync(join(tmpdir(), 'redesign-'));
    mkdirSync(join(d, 'handoff'), { recursive: true });
    writeFileSync(join(d, 'checkpoint.md'), CP(profile));
    return d;
  };
  let d = mk(ui);
  let msg = '';
  try { msg = recordGate(d, '2b', 'skip', { reason: 'combined with the design gate' }); } catch (e) { msg = `ERR ${e.message}`; }
  check('redesign: gate 2b can be skipped with a reason', /gate 2b skipped/.test(msg) && !msg.startsWith('ERR'), msg);
  d = mk('Full flow, feature lane.');
  try { msg = recordGate(d, '2b', 'skip', { reason: 'x' }); } catch (e) { msg = `ERR ${e.message}`; }
  check('redesign: gate 2b still cannot be skipped in the feature lane', msg.startsWith('ERR'), msg);

  /* the skip rules follow the scope */
  d = mk('redesign lane (ui+logic): skipped 1');
  try { msg = recordGate(d, '2b', 'skip', { reason: 'x' }); } catch (e) { msg = `ERR ${e.message}`; }
  check('redesign: gate 2b cannot be skipped for ui+logic or logic-only', msg.startsWith('ERR') && /ui-only/.test(msg), msg);
  d = mk('redesign lane (logic-only): skipped 1, designer');
  writeFileSync(join(d, 'contract.md'), '# Contract\n');
  try { msg = recordGate(d, '3c', 'skip', { reason: 'x' }); } catch (e) { msg = `ERR ${e.message}`; }
  check('redesign: gate 3c (the contract gate) cannot be skipped once a contract exists', msg.startsWith('ERR') && /contract/.test(msg), msg);

  /* gate 2b can be approved with no plan file in the redesign lane (ui+logic, logic-only) */
  d = mk('redesign lane (ui+logic): skipped 1');
  writeFileSync(join(d, 'ac.md'), '# AC\n\n## User stories\n\n- as a user I want coupons to stack\n\n## Acceptance criteria\n\n- **AC-1** Two coupons apply to one order\n\n## Out of scope\n\nNone.\n');
  writeFileSync(join(d, 'checkpoint.md'), CP('redesign lane (ui+logic): skipped 1', '- paused at pause:plan-review · resume when the user answers'));
  try { msg = recordGate(d, '2b', 'approve', { by: 'ok' }); } catch (e) { msg = `ERR ${e.message}`; }
  check('redesign: gate 2b approves with no plan file', !msg.startsWith('ERR') && /gate 2b passed/.test(msg), msg);
  d = mk('Full flow, feature lane.');
  writeFileSync(join(d, 'ac.md'), '# AC\n\n## Acceptance criteria\n\n- **AC-1** x\n');
  writeFileSync(join(d, 'checkpoint.md'), CP('Full flow, feature lane.', '- paused at pause:plan-review · resume when the user answers'));
  try { msg = recordGate(d, '2b', 'approve', { by: 'ok' }); } catch (e) { msg = `ERR ${e.message}`; }
  check('redesign: the feature lane still needs a plan file to approve 2b', msg.startsWith('ERR') && /plan/.test(msg), msg);

  /* gate 3c: ui-only shows the AC text, logic-only shows the contract */
  const ac = '# AC\n\n## User stories\n\n- as a user I want a clearer dashboard\n\n## Acceptance criteria\n\n- **AC-1** The dashboard shows totals first\n- **AC-2** The filter bar stays on one row\n\n## Out of scope\n\nNone.\n';
  d = mk(ui);
  writeFileSync(join(d, 'ac.md'), ac);
  writeFileSync(join(d, 'design.md'), '# Design\n\nhttps://claude.ai/design/x\n\n## AC id -> artboard\n\n| AC | artboard |\n|---|---|\n| AC-1 | totals |\n| AC-2 | filters |\n');
  let r = gate3c(d);
  check('redesign gate 3c: ui-only shows the AC text next to the design', r.lines.join('\n').includes('AC-1 The dashboard shows totals first'), r.lines.join('\n'));
  d = mk('redesign lane (logic-only): skipped 1, designer, 3b');
  writeFileSync(join(d, 'ac.md'), ac);
  r = gate3c(d);
  check('redesign gate 3c: logic-only with no contract is not ready', r.notReady.some((x) => x.includes('contract.md')));
  writeFileSync(join(d, 'contract.md'), '# Contract\n\n## Endpoints\n\n## Coupon stacking rule\n\n[verify] max two coupons per order\n');
  r = gate3c(d);
  check('redesign gate 3c: logic-only shows the contract, the AC and the [verify] items; ready', r.notReady.length === 0 && r.lines.join('\n').includes('Coupon stacking rule') && r.lines.join('\n').includes('AC-2') && r.lines.join('\n').includes('max two coupons'), r.lines.join('\n') + r.notReady);

  /* no staging or production step; docs-writer is step 11, after the gate */
  check('steps: step 11 is docs-writer after the Human gate; steps 8 and 9 are gone', /^\| 11 \| `docs-writer`, \*\*after the Human gate approves\*\*/m.test(refs('steps.md')) && !/^\| (8|9) \|/m.test(refs('steps.md')) && !/devops. production/.test(refs('steps.md')));
  check('steps: never-skip list has no staging step', JSON.stringify(NEVER_SKIP) === '["6","7","10"]');
  check('steps: staging is not a smoke trigger', !('staging_none' in SMOKE_TRIGGERS));
  check('pauses: staging-credentials is gone and scope-upgrade exists, in the script and in run-profile.md', !PAUSES.includes('staging-credentials') && PAUSES.includes('scope-upgrade') && /`pause:scope-upgrade`/.test(refs('run-profile.md')) && !/pause:staging-credentials/.test(refs('run-profile.md')));
  check('gate 10: the body no longer asks for a staging result or release notes', !/staging|release-notes/i.test(gate10(mk('Full flow.')).notReady.join(' ')));
  check('docs-writer: fix, lite and redesign profiles each run it as step 11 after the gate', ['fix-profile.md', 'lite-profile.md', 'redesign-profile.md'].every((f) => /\| 11 \| `docs-writer`/.test(refs(f))));
  check('docs-writer: step 11 has a section in step-details.md', /^## Step 11/m.test(refs('step-details.md')));

  /* the lane is documented where the router and the run profile look for it */
  check('redesign-doc: the three scopes and the scope question are stated', ['ui-only', 'ui+logic', 'logic-only', 'pause:scope', 'pause:scope-upgrade', 'needs-logic:', '## Unchanged'].every((k) => doc.includes(k)));
  check('redesign-doc: it never skips review, QA, the Human gate or docs-writer', /Never skipped:\*\* 2, 6, 7, 10, 11/.test(doc));
  check('redesign-doc: route.md, SKILL.md and run-profile.md point at the lane', ['route.md', 'run-profile.md'].every((f) => refs(f).includes('redesign-profile.md')) && read('skills/muffy/SKILL.md').includes('redesign-profile.md') && /\/muffy redesign/.test(read('skills/muffy/SKILL.md')));
  check('route: full flow is no longer the default of decision step 6', !/Anything else → full flow/.test(refs('route.md')) && /never full flow/.test(refs('route.md')));
}
