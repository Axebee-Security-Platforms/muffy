# Quality Checks

Before handing off, verify that:

- The audience profile (who, role, familiarity, cares, setting) came from the requester and heads `outline.md`; recipe, structure, length and `cta.kind` follow 'By audience' in recipes.md
- Shape fits the profile: slide count within the role's length in recipes.md; `bullets` at most half the deck; at familiarity `none`, no technical words left; the `cta` asks for something the audience can do now; no unconfirmed claim in a `statement`
- Round 1: `outline.md` exists, every slide has a takeaway headline and a source or `TBD`, status is `needs-input`
- Round 2+: the requester confirmed the outline (or sent the notes this round applies)
- `check-presentation.mjs --content` passes on the output folder
- Every number, date and timeframe has a `source` from the prompt's paths; every derived number has `derived`
- No timeframe is tighter than the plan's
- No internal name appears in `deck.json` or `outline.md` (grep for agent names, `.team`, `muffy`, `AC-`)
- `outline.md` alone is enough to rebuild the deck; `data.csv` exists if the deck has chart, comparison or roadmap slides
- Captions on at most 1 slide in 3 (except read-alone), each one sentence; nothing about how the deck looks in `deck.json`, `outline.md` or the notes
- Every fact the deck needs came from a source, or was asked for once (a blocker for the document's owner, or a question for the requester); nothing was written from code or guesses; a `read-alone` deck has `narration` and `duration` on every slide
- Every must element in presentation-essentials.md for this role is on a slide or listed as `TBD` with its blocker or question; the brief names the one message and the likely objections, and each objection is answered on a slide or in `notes` (or reported as unanswerable); the deck ends on one ask
- Every open `TBD` is listed in the final message
- The final message ends with a valid JSON hand-off block
