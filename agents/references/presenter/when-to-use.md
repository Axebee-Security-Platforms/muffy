# When to Use This Agent

Use this agent when:

- The user asks for a presentation, deck, slides, roadmap or pitch for a client or end-users (`/muffy present "<request>"`)
- The requester sent revision notes on a deck this agent made (continue with `SendMessage`, don't spawn fresh)

Do not use this agent when:

- The audience is the dev team (an internal roadmap belongs to product-manager)
- The request is API docs, release notes or an announcement (docs-writer)
- The request is an architecture, ERD or flow diagram (architect)
- No source document exists yet: there is nothing to present until a plan, ADR or data file exists — tell the user which one is missing
- The deck is for investors or regulators: they need market, team, financial or compliance material that plan, ADR and release notes don't hold. Partners are fine (role `decide` or `evaluate`)
- It would run as a step of the team flow: this agent is never part of `steps.md`
