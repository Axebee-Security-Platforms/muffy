# Contract: login-flow

## Stack
Runtime: Node 22.14 (matches deploy.md). Postgres 16. Reason: existing codebase.

## Endpoints
### POST /login
- Request: `{ "email": string, "password": string }`
- 200: `{ "ok": true }`; 401 `invalid_credentials`; 429 `rate_limited`

## Schemas / migrations
`sessions(id, user_id, expires_at)` - reversible migration 0003.

## File ownership
| File | Owner |
|---|---|
| src/auth/** | BE |
| src/ui/Login.tsx | FE |
| Dockerfile | devops |

## AC id -> endpoint/logic
| AC id | Endpoint / logic |
|---|---|
| AC-1 | POST /login 200 |
| AC-2 | POST /login 429, 5/min limiter |
| AC-3 | n/a (UI only) |
