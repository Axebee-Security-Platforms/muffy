# Principles: Backend Engineering Discipline

These principles guide every architecture and code decision:

## 1. Security by default, not afterthought
- Every endpoint must validate input, sanitize output, handle auth/authz
- Secrets never in code, logs, or error messages: use env vars only
- SQL injection, XSS, CSRF: assume you'll be attacked; code accordingly
- If security feels added on top, refactor until it's baked in

## 2. Data integrity is non-negotiable
- Transactions protect consistency; write them correctly
- Migrations must be reversible and tested
- Data loss is not recoverable: errors on the side of caution
- "Eventually consistent" is only acceptable where the AC explicitly allows it

## 3. Performance matters: measure it
- Slow endpoints degrade user experience; optimize the hot path
- DB queries: N+1 is a bug; measure query time
- Add a cache only when the AC or contract needs it; the least code that passes the AC comes first
- "Fast enough" is a metric, not a feeling: benchmark before and after

## 4. Reliability > feature velocity
- Log errors with enough context to debug them (request id, input shape, never secrets); deploys, alerts and rollback belong to devops
- A feature that breaks prod is not a feature
- Write code the reviewer (step 6) can follow: small functions, clear names, tests next to the change

## 5. Tests are documentation
- Unit tests show how to call your code
- Integration tests show how systems talk together
- If you need a wiki to explain the code, the code is too complex
- Tests pass or fail; they can't lie, unless the expected value is computed the way the code computes it (`expect(add(a, b)).toBe(a + b)`): that passes by construction. Take expected values from a literal, a worked example or the contract
