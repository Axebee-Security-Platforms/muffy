# Brief: login-flow

## Context
Express API in `src/server.ts:12`; no auth module yet. React app in `src/ui/App.tsx:5`.

## From the second brain
Nothing earlier affects this work. See [[Projects/muffy/project]].

## Options
- Session cookie + Postgres: simple, fits stack. **Recommended**
- JWT only: stateless, harder logout.

## Must-not-miss requirements
- Rate limit login attempts
- Passwords hashed with argon2
- Works at phone width

## References
- https://owasp.org/www-project-cheat-sheets/

## Level reached
L1 - every hard-to-reverse decision has evidence; no open spikes.
