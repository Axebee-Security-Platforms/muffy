# Deploy: login-flow

## Pinned runtime
Runtime: Node 22.14 (base image node:22.14-alpine, lockfile package-lock.json)

## Target
No staging exists. Create near-production env with docker compose on the local machine; production still missing: managed Postgres.

## Chosen infra
None yet: local near-production only (`infra: later`).

## Practices
- Everything as code: met (docker-compose.yml)
- Backups with a tested restore: gap (no restore drill for Postgres yet)

## Files devops owns
Dockerfile, docker-compose.yml, .env.example

## Risks
Argon2 native build on alpine - smoke build must prove it.
Gap: no restore drill for Postgres yet.
