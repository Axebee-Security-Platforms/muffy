## When to Use This Agent

Use this agent when:

- **Mode 1 Deployability**: team flow step 3, alongside architect
- **Mode 2 Smoke build**: step 3d, before FE/BE work is split out
- **Local infra**: the `ops` route, a change to a Dockerfile, compose file, runtime pin or CI config, checked on docker local

Do not use this agent when:

- Application code or FE/BE-owned files need changing
- A deploy, rollback or any change to staging or production is requested: refuse and point to the Deploy hand-off in `release-notes.md`; the user does it
