# Tech Storytelling

How a solutions engineer explains technical work to people who decide, use or run it: business-first, tech-grounded. You explain the system the architect designed and the plan you wrote; you never redesign, size or price anything yourself. Every technical fact comes from a confirmed source; when the source is silent, the answer is `TBD` and a question for the requester or a blocker for the architect or devops ([doc-request.md](../../../skills/muffy/references/doc-request.md)).

## 1. Understand the system before you explain it

- Read the architecture overview (`docs/architecture/overview.html`), the flow diagrams and the ADRs the deck touches before writing a "how it works" slide. Follow the data: where it comes from, what handles it, where it is kept, what the user sees back
- Turn that into the audience's picture: a `diagram` of three to seven boxes in their words ("Your order system → our service → your dashboard"), not components ("API gateway", "Postgres")
- No diagram and no ADR covers the part you need → a blocker for `Architect`. Don't draw the architecture from code or guesses

## 2. How it works → why it matters

Every technical point is two halves, and the second half is the one on the slide:

| How it works (from the ADR or diagram) | Why it matters (from a source, in their terms) |
|---|---|
| "Results are cached" | "Pages open faster", and the number only if a source measured it |
| "Each customer's data is kept apart" | "Another customer can never see your data" |
| "We use a payment provider instead of building one" | "Live sooner, and card security is the provider's job" |

- The headline carries *why it matters*; *how it works* goes in the body, a `footnote` or `notes`, at the depth the audience's familiarity allows (`none`: one plain sentence or nothing; `deep`: the real term is fine)
- A percentage, speed-up or business effect ("conversion up 15%") appears only if a source states it. Without one, say it qualitatively ("faster") or mark `TBD`. Never chain an assumed tech gain into an assumed business gain

## 3. Trade-offs and options

- Show the options the ADR considered, what each costs and risks, and why the chosen one won: a `comparison` slide with the recommended option marked. The audience trusts a choice more when it sees what was given up
- Build vs buy: take it from the ADR and the `## Build vs buy log` in `docs/strategy.md`. You report the decision; the architect made it
- Quick wins vs later work: from the plan's phases and priorities (P0/P1/P2). Technical debt only where an ADR or the plan names it, in plain words ("a faster start now, a cleanup planned in phase 3")
- Capacity figures (infrastructure sizing) come from devops' deploy plan. Never estimate one; if the deck needs it and no source has it, it is a blocker for `Architect` or `Devops`. Cost figures come only from the requester or a document they supply

## 4. The technical questions executives ask

Prepare each that fits the audience as an objection: answered on a slide or in `notes`, from the source named here, or reported as open in the final message.

| They ask | Answer from |
|---|---|
| "What happens if it goes down? Do we lose data?" | ADR on hosting and data; deploy plan (rollback, backups), if confirmed as a source |
| "How many users can it handle?" | ADR or contract non-functional requirements; a load test in the QA report, if one exists and is confirmed |
| "Is it secure? Who can see our data?" | ADRs on authentication, access and data separation |
| "When will it be ready, and what does it cost?" | the plan's phases; a cost figure only if the requester supplied it |
| "Can it connect to our systems?" | ADRs on integrations; the architecture overview |
| "Are we locked in to a vendor?" | the build-vs-buy log and the ADR that chose the provider |
| "What if we need to change it later?" | the ADR's consequences section; later phases in the plan |

- Answer short, confident and inside business value: one sentence of answer, one of evidence, back to what it means for them
- Never answer beyond the source to sound sure. "We'll confirm that by <date>" with the question in the final message beats a guess the customer remembers
