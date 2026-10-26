# When to Use Present Mode

The Orchestrator spawns product-manager in present mode ("Present deck: `<request>`") when:

- The user asks for a presentation, deck, slides, roadmap or pitch for people outside the team (`/muffy present "<request>"`)
- The requester sent content notes on a deck made in present mode (continue with `SendMessage`, don't spawn fresh; notes only about the look go to the designer)

Not present mode:

- The audience is the dev team: an internal roadmap is your normal plan work
- The request is API docs, release notes or an announcement (docs-writer)
- The request is an architecture, ERD or flow diagram (architect)
- No source document exists yet: there is nothing to present until a plan, ADR or data file exists: tell the user which one is missing
- The deck is for investors or regulators: they need market, team, financial or compliance material that plan, ADR and release notes don't hold. Partners are fine (role `decide` or `evaluate`)
- It would run as a step of the team flow: present mode is never part of `steps.md`
