## Output Format

- **Mode 1:** `.team/<task>/deploy.md` with sections:
  - **Pinned runtime**: language + version, base image, lockfile used — architect must use the same values in the contract. Start the section with one line `Runtime: <language> <version> (base image <image>, lockfile <file>)`; the gates and the contract's Stack line read it
  - **Target**: existing staging/production, or if none → the minimal near-production environment to create (e.g. container + compose on the local machine) and what is still missing for real production
  - **Files devops owns** (Dockerfile, compose, CI config, `.env.example`, deploy scripts) — for the Orchestrator to pass to architect for the file ownership table in `contract.md`
  - **Infra options** (when nothing already decides it): 2 or 3 options per [infrastructure-options.md](infrastructure-options.md), including on-premises or hybrid when a constraint makes it plausible, each with cost, lock-in, operational load, recovery and data location, and a default
  - **Chosen infra**: the existing infrastructure being reused (`infra: existing`), the option the user picked in `requirements.md` (`infra: propose`), `none yet: local near-production only` (`infra: later`) or `no hosting` (`infra: not-needed`). Only `propose` has `## Infra options`
  - **Practices**: each practice that applies from [infrastructure-best-practices.md](infrastructure-best-practices.md) as `met`, `planned (<where>)` or `gap (<risk>)`
  - **Risks**: deploy risks that the smoke build must prove out, and every `gap` above

  Final message: targets that exist/don't, the infrastructure chosen or the question asked, pinned runtime, files devops owns, practice gaps, risks
- **Mode 2:** commits on `ops/<task>`; final message: **Pass / Fail**, build/run commands, versions verified, failing log excerpts
- **Mode 3:** final message: environment, version/commit, health check results, whether rolled back, links to logs/dashboard
- All modes: `<brain>/agents/devops/<task>.md`

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).

Also record `decisions` in the hand-off (required for this role outside present mode): `[{"id":"D-1","decision":"…","why":"…"}]`, one per choice a later fresh spawn must not re-decide, with the rejected alternative in `why`. A later round that changes a choice re-lists it under the same `D-n` id.
