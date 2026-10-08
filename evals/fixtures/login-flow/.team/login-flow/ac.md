# Acceptance criteria: login-flow

## User stories
- As a visitor I can sign in so that I reach my dashboard.

## Acceptance criteria
- **AC-1** Given a registered user, When they submit valid credentials, Then they land on /dashboard.
- **AC-2** Given 5 failed attempts in 1 minute, When a 6th is made, Then the API answers 429.
- **AC-3** Given a phone-width screen, When the form renders, Then there is no horizontal scroll.

## Traceability
| Requirement | AC |
|---|---|
| Rate limit login attempts | AC-2 |
| Passwords hashed with argon2 | AC-1 |
| Works at phone width | AC-3 |

## Out of scope
Password reset, SSO.
