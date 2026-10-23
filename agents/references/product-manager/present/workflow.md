# Workflow

## Round 1 — outline first

1. **Audience.** Take the audience profile from the prompt (see [required-inputs.md](required-inputs.md)). Any field missing or guessed → return `needs-input` with the audience questions before anything else; never infer the audience from the request's wording. The profile decides the recipe, structure, wording, length and `cta.kind`: follow "By audience" in [recipes.md](recipes.md)
2. **Brief.** At the top of `outline.md`, write the audience profile, then: goal (what the audience should think, decide or do after the deck), the one message, the two or three objections this audience will raise, tone, length. If the request does not say what the audience should do, that is a question too
3. **Read sources narrowly.** Grep for the sections the goal needs (phases, milestones, decisions, metrics); don't read whole files you won't use. When the deck explains how something works or weighs options, read the architecture diagrams and ADRs it touches first ([tech-storytelling.md](tech-storytelling.md)). Note each fact you'll use with its `path#section` — that becomes its `source`
4. **Find missing documents.** Go through [presentation-essentials.md](presentation-essentials.md) for this audience: every must element needs a source. **A gap in a document you own** (`docs/strategy.md`, the plan: the problem, value, goals, scope, phases) is a blocker with owner `PM` like any other: the requester approves it in the same question round, and then the Orchestrator sends you back to write it yourself, in this context, with no extra spawn. Write it from what the repo already holds and by your normal rules (figures exactly as given, never estimated); a fact you can't trace becomes a question for the requester. **A gap in a document someone else owns** (how it works, how to use it, evidence, the design system) is a blocker for that owner, below. A fact only the requester knows (a date, a price, a name) is a question, not a blocker. Any blockers → mark the waiting slides `waiting: B-n` in `outline.md` and hand off with status `blocked`, per [doc-request.md](../../../../skills/muffy/references/doc-request.md). Resume when the Orchestrator sends "docs updated" or "skipped"
5. **Pick a starting shape.** If the request matches a recipe in [recipes.md](recipes.md), start from it; otherwise compose from [slide-types.md](slide-types.md). Cut any slide the goal doesn't need
6. **Write the outline** to `<output>/outline.md`: one line per slide — number, `type`, headline (the takeaway, not a topic label), source. Mark every gap as `TBD` with what's missing
7. **Hand off with status `needs-input`.** The Orchestrator shows the outline to the requester. Do not build the deck before the outline is confirmed — a wrong outline costs a whole deck

## Round 2 — build

8. Apply the requester's outline changes
9. **Build `<output>/deck.json`**: the slides array per [slide-types.md](slide-types.md). Comparing numbers → follow [data-compare.md](data-compare.md)
10. **Content only.** The designer builds the deck from `deck.json`; you mark the content cues ([slide-types.md](slide-types.md) "Content cues") and nothing about how it looks
11. **Write the editable outline** `<output>/outline.md` (final text per slide + speaker notes) and, if the deck has `chart`, `comparison` or `roadmap` slides, `<output>/data.csv` with their rows
12. **Check:** `node .claude/skills/muffy/scripts/check-presentation.mjs --content <output>` (deck.json and outline; run it from the repo root so source paths resolve). Fix every FAIL before hand-off
13. Hand off with status `done`; the Orchestrator sends the folder to the designer, then publishes the designed `deck.html` for the requester

## Revision rounds

14. Change only what the notes ask; keep slide numbers stable so the requester's notes still line up. Re-run the check, then hand off again with `round` + 1. Notes about the look only (layout, colors, motion) are the designer's; the Orchestrator sends those there, not to you
