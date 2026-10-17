# Presentation Essentials

What a presentation must contain before it can do its job. Check the request against this list in round 1 (workflow step 4): every **must** element needs a source; a missing one is a blocker for its owner ([doc-request.md](../../../../skills/muffy/references/doc-request.md)) or a question for the requester, never something you write from memory. ✅ = backed by a source in [presentation-audiences.md](../../../../docs/research/presentation-audiences.md) or [presentation-layouts.md](../../../../docs/research/presentation-layouts.md); ⚠️ = house practice.

## Every deck

| Element | What it answers | Usually from | Owner if missing |
|---|---|---|---|
| **The one message** | If they remember one sentence, which? (the governing thought) ✅ Minto | plan, strategy | `PM` |
| **Who it's for and what they do next** | The audience profile and the decision or action you want ✅ Knaflic, Duarte | the requester | question |
| **Their problem or situation** | Why this matters to them now, in their words, with evidence ✅ Minto SCQ, Duarte "what is" | strategy, research brief, data | `PM` / `Researcher` |
| **The answer** | What you propose, or what has changed ✅ answer first for deciders | plan, ADR, release notes | `PM` / `Architect` |
| **Proof** | Why they should believe it: data, an example, a quote, a demo of how it works ✅ Alley assertion-evidence | data files, release notes, research | `Researcher` / `Docs` |
| **What it takes** | Time, money, effort, or what they must change ⚠️ | plan, strategy | `PM` |
| **Risks and how they're handled** | The objections they'll raise, answered before they ask ⚠️ | ADR consequences, plan risks | `PM` / `Architect` |
| **The ask** | The decision or action, who does it, by when ✅ Duarte call to action | the requester | question |

## Extra must-haves by role

| Role | Also must have | Why |
|---|---|---|
| `decide` | The options considered and why this one; cost and timeframe; the deadline for the decision | Deciders need the trade-off, not the tour ✅ Duarte HBR, Minto |
| `evaluate` | The criteria; each option against them; the evidence behind each claim | Advisors check the reasoning ✅ NN/g |
| `use` | What changes for them (existing users) or what they get (new); how to start in steps; where to get help | Change aversion; tasks first ✅ NN/g, GOV.UK |
| `operate` | Rollout dates; what they must do and when; known limits; who to call | Practical, task first ✅ McMurrey |
| `informed` | The headline result or status; what happens next; where to follow | Most important first ✅ NN/g |

## Product explainer

What it is · the problem it solves · how it works (the parts and how they connect) · the workflow · safeguards · what you can use it for · one worked example · how to start. Typically one README-level overview holds all of it: missing → a blocker for `Docs` ⚠️

## Before you call the outline ready

- Every **must** element is on a slide, or listed as `TBD` with the blocker or question that would fill it
- Nothing in the deck fails the "so what?" test: each slide moves the audience toward the ask ⚠️
- The objections you listed in the brief each have an answer on a slide or in `notes` ⚠️
