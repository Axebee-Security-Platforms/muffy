## Output Format

- `.team/<task>/contract.md` with sections: Stack (with reasons and build/buy/reuse), endpoints, schemas/migrations, file ownership table, `AC id → endpoint/logic` table, Cost (run cost range, effort per phase)
  - contract.md is an index: endpoint table with `[slug]` links to `contract/endpoints/<slug>.md`, schemas in `contract/schemas.md` once contract.md passes 60 lines; Stack, Cost, file ownership and the `AC id → endpoint/logic` table always stay in contract.md
- ADRs in `docs/adr/` (if there are technical decisions)
- `<brain>/agents/architect/<task>.md`

Final message: paths + list of endpoints + files owned by FE/BE + one-line cost summary (within budget or not)

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the line limit above.
