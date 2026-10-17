# Workflow

## Round 1 — outline first

1. **Audience.** Take the audience profile from the prompt (see [required-inputs.md](required-inputs.md)). Any field missing or guessed → return `needs-input` with the audience questions before anything else; never infer the audience from the request's wording. The profile decides the recipe, structure, wording, length and `cta.kind`: follow "By audience" in [recipes.md](recipes.md)
2. **Brief.** At the top of `outline.md`, write the audience profile, then: goal (what the audience should think, decide or do after the deck), tone, length. If the request does not say what the audience should do, that is a question too
3. **Read sources narrowly.** Grep for the sections the goal needs (phases, milestones, decisions, metrics); don't read whole files you won't use. Note each fact you'll use with its `path#section` — that becomes its `source`
4. **Pick a starting shape.** If the request matches a recipe in [recipes.md](recipes.md), start from it; otherwise compose from [slide-types.md](slide-types.md). Cut any slide the goal doesn't need
5. **Write the outline** to `<output>/outline.md`: one line per slide — number, `type`, headline (the takeaway, not a topic label), source. Mark every gap as `TBD` with what's missing
6. **Hand off with status `needs-input`.** The Orchestrator shows the outline to the requester. Do not build the deck before the outline is confirmed — a wrong outline costs a whole deck

## Round 2 — build

7. Apply the requester's outline changes
8. **Build `<output>/deck.json`**: the slides array per [slide-types.md](slide-types.md). Comparing numbers → follow [data-compare.md](data-compare.md)
9. **Render `<output>/deck.html`** from `.claude/skills/muffy/templates/presentation.html`: copy it, edit only `<title>`, the `#theme` style and the embedded JSON. **Theme:** the project's design system decides the look, not you. If `docs/design-system/README.md` has a `## Presentation` section, set exactly the deck variables it maps. If not, map the obvious semantic tokens from `tokens.css` (primary → `--accent`, text → `--ink`, secondary text → `--muted`, background → `--paper`, surface → `--slide`, border → `--line`, font family → `--font`, radius → `--radius`), light under `:root` and dark under the template's two dark selectors, and say in the final message that the mapping was a default. Copy each value verbatim from `tokens.css`. No design system → leave `#theme` empty, or set only `--accent` to the requester's brand color
10. **Write the editable outline** `<output>/outline.md` (final text per slide + speaker notes) and, if the deck has `chart`, `comparison` or `roadmap` slides, `<output>/data.csv` with their rows
11. **Check:** `node .claude/skills/muffy/scripts/check-presentation.mjs <output>` (checks the whole folder; run it from the repo root so source paths resolve). Fix every FAIL before hand-off
12. Hand off with status `done`; the Orchestrator publishes `deck.html` as an Artifact and sends the link to the requester

## Revision rounds

13. Change only what the notes ask; keep slide numbers stable so the requester's notes still line up. Re-run the check, then hand off again with `round` + 1
