// Headless gate mode (references/headless.md): muffy runs under `claude -p` with no question tool, and a person
// answers each gate later (Terminus renders .team/<task>/gate.json as Slack buttons, writes the answer into
// checkpoint ## Status and runs /muffy resume <task>). Pure rules only; checkpoint.mjs `ask` and `answer` do the writing.
//   headlessOf(env)              MUFFY_HEADLESS=1 → headless; MUFFY_HEADLESS_POLICY, MUFFY_TRIGGERED_BY
//   gatePolicy(gate, env, facts) interactive | ask | auto (rule H2), with the Status line an auto pass records
//   validateGate(obj)            gate.json against schemas/gate.schema.json (the AskUserQuestion input + gate, task, created_at)
//   findAnswer(status, gate)     the newest unconsumed `<gate> answered: <answer> by <who> (<source>) <ISO time>` line
//   auditAnswer(answer)          more-info | accept-risk | cancel, from a free-form button label
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './schema.mjs';

export const SELF_HEAL = 'self-heal';
export const AUTO_SCOPE = (by) => `auto: approved by Investigate (@${by}) · rule H2`;
export const AUTO_REDIAGNOSE = 'auto: re-diagnose · rule H2';
export const STATUS_LINE = (gate) => `muffy-status: waiting:${gate}`;

const GATE_SCHEMA = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'gate.schema.json'), 'utf8'));

export function headlessOf(env = {}) {
  return {
    headless: String(env.MUFFY_HEADLESS ?? '').trim() === '1',
    policy: String(env.MUFFY_HEADLESS_POLICY ?? '').trim(),
    by: String(env.MUFFY_TRIGGERED_BY ?? '').trim().replace(/^@/, ''),
  };
}

// facts: scope → { triagePassed, acFromRequest, scopeChange }; audit → { verdict, status: [## Status lines] }
export function gatePolicy(gate, env = {}, facts = {}) {
  const h = headlessOf(env);
  if (!h.headless) return { action: 'interactive', reason: 'MUFFY_HEADLESS is not 1: ask with AskUserQuestion as before' };
  if (h.policy !== SELF_HEAL) return { action: 'ask', reason: h.policy ? `policy "${h.policy}" allows no automatic pass` : 'no MUFFY_HEADLESS_POLICY: every gate waits for a person' };
  if (gate === 'scope') {
    if (!facts.triagePassed) return { action: 'ask', reason: 'rule H2 needs triage passed' };
    if (!facts.acFromRequest) return { action: 'ask', reason: 'rule H2 needs the AC to come straight from the request' };
    if (facts.scopeChange) return { action: 'ask', reason: 'a promotion or scope change always waits for a person' };
    if (!h.by) return { action: 'ask', reason: 'no MUFFY_TRIGGERED_BY: nobody to credit the Investigate click to' };
    return { action: 'auto', line: AUTO_SCOPE(h.by) };
  }
  if (gate === 'audit') {
    if (facts.verdict !== 'need-validation') return { action: 'ask', reason: `audit ${facts.verdict ?? 'reject'} always waits for a person` };
    if ((facts.status ?? []).some((l) => l.includes(AUTO_REDIAGNOSE))) return { action: 'ask', reason: 'rule H2 re-diagnoses once; this is the second non-confirm' };
    return { action: 'auto', line: AUTO_REDIAGNOSE };
  }
  return { action: 'ask', reason: `pause:${gate} has no automatic pass` };
}

export function validateGate(obj) {
  return validate(GATE_SCHEMA, obj);
}

const ANSWER = /^\s*(?:-\s*)?(?:pause:)?([a-z0-9-]+) answered:\s*(.+)\s+by\s+(\S+(?:\s\S+)*?)\s+\(([^)]*)\)\s*(\S*)\s*$/;

export function parseAnswer(line) {
  const m = ANSWER.exec(line);
  if (!m) return null;
  return { gate: m[1], answer: m[2].trim(), by: m[3].trim(), source: m[4].trim(), at: m[5] || null };
}

// An answer counts when it names this gate and is not older than the gate.json it answers (an answer with no time
// is taken as it stands). The last one in ## Status wins. Consumed lines read `answered (used):` and never match again.
export function findAnswer(status, gate, createdAt) {
  let found = null;
  status.forEach((line, index) => {
    const a = parseAnswer(line);
    if (!a || a.gate !== gate) return;
    if (createdAt && a.at && !Number.isNaN(Date.parse(a.at)) && Date.parse(a.at) < Date.parse(createdAt)) return;
    found = { ...a, index, line };
  });
  return found;
}

export function auditAnswer(answer) {
  const a = answer.toLowerCase();
  if (/accept|risk|go ahead|ยอมรับ/.test(a)) return 'accept-risk';
  if (/cancel|abort|ยกเลิก/.test(a)) return 'cancel';
  if (/more|info|evidence|re-?diagnose|ข้อมูล/.test(a)) return 'more-info';
  return null;
}

export const gateAnswer = (answer) => {
  const a = answer.toLowerCase();
  if (/^\s*(approve|approved|ok|yes|อนุมัติ|ผ่าน)\b/.test(a)) return 'approve';
  if (/^\s*(reject|request changes|changes|no|ไม่ผ่าน|แก้)/.test(a)) return 'reject';
  return null;
};
