// Reviewer miss-rate bench: seeded-defect and clean cases for code-reviewer.
// Each case is a new-file diff (so line numbers are file line numbers) plus the AC and contract the
// reviewer is given. A defect is located by `snippet` (a substring of exactly one added line); a defect
// with no `snippet` is an omission (a missing AC) and is matched by keywords only.
// `core` cases are the default run: the two rules added for tautological and skipped tests, one omission,
// one security defect, a defect with its clean twin (swallowed-error / clean-error-paths) and the decoys case.
// The rest are kept for `--all`.
// Defects stay realistic and neutral: no comment in the code hints at the problem.

const contract = (endpoints, budget = 'Budget: none. No new recurring cost') => `# Contract
## Endpoints
${endpoints}
## Errors
400 invalid input, 404 unknown id, 409 conflict, 502 upstream failure
## Cost
${budget}
`;

export const CASES = [
  {
    id: 'missing-ac',
    kind: 'defect',
    core: true,
    expect: 'Reject',
    ac: `# AC
- AC-1 POST /notes with a title creates a note and returns 201 {id, title}
- AC-2 DELETE /notes/:id removes the note and returns 204; an unknown id returns 404
- AC-3 POST /notes with an empty title returns 400
`,
    contract: contract(`- POST /notes {title} -> 201 {id, title}
- DELETE /notes/:id -> 204`),
    files: {
      'src/notes/routes.ts': `import { Router } from 'express';
import { notes } from './store';

export const router = Router();

router.post('/notes', async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ code: 'INVALID_TITLE' });
  const note = await notes.create({ title });
  return res.status(201).json({ id: note.id, title: note.title });
});
`,
      'src/notes/routes.test.ts': `import request from 'supertest';
import { app } from '../app';

test('creates a note', async () => {
  const res = await request(app).post('/notes').send({ title: 'Buy milk' });
  expect(res.status).toBe(201);
  expect(res.body.title).toBe('Buy milk');
});

test('rejects an empty title', async () => {
  const res = await request(app).post('/notes').send({ title: '  ' });
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('INVALID_TITLE');
});
`,
    },
    defects: [{ id: 'ac2-missing', file: null, snippet: null, keywords: ['AC-2', 'delete'] }],
  },
  {
    id: 'sql-injection',
    kind: 'defect',
    core: true,
    expect: 'Reject',
    ac: `# AC
- AC-1 GET /users?name=<text> returns the users whose name equals the text as a JSON array
`,
    contract: contract('- GET /users?name=<text> -> 200 [{id, name, email}]'),
    files: {
      'src/users/repo.ts': `import { db } from '../db';

export async function findByName(name: string) {
  const sql = "SELECT id, name, email FROM users WHERE name = '" + name + "'";
  return db.query(sql);
}
`,
      'src/users/routes.ts': `import { Router } from 'express';
import { findByName } from './repo';

export const router = Router();

router.get('/users', async (req, res) => {
  const rows = await findByName(String(req.query.name ?? ''));
  res.status(200).json(rows);
});
`,
      'src/users/routes.test.ts': `import request from 'supertest';
import { app } from '../app';
import { seedUsers } from '../test/seed';

test('returns the users with that name', async () => {
  await seedUsers([{ name: 'Ada', email: 'ada@example.test' }, { name: 'Bob', email: 'bob@example.test' }]);
  const res = await request(app).get('/users').query({ name: 'Ada' });
  expect(res.body).toEqual([{ id: expect.any(Number), name: 'Ada', email: 'ada@example.test' }]);
});
`,
    },
    defects: [{ id: 'sqli', file: 'src/users/repo.ts', snippet: `"SELECT id, name, email FROM users WHERE name = '" + name`, keywords: ['inject', 'parameteri', 'concatenat', 'sanitiz', 'prepared'] }],
  },
  {
    id: 'swallowed-error',
    kind: 'defect',
    core: true,
    expect: 'Reject',
    ac: `# AC
- AC-1 capture(orderId) returns {ok: true, id} with the provider's capture id
- AC-2 When the payment provider fails, capture() throws an AppError with status 502 and code PAYMENT_PROVIDER_ERROR
`,
    contract: contract('- (library function) capture(orderId: string) -> {ok, id} | throws AppError(502, PAYMENT_PROVIDER_ERROR)'),
    files: {
      'src/payments/capture.ts': `import { provider } from './provider';

export async function capture(orderId: string) {
  try {
    const res = await provider.capture(orderId);
    return { ok: true, id: res.id };
  } catch (e) {
    console.warn('capture failed', orderId);
  }
  return { ok: true, id: null };
}
`,
      'src/payments/capture.test.ts': `import { capture } from './capture';
import { provider } from './provider';

test('returns the provider capture id', async () => {
  jest.spyOn(provider, 'capture').mockResolvedValue({ id: 'cap_42' });
  await expect(capture('ord_1')).resolves.toEqual({ ok: true, id: 'cap_42' });
});
`,
    },
    defects: [{ id: 'swallowed', file: 'src/payments/capture.ts', snippet: `return { ok: true, id: null };`, keywords: ['swallow', 'catch', '502', 'PAYMENT_PROVIDER_ERROR', 'failure is hidden', 'silent'] }],
  },
  {
    id: 'tautological-test',
    kind: 'defect',
    core: true,
    expect: 'Reject',
    ac: `# AC
- AC-1 total(items) is the sum of price * qty over all items
- AC-2 total([]) is 0
`,
    contract: contract('- (library function) total(items: {price: number, qty: number}[]) -> number'),
    files: {
      'src/cart/total.ts': `export interface Item { price: number; qty: number }

export function total(items: Item[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}
`,
      'src/cart/total.test.ts': `import { total } from './total';

test('totals the cart', () => {
  const items = [{ price: 5, qty: 2 }, { price: 3, qty: 1 }];
  expect(total(items)).toBe(items.reduce((s, i) => s + i.price * i.qty, 0));
});
`,
    },
    defects: [{ id: 'tautology', file: 'src/cart/total.test.ts', snippet: `toBe(items.reduce`, keywords: ['tautolog', 'same way', 'same formula', 'recomput', 'computed', 'by construction', 'independent', 'literal'] }],
  },
  {
    id: 'skipped-test',
    kind: 'defect',
    core: true,
    expect: 'Reject',
    ac: `# AC
- AC-1 A login with the right password returns 200 and a token
- AC-2 After 5 failed logins in 10 minutes the 6th attempt returns 429
`,
    contract: contract('- POST /login {email, password} -> 200 {token} | 401 | 429'),
    files: {
      'src/auth/login.ts': `import { limiter } from './limiter';
import { verify } from './verify';
import { sign } from './token';

export async function login(email: string, password: string) {
  if (!limiter.allow(email)) return { status: 429 };
  if (!(await verify(email, password))) { limiter.fail(email); return { status: 401 }; }
  return { status: 200, token: sign(email) };
}
`,
      'src/auth/login.test.ts': `import { login } from './login';
import { seedUser } from '../test/seed';

test('right password returns a token', async () => {
  await seedUser('ada@example.test', 'correct horse');
  const res = await login('ada@example.test', 'correct horse');
  expect(res.status).toBe(200);
  expect(res.token).toMatch(/^[\\w-]+\\.[\\w-]+\\.[\\w-]+$/);
});

it.skip('returns 429 on the 6th failed attempt', async () => {
  await seedUser('bob@example.test', 'correct horse');
  for (let i = 0; i < 5; i++) await login('bob@example.test', 'wrong');
  expect((await login('bob@example.test', 'wrong')).status).toBe(429);
});
`,
    },
    defects: [{ id: 'skipped', file: 'src/auth/login.test.ts', snippet: `it.skip(`, keywords: ['skip'] }],
  },
  {
    id: 'undeclared-cost',
    kind: 'defect',
    expect: 'Reject',
    ac: `# AC
- AC-1 POST /notes/:id/summary returns a one-sentence summary of the note body
`,
    contract: contract('- POST /notes/:id/summary -> 200 {summary}', 'Budget: none. No new recurring cost'),
    files: {
      'src/notes/summary.ts': `import OpenAI from 'openai';
import { notes } from './store';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarize(id: string) {
  const note = await notes.get(id);
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Summarize in one sentence: ' + note.body }],
  });
  return { summary: res.choices[0].message.content ?? '' };
}
`,
      'src/notes/summary.test.ts': `import { summarize } from './summary';
import { notes } from './store';

jest.mock('openai');

test('returns the model summary', async () => {
  await notes.seed({ id: 'n1', body: 'Long text about the sprint review.' });
  const out = await summarize('n1');
  expect(typeof out.summary).toBe('string');
});
`,
    },
    defects: [{ id: 'cost', file: 'src/notes/summary.ts', snippet: `new OpenAI(`, keywords: ['undeclared-cost', 'cost', 'paid', 'recurring', 'budget'] }],
  },
  {
    id: 'scope-creep',
    kind: 'defect',
    expect: 'Reject',
    ac: `# AC
- AC-1 GET /profile also returns the optional phone field (null when unset)
`,
    contract: contract('- GET /profile -> 200 {id, name, email, phone: string|null}'),
    files: {
      'src/profile/routes.ts': `import { Router } from 'express';
import { profiles } from './store';

export const router = Router();

router.get('/profile', async (req, res) => {
  const p = await profiles.get(req.user.id);
  res.status(200).json({ id: p.id, name: p.name, email: p.email, phone: p.phone ?? null });
});
`,
      'src/profile/routes.test.ts': `import request from 'supertest';
import { app } from '../app';
import { loginAs } from '../test/auth';

test('returns phone null when unset', async () => {
  const agent = await loginAs({ name: 'Ada', email: 'ada@example.test' });
  const res = await agent.get('/profile');
  expect(res.body).toEqual({ id: expect.any(Number), name: 'Ada', email: 'ada@example.test', phone: null });
});
`,
      'src/billing/format.ts': `export const formatMoney = (cents: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

export const formatRange = (a: number, b: number, currency = 'USD'): string =>
  formatMoney(a, currency) + ' - ' + formatMoney(b, currency);
`,
      'src/auth/session.ts': `const TTL_MS = 30 * 60 * 1000;

export const isExpired = (issuedAt: number, now = Date.now()): boolean => now - issuedAt > TTL_MS;

export const remaining = (issuedAt: number, now = Date.now()): number => Math.max(0, TTL_MS - (now - issuedAt));
`,
    },
    defects: [{ id: 'scope', file: 'src/billing/format.ts', snippet: `export const formatMoney =`, keywords: ['scope', 'unrelated', 'refactor', 'out of scope', 'billing', 'not part of'] }],
  },
  {
    id: 'n-plus-one',
    kind: 'defect',
    expect: 'Reject',
    ac: `# AC
- AC-1 GET /orders returns every order with its customer's name
`,
    contract: contract('- GET /orders -> 200 [{id, total, customerName}] (no pagination)'),
    files: {
      'src/orders/routes.ts': `import { Router } from 'express';
import { db } from '../db';

export const router = Router();

router.get('/orders', async (_req, res) => {
  const orders = await db.orders.all();
  const out = [];
  for (const o of orders) {
    const customer = await db.customers.byId(o.customerId);
    out.push({ id: o.id, total: o.total, customerName: customer.name });
  }
  res.status(200).json(out);
});
`,
      'src/orders/routes.test.ts': `import request from 'supertest';
import { app } from '../app';
import { seedOrders } from '../test/seed';

test('lists orders with the customer name', async () => {
  await seedOrders([{ id: 1, total: 900, customer: 'Ada' }]);
  const res = await request(app).get('/orders');
  expect(res.body).toEqual([{ id: 1, total: 900, customerName: 'Ada' }]);
});
`,
    },
    defects: [{ id: 'n1', file: 'src/orders/routes.ts', snippet: `await db.customers.byId(`, keywords: ['N+1', 'n + 1', 'per order', 'per item', 'one query per', 'batch', 'join', 'loop'] }],
  },
  {
    id: 'missing-auth',
    kind: 'defect',
    expect: 'Reject',
    ac: `# AC
- AC-1 DELETE /projects/:id deletes the project and returns 204 when the caller owns it
- AC-2 A caller who does not own the project gets 403 and nothing is deleted
`,
    contract: contract('- DELETE /projects/:id (auth required, owner only) -> 204 | 403 | 404'),
    files: {
      'src/projects/routes.ts': `import { Router } from 'express';
import { db } from '../db';

export const router = Router();

router.delete('/projects/:id', async (req, res) => {
  await db.projects.remove(req.params.id);
  res.status(204).end();
});
`,
      'src/projects/routes.test.ts': `import { loginAs } from '../test/auth';
import { seedProject } from '../test/seed';

test('owner deletes the project', async () => {
  const owner = await loginAs({ email: 'ada@example.test' });
  const id = await seedProject({ ownerEmail: 'ada@example.test' });
  const res = await owner.delete('/projects/' + id);
  expect(res.status).toBe(204);
});
`,
    },
    defects: [{ id: 'authz', file: 'src/projects/routes.ts', snippet: `router.delete('/projects/:id'`, keywords: ['auth', '403', 'owner', 'permission', 'access control'] }],
  },
  {
    id: 'clean-simple',
    kind: 'clean',
    expect: 'Approve',
    ac: `# AC
- AC-1 POST /tags {name} creates a tag and returns 201 {id, name}
- AC-2 Creating a tag whose name already exists returns 409
- AC-3 POST /tags with an empty name returns 400
`,
    contract: contract('- POST /tags {name} -> 201 {id, name} | 400 | 409'),
    files: {
      'src/tags/routes.ts': `import { Router } from 'express';
import { tags } from './store';

export const router = Router();

router.post('/tags', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ code: 'INVALID_NAME' });
  if (await tags.exists(name)) return res.status(409).json({ code: 'TAG_EXISTS' });
  const tag = await tags.create({ name });
  return res.status(201).json({ id: tag.id, name: tag.name });
});
`,
      'src/tags/routes.test.ts': `import request from 'supertest';
import { app } from '../app';
import { tags } from './store';

test('creates a tag', async () => {
  const res = await request(app).post('/tags').send({ name: 'urgent' });
  expect(res.status).toBe(201);
  expect(res.body).toEqual({ id: expect.any(Number), name: 'urgent' });
  expect(await tags.exists('urgent')).toBe(true);
});

test('rejects a duplicate name', async () => {
  await tags.create({ name: 'dup' });
  const res = await request(app).post('/tags').send({ name: 'dup' });
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('TAG_EXISTS');
});

test('rejects an empty name', async () => {
  const res = await request(app).post('/tags').send({ name: '   ' });
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('INVALID_NAME');
});
`,
    },
    defects: [],
  },
  {
    id: 'clean-decoys',
    kind: 'clean',
    core: true,
    expect: 'Approve',
    ac: `# AC
- AC-1 GET /reports/summary?kind=<kind> returns {kind, label, count} for a valid kind
- AC-2 An unknown kind returns 400
`,
    contract: contract('- GET /reports/summary?kind=<kind> -> 200 {kind, label, count} | 400'),
    files: {
      'src/reports/labels.ts': `export type Kind = 'orders' | 'refunds' | 'signups' | 'logins' | 'invites' | 'exports' | 'errors';

export const KINDS: Kind[] = ['orders', 'refunds', 'signups', 'logins', 'invites', 'exports', 'errors'];

// Internal helper: callers pass a Kind already validated by the route.
export function toLabel(kind: Kind): string {
  switch (kind) {
    case 'orders': return 'Orders';
    case 'refunds': return 'Refunds';
    case 'signups': return 'Sign-ups';
    case 'logins': return 'Logins';
    case 'invites': return 'Invites';
    case 'exports': return 'Exports';
    case 'errors': return 'Errors';
  }
}
`,
      'src/reports/routes.ts': `import { Router } from 'express';
import { KINDS, Kind, toLabel } from './labels';
import { counts } from './store';
import { audit } from '../audit';

export const router = Router();

router.get('/reports/summary', async (req, res) => {
  const kind = String(req.query.kind ?? '');
  if (!KINDS.includes(kind as Kind)) return res.status(400).json({ code: 'UNKNOWN_KIND' });
  void audit.log('report.summary', { kind });
  const count = await counts.byKind(kind as Kind);
  return res.status(200).json({ kind, label: toLabel(kind as Kind), count });
});
`,
      'src/reports/routes.test.ts': `import request from 'supertest';
import { app } from '../app';
import { counts } from './store';

const TEST_KEY = 'test-key-123';

test('returns the label and count for a valid kind', async () => {
  await counts.seed({ signups: 12 });
  const res = await request(app).get('/reports/summary').query({ kind: 'signups' }).set('x-api-key', TEST_KEY);
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ kind: 'signups', label: 'Sign-ups', count: 12 });
});

test('rejects an unknown kind', async () => {
  const res = await request(app).get('/reports/summary').query({ kind: 'nope' }).set('x-api-key', TEST_KEY);
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('UNKNOWN_KIND');
});
`,
    },
    defects: [],
  },
  {
    id: 'clean-error-paths',
    kind: 'clean',
    core: true,
    expect: 'Approve',
    ac: `# AC
- AC-1 capture(orderId) returns {ok: true, id} with the provider's capture id
- AC-2 When the payment provider fails, capture() throws an AppError with status 502 and code PAYMENT_PROVIDER_ERROR
`,
    contract: contract('- (library function) capture(orderId: string) -> {ok, id} | throws AppError(502, PAYMENT_PROVIDER_ERROR)'),
    files: {
      'src/payments/capture.ts': `import { provider } from './provider';
import { AppError } from '../errors';

export async function capture(orderId: string) {
  try {
    const res = await provider.capture(orderId);
    return { ok: true, id: res.id };
  } catch (cause) {
    throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', { cause });
  }
}
`,
      'src/payments/capture.test.ts': `import { capture } from './capture';
import { provider } from './provider';

test('returns the provider capture id', async () => {
  jest.spyOn(provider, 'capture').mockResolvedValue({ id: 'cap_42' });
  await expect(capture('ord_1')).resolves.toEqual({ ok: true, id: 'cap_42' });
});

test('maps a provider failure to 502 PAYMENT_PROVIDER_ERROR', async () => {
  jest.spyOn(provider, 'capture').mockRejectedValue(new Error('timeout'));
  await expect(capture('ord_1')).rejects.toMatchObject({ status: 502, code: 'PAYMENT_PROVIDER_ERROR' });
});
`,
    },
    defects: [],
  },
];
