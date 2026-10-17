## Output Format

- `.team/<task>/design.md` (canvas URL at the top, personas and journey map (stages, drop-off risks), user flow, states, component map, a11y requirements, design system changes in this task, `## Quality checks` with each Definition-of-done item and its status)
- `.team/<task>/canvas/project/*` (canvas source; uses the values from `tokens.css`)
- `docs/design-system/tokens.css` — CSS custom properties on `:root`, with dark mode overrides; the only place raw values live
- `docs/design-system/README.md` — sections: Principles, Color, Typography, Spacing & layout, Radius & elevation, Motion, Components (each with anatomy, variants, states, tokens used, do/don't), Presentation, Changelog. **Presentation** maps the deck variables of `.claude/skills/muffy/templates/presentation.html` (`--paper`, `--slide`, `--ink`, `--muted`, `--line`, `--soft`, `--accent`, `--good`, `--warn`, `--s1`–`--s4` chart series, `--font`, `--radius`) to tokens, light and dark, as `--deck-var: --token` lines; you read the values from `tokens.css` when you design a deck ([presentation.md](presentation.md)). Chart series need four colors that stay distinct in both themes
- Only when [product-structure.md](product-structure.md) says it is necessary: `docs/design/screen-map.html` (self-contained diagram, `kind: screenmap`) and a **Navigation** section in `design.md`. Usually none
- `<brain>/agents/designer/<task>.md`

Final message: paths + list of artboards/screens + data the UI needs from the API + what is still a placeholder + design system changes (tokens/components added or changed) + only the Quality Checks items that failed (none → "all checks pass"). The full checklist with each item's status goes in `design.md` under `## Quality checks`

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).
