# Slide Types

`deck.json` is `{ "title", "audience": { "who", "role", "familiarity", "cares": [], "setting" }, "background", "language", "slides": [ ... ] }` (values in [required-inputs.md](required-inputs.md); `background` in [visual-style.md](visual-style.md)) (the look lives in the `#theme` style of `deck.html`, see [workflow.md](workflow.md) step 9). Every slide has `type`, `headline` and optional `notes` (speaker notes, never shown), `footnote` (shown small at the bottom), `caption` (lower-third sentence, ≤ 120 characters, see [visual-style.md](visual-style.md)) and `derived` (the formula behind a computed number, shown as a footnote). A `source` is never shown; it stays in the JSON for the requester. On slides that hold no per-item source (`bullets`, `comparison`, `diagram`, `section`, `steps`, `statement`, `cta`, `title`), any digit in the visible text needs a slide-level `source`. Every number, date or timeframe shown carries a `source` (`path#section`) on the object that holds it.

## Headlines

The headline is the takeaway ("Checkout drops from 5 steps to 2"), not a label ("Checkout"). Sentence headlines over visual evidence beat topic headlines over bullets on comprehension in a controlled study ([research](../../../docs/research/presentation-layouts.md) §1). The checker enforces the countable parts:

- A full sentence with a verb; 3 to 15 words (the title slide may be shorter). Thai and other scripts without spaces: ≤ 90 characters
- Never a question: questions split attention or sound unsure
- Detail that doesn't fit goes in `notes`, not a longer headline
- `bullets` is the last resort: if the content is ordered use `steps`, dated `timeline`, phased `roadmap`, numeric `chart` or `metric`

## Types

| `type` | Use for | Fields | Limits |
|---|---|---|---|
| `title` | Cover | `subtitle`, `client`, `date` | One per deck, first |
| `agenda` | What the deck covers | `items[]` | 3–6 items; skip for decks under 6 slides |
| `bullets` | General content: problem, solution, risks | `items[]`, `takeaway?` | ≤ 5 items, ≤ 12 words each |
| `timeline` | Dated milestones, past and upcoming | `events[] {date, label, status: done\|next\|planned, source}` | ≤ 7 events |
| `roadmap` | Plan in phases: Now / Next / Later or quarters | `columns[] {label, cards[] {title, value, source}}` | 2–4 columns, ≤ 4 cards each; `value` = what the audience gets |
| `comparison` | Options or before/after, qualitative | `options[] {name, recommended?}`, `criteria[] {label, values[]}` | 2–3 options, ≤ 6 criteria |
| `chart` | Comparing numbers | see [data-compare.md](data-compare.md) | One question per chart |
| `metric` | Headline numbers | `values[] {value, unit, label, source, delta?}` | 1–4 values |
| `quote` | A customer or user voice, or the key message | `text`, `by`, `source` | ≤ 30 words; real quotes only, from a source |
| `diagram` | Simple picture of a process or the system, no tech detail | `nodes[] {id, label}`, `edges[] {from, to, label?}` | ≤ 7 nodes; labels in audience words |
| `section` | Divider between parts of a long deck, mirrors an `agenda` item | `number?` (the agenda position) | Decks of 10+ slides with an `agenda`; ≤ one per agenda item; headline still a takeaway ("Phase 2 delivers self-service reporting") |
| `steps` | Ordered actions for an end-user, or stages a client goes through | `steps[] {label, detail?}`, `source?` | 3–6 steps; `label` ≤ 8 words, imperative, no leading number (the template numbers them); `detail` ≤ 12 words. A count in the headline ("three steps") must match; a duration needs `source` |
| `statement` | One sentence to remember, at a turn in the story (what is → what could be) | `support?` (≤ 20 words), `source?` | Headline ≤ 15 words; ≤ 2 per deck, never two in a row. It is not evidence: if it needs proof, the next slide proves it. A benefit claim needs `source`. Never a claim the source marks as assumed or unconfirmed: that belongs in `notes` or a risk slide |
| `cta` | Close: the decision asked for, or the action | `kind` (`decide` \| `act`), `ask`, `next[]`, `contact?` | One per deck, last. `kind` follows the role: `decide` / `evaluate` → `decide`, the rest → `act`. A `decide` ask names the decision and when it is needed (a date or "by <meeting>"; a date needs a slide `source`, usually `request`); an `act` cta lists what to do in `next[]`: things the audience can do now, never a `TBD` or a summary (open facts go in the final message) |
