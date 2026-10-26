# Recipes

Starting slide orders. A recipe is a starting point: drop slides the goal doesn't need, add from [slide-types.md](slide-types.md) when it does. A request that matches no recipe is composed from scratch.

| Request | Slide order | Main sources |
|---|---|---|
| Roadmap for a client | `title` → `agenda` → `roadmap` → `timeline` → `bullets` (risks / dependencies) → `cta` | plan phases, ADR decisions that move dates |
| Pitch / proposal | `title` → `chart` or `metric` (what is: the problem, sourced) → `statement` (what could be) → `comparison` (options) → `roadmap` → `cta` | research brief, plan, ADR |
| Progress update | `title` → `metric` → `timeline` → `bullets` (risks, asks) → `cta` | plan, release notes |
| Decision request (A vs B) | `title` → `bullets` (context) → `comparison` → `chart` (cost or impact, if sourced, highlight the option the headline names) → `cta` (the decision) | ADR options and consequences |
| Feature intro for end-users | existing users: `title` → `bullets` (what changes for you, what stays) → `diagram` (how it works) → `steps` (what you need to do) → `cta`; new users: `title` → `bullets` (what you get) → `steps` → `cta` | release notes, plan AC in user words |
| Rollout for the team that runs it | `title` → `bullets` (what changes for your team) → `timeline` (rollout dates) → `steps` (what to do) → `bullets` (who to call, known limits) → `cta` | release notes, plan, ADR consequences |
| Results / before-after | `title` → `chart` (before vs after, highlight the after) → `metric` → `quote` → `cta` | data files, release notes |
| Product explainer (what it is, how it works, how to start) | `title` → `statement` (the problem) → `diagram` (how it works) → `features` (the parts: roles, modules) → `steps` with `groups` (the workflow) → `comparison` or `bullets` (safeguards) → `features` (what you can use it for) → `steps` (an example) → `features` (benefits) → `comparison` (with vs without) → `steps` + `cta` (how to start) | a product overview at README level: what it does, the problem, how it works, its parts, the workflow, safeguards, use cases, an example, how to start |
| Long deck (10+ slides) | any of the above, with `agenda` after `title` and a `section` before each agenda part | as above |

## By audience

The audience profile ([required-inputs.md](required-inputs.md)) picks the recipe and shapes it. ✅ = backed by a source in [presentation-audiences.md](../../../../docs/research/presentation-audiences.md); ⚠️ = house judgment.

| Profile | Recipe | Structure and wording | Length | `cta.kind` |
|---|---|---|---|---|
| role `decide` | Decision request, Pitch, Roadmap or Progress update, by the request | Answer first: the recommendation in the first slides ✅ (Duarte, Minto). Outcomes, cost and time; no technology names ✅ | Short (4-7 slides ⚠️); detail in `notes` ✅ | `decide` |
| role `evaluate` | Decision request, then `diagram` / `chart` as evidence | Facts and options with trade-offs first ✅ (NN/g). Shared terms only at familiarity `deep` ✅ | Medium (up to 12 slides) ⚠️ | `decide` (an advisory ask: "send concerns by <date>") ⚠️ |
| role `use` | Feature intro: existing users start with what changes ✅ (NN/g change aversion); new users start with what they get ⚠️ | Plain words, the task in front | Short (4-7 slides ⚠️) | `act` |
| role `operate` | Rollout for the team that runs it ⚠️ | Task first, practical ✅ (McMurrey, GOV.UK) | Medium (up to 12 slides) ⚠️ | `act` |
| role `informed` | Results / before-after, or a short Feature intro | Most important point first ✅ (NN/g inverted pyramid). One slide per topic, not per feature: merge features into one slide of outcomes ⚠️ | Short (4-7 slides ⚠️) | `act` (a light ask: where to follow progress, who to ask) ⚠️. Report, don't persuade: status as it is, no selling ⚠️ |
| familiarity `none` | — | Define every term or drop it; no internal or branded names ✅. No component, file-format, library or infrastructure words (collector, PNG, library, environment): say what the audience gets or risks instead ⚠️ | — | — |
| familiarity `deep` | — | Shared vocabulary allowed, still plain ✅ | — | — |
| `cares` | — | Lead with the slides that answer it (cost → `metric`/`chart` of cost; time → `timeline`/`roadmap`; what-changes → the change slide first) ⚠️ | — | — |
| setting `read-alone` | — | Headlines that stand alone; captions allowed on more than 1 slide in 3 ✅ (Duarte slidedocs) | — | — |

Existing vs new users is not asked: read it from the sources and state your assumption in the brief.

## Story shape

- **Open with situation → complication → answer** (Minto's SCQ): context, the problem, then the governing thought as a headline or a `statement`. The audience gets the answer early and the rest of the deck proves it
- **In a pitch, alternate what is and what could be** (Duarte): sourced current-state evidence (`chart`, `metric`, `quote`) against the future (`statement`, `roadmap`). A pitch with no "what is" sounds too good to be true. End on `cta`

Turning sources into audience language:

- Plan task → the outcome it delivers ("Password reset by email", not "BE: /reset endpoint")
- ADR decision → its consequence for the audience ("Handles 10× more users", only if the ADR states it), never the technology name unless the audience asked for it
- Phase → a timeframe the plan states; no plan date → `TBD`
