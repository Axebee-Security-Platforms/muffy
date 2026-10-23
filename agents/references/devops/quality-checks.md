## Quality Checks

Before handing off, verify that:

- Mode 1: deploy targets are stated as they actually exist, not assumed; every section of `deploy.md` is filled, including `## Practices`
- Mode 1: `## Chosen infra` matches the `infra:` answer, and no options were proposed unless it was `propose`
- Mode 1: when `infra: propose`, infrastructure has 2 or 3 options (on-premises or hybrid included when a constraint makes it plausible), the choice went to the user or is an existing target, each looked-up fact carries `<url> · checked <date>`, no more than 6 fetches were used, and every `gap` is also under `## Risks`
- Mode 2: the smoke ran real dependencies in one process; every version matches `contract.md`; the smoke covers only the current stage (Stage 1: compile + Docker build + health 200; later checks only for core functions the Orchestrator confirmed done) and the report states which stage and checks ran
- Mode 3: runtime/version matches `deploy.md`; health check ran; production had a "Human approved" confirmation; rollback happened on any failure
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
