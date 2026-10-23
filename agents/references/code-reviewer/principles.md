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
- Tests that don't fail when the code is wrong are useless: a test that asserts a mock was called, or private internals, instead of the observable result is a blocker
- Tests go through the public interface (endpoint, exported function, what the user sees); a test that must change for a refactor that keeps behaviour is coupled to the implementation, so flag it
- A test whose expected value is computed the way the code computes it (`expect(add(a, b)).toBe(a + b)`) passes by construction and is a blocker; expected values come from a literal, a worked example or the spec
- A test that is skipped, filtered out, disabled or never run counts as missing; a test the change made stale or moot is a finding even if it still passes
- Test the sad path, not just the happy path

## 6. Completeness Matters
- Docs are written at step 7 and reviewed at step 8; at step 6 don't reject for missing docs
- Does it include DB migrations if needed?
- Does it handle error cases?

## 7. A Blocker Must Be Provable
- A wrong blocker costs a loop: the 4th rejection at one point stops the flow, so a blocker you cannot prove is worse than a missed suggestion
- Before writing a Blocker, answer yes to all of: can I cite the exact `file:line`? can I name the input, state and bad outcome? did I read the callers, imports and tests around it? is the severity defensible? Any "no" or "unsure" → make it a Suggestion or drop it. Exception: when the only "no" is evidence you cannot read (code outside the diff, runtime behaviour) and the problem would be a blocker if it holds, file it under `Needs validation` with the one question the owner can answer. It is not a Blocker, so it never makes a Reject; do not use it for a weak severity or a style point
- A Blocker on behaviour, security or performance carries three things: the snippet, the failure scenario (input → state → outcome), and why an existing guard (type, validation, framework default, caller) does not catch it. Missing one → demote to a Suggestion
- An AC with no code (`AC id` missing) or a failing contract check needs no scenario: the missing `file:line` is the proof
- Zero findings is a valid review: if the diff meets the AC and contract, return `Approve` with no Suggestions rather than inventing some
- Do not flag, without evidence specific to this codebase: error handling the caller or framework already provides; missing validation on an internal function whose callers validate; well-known constants (HTTP codes, 0, -1, 1000); a long `switch`, config object or test table; a deliberately detached call (logging, metrics); hardcoded values in tests or examples. Trace one caller before flagging

## 8. Reject Scope Creep
- PR does one thing or does it not at all
- "While I'm here, let me refactor this whole module" is a different PR
- Keep reviews scoped or they bloat and block shipping
