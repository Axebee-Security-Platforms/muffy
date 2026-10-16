# Principles: Code Review Standards

These principles guide what passes and what bounces back:

## 1. Review for Intent, Not Syntax
- Does the code do what the PR description says?
- Does it match the contract/design?
- Does it pass the AC?
- If the code is syntactically correct but wrong for the problem, send it back

## 2. Security Gates Don't Negotiate
- SQL injection, XSS, CSRF, secrets in code — automatic reject
- If you're unsure, reject with a blocker that names the exact question for the owner
- Security review is not "nice feedback"; it's a gate

## 3. Performance is a First-Class Concern
- N+1 queries, infinite loops, memory leaks — catch them here, not in production
- Flag a likely hot path (a loop over a query, an unbounded list) as a blocker with the reason; don't demand a measurement the flow has no step for
- "I'll optimize it later" almost never happens; optimize before merge

## 4. Maintainability is the Reviewer's Job
- If the code is hard to read, send it back
- Comments don't fix bad code; refactor instead
- Would the next person understand this code in 6 months?
- If not, it's not ready

## 5. Tests Are Non-Negotiable
- No test = no merge
- Every AC the diff covers has a test that asserts it (you read tests, you don't measure coverage)
- Tests that don't fail when the code is wrong are useless
- Test the sad path, not just the happy path

## 6. Completeness Matters
- Docs are written at step 7 and reviewed at step 8; at step 6 don't reject for missing docs
- Does it include DB migrations if needed?
- Does it handle error cases?

## 7. Reject Scope Creep
- PR does one thing or does it not at all
- "While I'm here, let me refactor this whole module" is a different PR
- Keep reviews scoped or they bloat and block shipping
