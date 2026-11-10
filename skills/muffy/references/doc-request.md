# Doc request (present mode)

When the product-manager, writing a deck in present mode, can't build it because a document the deck needs is missing or thin, it asks for that document instead of guessing. Agents never talk to each other: the product-manager names the gap, the Orchestrator asks the requester, and only then spawns the agent that owns the document.

## Who owns what

| Missing | Owner (`blockers[].owner`) | Agent | Document |
|---|---|---|---|
| Problem, value, goals, scope, phased plan | `PM` | product-manager | `docs/strategy.md`, plan |
| How the system works, its parts, technical decisions | `Architect` | architect | an ADR, `docs/architecture/overview.html` |
| What the product is, how to use it, how to start, the commands or features (README level) | `Docs` | docs-writer | `README.md`, `docs/` |
| Evidence about users, the market, the current situation | `Researcher` | researcher | a research brief |
| The deck's colors and font | `Designer` | designer | `## Presentation` in `docs/design-system/README.md` |

## Flow

1. **Product-manager** (round 1, after reading the sources): for each fact the deck's goal needs that no source holds, decide whether a document *should* hold it. Yes → a blocker `{id: "B-n", problem: "<doc>: no <section>; slides <n> need <what>", file: "<path>", owner}`. A fact only the requester can know (a date, a price, a name) is a `questions` item, not a blocker. Write `outline.md` with those slides marked `waiting: B-n`, and hand off with status `blocked`
2. **Orchestrator**: show the requester the list in one question, in plain words: "ขาดเอกสาร 2 เรื่อง: ภาพรวมโปรดักต์ (docs-writer), ปัญหาที่แก้ (PM) ให้เขียนเพิ่มไหม" / "2 documents are missing: … Have them written?" Options: write all / pick / skip. Never spawn an owner without a yes: every spawn costs tokens, and the requester may have the document elsewhere (then add its path to the product-manager's sources instead)
3. **Owner.** A blocker owned by `PM` needs no spawn: the product-manager is already writing the deck, so `SendMessage` it "write approved: B-n" and it fills its own document in the same context. Every other owner is spawned fresh (one per blocker, in parallel when they touch different files): prompt = "Doc request: follow `agent-references/shared/doc-request.md`" (the agent finds it next to its own reference files) (an agent already spawned never reads its own `when-to-use.md`, so the prompt carries the exception), the blocker text, the target file and section, `step: "present"`, `task: <deck slug>`, the commit trailer. What the owner may and may not do is in [that file](../../../agent-references/shared/doc-request.md): only the named section, nothing invented (a gap comes back as `needs-input`), no task folder
4. **Orchestrator**: validate each hand-off; relay owner questions if any; then `SendMessage` the product-manager: "docs updated: <paths>" (added to its sources). Skipped blockers → "skipped: B-n" and the product-manager writes `TBD` for those slides
5. **Product-manager**: re-read only the new sections, finish `outline.md`, hand off with `needs-input` for the outline confirmation as usual

## Rules

- One request round per deck: a document is asked for once; a gap left after that is `TBD`
- The owner's usual "do not use when" conditions (no approved diff, no AC, no research brief) don't apply to a doc request; its write scope and guardrails do
- The requester sees every new document in the commit at the end of present mode, with the deck
