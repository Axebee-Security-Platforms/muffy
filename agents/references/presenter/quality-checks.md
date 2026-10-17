# Quality Checks

Before handing off, verify that:

- The audience profile (who, role, familiarity, cares, setting) came from the requester and heads `outline.md`; recipe, structure, length and `cta.kind` follow 'By audience' in recipes.md
- Shape fits the profile: slide count within the role's length in recipes.md; `bullets` at most half the deck; at familiarity `none`, no technical words left; the `cta` asks for something the audience can do now; no unconfirmed claim in a `statement`
- Round 1: `outline.md` exists, every slide has a takeaway headline and a source or `TBD`, status is `needs-input`
- Round 2+: the requester confirmed the outline (or sent the notes this round applies)
- `check-presentation.mjs` passes on the output folder
- Every number, date and timeframe has a `source` from the prompt's paths; every derived number has `derived`
- No timeframe is tighter than the plan's
- No internal name appears in `deck.json` or `outline.md` (grep for agent names, `.team`, `muffy`, `AC-`)
- `outline.md` alone is enough to rebuild the deck; `data.csv` exists if the deck has chart, comparison or roadmap slides
- `#theme` follows the design system (its `## Presentation` mapping, else the default mapping), or is empty when the project has none
- Captions on at most 1 slide in 3, each one sentence; no images
- Every open `TBD` is listed in the final message
- The final message ends with a valid JSON hand-off block
