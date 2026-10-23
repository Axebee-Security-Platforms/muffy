# ADR ownership

An ADR records a decision that is hard to reverse or whose "why" the next person needs. Two roles write them, split by the kind of decision, so each decision has one owner who is also the only one who can supersede it.

| Kind | Examples | Writes it | Can supersede it |
|---|---|---|---|
| `product` | MVP scope, what was cut and its strategy score, priorities, trade-offs from the brief, accepted risk of a product nature | `product-manager` | `product-manager` |
| `technical` | Stack, datastore, auth model, deploy model, infrastructure target, a build-vs-buy or provider choice, the stack as found at onboard | `architect` | `architect` |

Every new ADR carries `Kind: product` or `Kind: technical` under its Status line. An older ADR without it is read by its content; the author who touches it adds nothing to it (ADRs are never edited, only superseded by a new file).

## Rules
- A new ADR is a new file, numbered after the latest. An existing ADR is never edited; a changed decision is a new ADR that says `Supersedes NNNN`, and the old one's status is recorded as superseded in the new file's Context
- Only the owner of a kind supersedes an ADR of that kind
- An agent that finds a decision of the other kind wrong or in its way does not write that ADR. It reports it in its hand-off (`blockers` with the other role as `owner`, or `summary`), naming the ADR number and the conflict, and the Orchestrator routes it
- A decision that crosses the boundary (a technical choice that changes scope, cost or an acceptance criterion, or a product choice that forces a different stack) is **not decided by either agent**. The Orchestrator asks the user once, with both consequences and a default, records the answer in `requirements.md`, then asks each owner to write or supersede its own ADR to match
- The user's answer overrides an agent's default; if it contradicts an accepted ADR, tell the user once and let them choose. The new ADR comes from the owner of that ADR's kind
