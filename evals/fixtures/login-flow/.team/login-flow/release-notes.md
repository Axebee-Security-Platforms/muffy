# Release notes: login-flow

## Changes
Added email + password login.

## Breaking changes
None.

## Migrations
0003 adds sessions table.

## Rollback
Run migration 0003 down; redeploy previous image.

## Announcement
**Sign in with your email and password.** Visitors can now log in and reach their dashboard.
- Registered users land on /dashboard after signing in
- Repeated failed attempts are rate limited
- The form works at phone width

Login is live: sign in with your email and password, on desktop or phone.
