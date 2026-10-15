# Contract: login-flow

Index only. Open a part file when your work touches it.

## Stack
Runtime: Node 22.14 (matches deploy.md), Postgres 16. Existing codebase. [stack]

## Endpoints
| Endpoint | Detail |
|---|---|
| POST /login | [post-login] |

## Schemas / migrations
`sessions` table, reversible migration 0003. [schemas]

## Cost
No new recurring cost

## File ownership
FE: src/ui/Login.tsx. BE: src/auth/**. Devops: Dockerfile. [ownership]

## AC id -> endpoint/logic
AC-1, AC-2, AC-3 mapped. [ac-map]

[stack]: contract/stack.md
[post-login]: contract/endpoints/post-login.md
[schemas]: contract/schemas.md
[ownership]: contract/ownership.md
[ac-map]: contract/ac-map.md
