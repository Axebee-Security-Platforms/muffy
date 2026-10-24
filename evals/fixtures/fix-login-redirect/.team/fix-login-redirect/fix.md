# Fix: fix-login-redirect
Kind: bug    Owner: BE
## Goal
"Login redirects to the old page after password reset."
## Symptom
After a password reset, signing in sends the user to the page they opened before the reset, not to /home. Expected: /home.
## Cause
`redirectAfterLogin` reads `returnTo` from the session, which the reset flow never clears. Confidence: high. Severity: high. Owner: BE.
## Repro
`test/auth/redirect.test.ts` ("clears returnTo after password reset") fails on main.
## Evidence
Repro red every run. Second user with no `returnTo` redirects to /home, so the stale value is the cause. Dropped: a cache of the /home route (cleared, still fails). Started with commit 3f2a1c7 (`git log -p src/auth/reset.ts`).
## AC
| id | result | check |
|---|---|---|
| AC-1 | After a password reset, login redirects to /home | regression test `test/auth/redirect.test.ts` |
## Out of scope
Changing how `returnTo` works for normal logins.
