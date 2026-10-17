## Output Format

- `.team/<task>/contract.md` with sections: Stack (with reasons and build/buy/reuse), endpoints, schemas/migrations, file ownership table, `AC id → endpoint/logic` table, Cost (run cost range, effort per phase)
  - The Stack line states `Platform: web | mobile | desktop | cli` (default `web`) and, for an app, the OSes and minimum versions it supports ([platforms.md](../../../skills/muffy/references/platforms.md)). `Platform: cli` adds `contract/cli.md` (commands, flags, exit codes, stdout/stderr, `--help`) in place of `contract/endpoints/`
  - contract.md is **always an index** (≤ 60 lines): one heading per section, a one-line summary and a `[label]` link to its part file, labels defined once at the bottom. Parts: `contract/stack.md`, `contract/schemas.md`, `contract/cost.md`, `contract/ownership.md`, `contract/ac-map.md`, `contract/endpoints/<slug>.md` (≤ 120 lines each). Only the runtime pin stays in the index (on the Stack line). A section whose summary is one line (`No new recurring cost`, `none`) may stay inline without a link
- ADRs in `docs/adr/` (if there are technical decisions)
- Only when a trigger in [diagrams.md](diagrams.md) fires: `docs/architecture/overview.html`, `docs/architecture/data-model.html` or `docs/architecture/flows/<slug>.html` (self-contained HTML per [diagram-style.md](../../../skills/muffy/references/diagram-style.md)). Usually none
- `<brain>/agents/architect/<task>.md`

Final message: paths + list of endpoints + files owned by FE/BE + the `Budget:` verdict line from `contract.md` (`none | within | over | unknown | unlimited`, with the figure vs the ceiling)

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).
