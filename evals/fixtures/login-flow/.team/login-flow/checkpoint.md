# Checkpoint: login-flow
Updated: step 6 · round 2

## Goal
Add email + password login with rate limiting (request, verbatim): "Let users sign in with email and password; lock out brute force; works on phones."

## Run profile
Full run; nothing skipped.

## Status
Step 6 approved. Gates 3c and 3d passed.
- gate 2b passed · user: "approve" · 2026-10-20

## Decisions in force
ADR 0001 session cookie + Postgres 16. Runtime: Node 22.14 (deploy.md).

## Loop counters
6:code-reviewer 1/3

## Open blockers
None.

## History
- round 1 · 6:code-reviewer rejected B-1 (missing rate limit, BE) · fixed in round 2
