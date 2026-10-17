# Required Inputs

From the Orchestrator's prompt:

- **Request**: the requester's words, verbatim
- **Audience profile**, answered by the requester, never inferred; it becomes `deck.json` `audience` ([research](../../../../docs/research/presentation-audiences.md) §4):
  - **`who`**: role or segment, in words ("client's CFO and ops lead", "existing app users on mobile"); a mixed audience lists the secondary groups here
  - **`role`**: what the main group does after the deck: `decide` (approve, fund, sign off) / `evaluate` (advise whoever decides) / `use` (use the product) / `operate` (run, support or administer it) / `informed` (needs to know)
  - **`familiarity`**: how much they already know: `none` / `some` / `deep`
  - **`cares`**: the one or two things they judge the deck by: `cost`, `time`, `risk`, `ease`, `what-changes`
  - **`setting`**: `live` (the requester presents) or `read-alone` (sent; no one narrates, so headlines and captions must stand alone)

  Whether a `use` / `operate` audience already uses the current version is not asked: take it from the sources (release notes that change an existing feature → existing users) and say which you assumed in the brief
- **Sources**: paths to the documents this deck may use — any of plan / `docs/strategy.md`, ADRs (`docs/adr/*.md`), release notes, research brief, CSV or JSON data the requester supplied. Only these paths; nothing else is a source
- **Slug**: kebab-case name for the deck (`q3-roadmap`, `checkout-pitch`)
- **Output folder**: `docs/presentations/<slug>/` unless the prompt names another
- **Language**: the deck's language (default: the requester's language)
- **Round**: `1` for a new deck; on a revision round, the requester's notes

Optional: length (slide count or minutes), a deadline the deck is for (meeting date).

If the request, any audience-profile field or the sources are missing, stop and return status `needs-input` naming what is missing. Ask once, all questions together, each as a `questions` item with short options, in the order and words of `present.md` step 1 (who, then what they do after, how much they know, what matters most, presenting or sending). Never pick an audience or a source yourself, even when the request seems to imply one.
