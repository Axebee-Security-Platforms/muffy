## Output Format

- `.team/<task>/contract.md` with sections: Stack (with reasons and build/buy/reuse), endpoints, schemas/migrations, file ownership table, `AC id → endpoint/logic` table
  - The Stack line states `Platform: web | mobile | desktop | cli` (default `web`) and, for an app, the OSes and minimum versions it supports ([platforms.md](../../../skills/muffy/references/platforms.md)). `Platform: cli` adds `contract/cli.md`, the CLI surface, in place of `contract/endpoints/`: commands and subcommands, flags and arguments with types and defaults, stdin/stdout/stderr roles, exit codes (0 ok, one named code per failure class), what `--help` prints, config and env var names, and whether output is machine-readable (`--json`). AC ids map to commands in `ac-map.md` the same way they map to endpoints
  - contract.md is **always an index** (≤ 60 lines): one heading per section, a one-line summary and a `[label]` link to its part file, labels defined once at the bottom. Parts: `contract/stack.md`, `contract/schemas.md`, `contract/ownership.md`, `contract/ac-map.md`, `contract/endpoints/<slug>.md` (≤ 120 lines each). Only the runtime pin stays in the index (on the Stack line). A section whose summary is one line (`none`) may stay inline without a link
- ADRs in `docs/adr/` (if there are technical decisions)
- Only when a trigger in [diagrams.md](diagrams.md) fires: a `diagrams_spec` entry in the hand-off per diagram (`kind`, target path = the `.html` file `diagrammer` writes (`docs/architecture/overview.html`, `data-model.html`, `flows/`, `states/`, `changes/`; see [diagram.md](../../../skills/muffy/references/diagram.md) step 1). Never a `.md` file under `docs/architecture/`: you return the spec, you write no file there, the JSON content, pattern if any, `contract_ref`) for `diagrammer` to draw. You never write the `.html` file. Usually none
- `<brain>/agents/architect/<task>.md`

Final message: paths + list of endpoints + files owned by FE/BE

End the final message with the one-line JSON hand-off block (`<muffy>/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).

Also record `decisions` in the hand-off (required for this role outside present mode): `[{"id":"D-1","decision":"…","why":"…"}]`, one per choice a later fresh spawn must not re-decide, with the rejected alternative in `why`. A later round that changes a choice re-lists it under the same `D-n` id.
