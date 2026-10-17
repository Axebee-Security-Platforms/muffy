# Diagram style

Every diagram muffy produces (architecture, database, flow) is one self-contained `.html` file made from [templates/diagram.html](../templates/diagram.html). No Mermaid, no images, no external scripts, fonts or links. When to draw one is decided elsewhere ([architect diagrams](../../../agents/references/architect/diagrams.md), the fix lane's `flow.html`); this file is only how.

## Look and motion (fixed by the template)
- **Surface:** a blueprint grid paper background with a major line every 120 px, minimal and calm; light and dark follow the system
- **Nodes:** floating cards with a soft drop shadow and a colour bar by type (`app`, `service`, `store`, `external`, `queue`). The type is also written on the card, so colour is never the only signal
- **Wires:** labelled connectors with arrowheads that draw in, then carry a slow flowing pulse. Dashed means `[verify]`, unconfirmed
- **Motion:** cards rise in one after another and wires draw in. A flow diagram reveals its numbered steps in order, with Prev, Next and Replay, and a click on a step jumps to it. Reduced-motion users get the finished static diagram
- **Caption:** a bold lower-third card carries the one-sentence takeaway (and the current step in a flow). Titles and captions are plain, large and short

## How to make one
1. Copy the template to the target path (`.html`)
2. Change only `<title>` and the JSON in `<script type="application/json" id="diagram">`. Do not touch the CSS, renderer or markup: the validator rejects any other change
3. Validate: `node .claude/skills/muffy/scripts/check-diagram.mjs <file.html>`. A FAIL is fixed before hand-off
4. Never say the diagram looks right from the JSON alone; you cannot open it, so the check above is your evidence and the Orchestrator or the user views it

## JSON
Common: `kind` (`architecture` | `erd` | `flow`), `title`, `subtitle`, `caption` (one sentence, at most 160 characters), optional `commit` (short SHA of the code it was drawn from; required for the onboard overview).

| kind | Items | Fields | Links | Limit |
|---|---|---|---|---|
| `architecture` | `nodes` | `id`, `label`, `type`, optional `note`, `col`, `row`, optional `verify` | `edges`: `from`, `to`, `label`, optional `verify`, optional `dir: "both"` | 15 nodes |
| `erd` | `entities` | `id`, `name`, `col`, `row`, `fields` of `{name, type, key}` (`key` is `pk` or `fk` or omitted), optional `note`, `verify` | `relations`: `from`, `to`, `label` such as `1 : N` | 12 entities, 12 fields each |
| `flow` | `actors` (`id`, `label`, `type`) | none | `steps`: `from`, `to`, `label`, optional `note` (shown in the caption), `fail` (marks the step that fails), `verify` | 6 actors, 12 steps |

## Content rules
- `col` and `row` place a card on a grid starting at 1. Put linked nodes next to each other; an edge in the same row or column must not pass over another card (the validator fails it). Read left to right for flow of control, top to bottom for layers
- Every edge and relation has a label (protocol, verb or cardinality). Every card has a short label; a `note` is a few words, not a paragraph
- An ERD lists primary and foreign keys and the columns that matter for the change, not every column
- Facts only: what the code or contract shows. Anything unconfirmed is `verify: true`. A diagram never introduces a table, field or step that the contract, schema or traced code lacks
- Text is plain: the template writes it with `textContent`, so no HTML in labels
