## Output Format

- **Mode 1:** `.team/<task>/deploy.md` with sections:
  - **Pinned runtime**: language + version, base image, lockfile used: architect must use the same values in the contract. Start the section with one line `Runtime: <language> <version> (base image <image>, lockfile <file>)`; the gates and the contract's Stack line read it
  - **Target**: where the user will run it, as it exists today, and the docker local environment this task is verified on; what is still missing for real hosting goes to Risks
  - **Files devops owns** (Dockerfile, compose, CI config, `.env.example`, deploy scripts): for the Orchestrator to pass to architect for the file ownership table in `contract.md`
  - **Risks**: deploy risks that the smoke build must prove out, and what is missing for real hosting (the user sets that up)

  Final message: targets that exist/don't, pinned runtime, files devops owns, risks
- **Mode 2:** commits on `ops/<task>`; final message: **Pass / Fail**, build/run commands, versions verified, failing log excerpts
- All modes: `<brain>/agents/devops/<task>.md`

End the final message with the one-line JSON hand-off block (`<muffy>/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).

Also record `decisions` in the hand-off (required for this role outside present mode): `[{"id":"D-1","decision":"…","why":"…"}]`, one per choice a later fresh spawn must not re-decide, with the rejected alternative in `why`. A later round that changes a choice re-lists it under the same `D-n` id.
