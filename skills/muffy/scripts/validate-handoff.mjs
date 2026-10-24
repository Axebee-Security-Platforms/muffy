#!/usr/bin/env node
// Usage: node validate-handoff.mjs <file.json> [handoff|escalation|prompt-envelope]
// Exit 0 = valid, 1 = invalid (errors printed one per line), 2 = unreadable.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validate } from './schema.mjs';

const [file, kind = 'handoff'] = process.argv.slice(2);
if (!file) {
  console.error('usage: validate-handoff.mjs <file.json> [handoff|escalation|prompt-envelope]');
  process.exit(2);
}
try {
  const here = dirname(fileURLToPath(import.meta.url));
  const schema = JSON.parse(readFileSync(join(here, '..', 'schemas', `${kind}.schema.json`), 'utf8'));
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const errs = validate(schema, data);
  if (errs.length) {
    // the mistakes agents repeat most; one fix line each so the retry lands
    const hints = [
      [/\$\.step: expected string/, 'hint: "step" is a string, e.g. "4" or "4a", not a number'],
      [/\$\.status: must be one of/, 'hint: "status" is done | blocked | needs-input | not-ready (not "ready")'],
      [/\$\.blockers: expected array/, 'hint: "blockers" is an array of {id, problem, owner}; use [] when none'],
      [/\$: missing required "decisions"/, 'hint: "decisions" is [{id:"D-1",decision,why}], at least one: each choice this round made and why, so the next fresh spawn can read it'],
      [/\$\.blockers\[\d+\]\.owner: must be one of/, 'hint: blocker "owner" is FE | BE | Docs | Devops | Architect | Designer | PM | Researcher'],
    ];
    const extra = hints.filter(([re]) => errs.some((e) => re.test(e))).map(([, h]) => h);
    console.error([...errs, ...extra].join('\n'));
    process.exit(1);
  }
  console.log(`OK ${file}`);
} catch (e) {
  console.error(`cannot validate: ${e.message}`);
  process.exit(2);
}
