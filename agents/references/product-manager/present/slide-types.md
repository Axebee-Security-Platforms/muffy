# Slide Types

`deck.json` is `{ "title", "audience": { "who", "role", "familiarity", "cares": [], "setting" }, "language", "slides": [ ... ] }` (values in [required-inputs.md](required-inputs.md)). It is content only: the designer decides how every part looks. Every slide has `type`, `headline` and optional `kicker`, `notes` (speaker notes, never shown), `footnote`, `caption`, `narration`, `duration` and `derived` (the formula behind a computed number) — see "Content cues" below. A `source` is never shown; it stays in the JSON for the requester. On slides that hold no per-item source (`bullets`, `comparison`, `diagram`, `section`, `steps`, `features` cards without their own `source`, `statement`, `cta`, `title`), any digit in the visible text needs a slide-level `source`. Every number, date or timeframe shown carries a `source` (`path#section`) on the object that holds it.

## Headlines

The headline is the takeaway ("Checkout drops from 5 steps to 2"), not a label ("Checkout"). Sentence headlines over visual evidence beat topic headlines over bullets on comprehension in a controlled study ([research](../../../../docs/research/presentation-layouts.md) §1). The checker enforces the countable parts:

- A full sentence with a verb; 3 to 15 words (the title slide may be shorter). Thai and other scripts without spaces: ≤ 90 characters
- Never a question: questions split attention or sound unsure
- Detail that doesn't fit goes in `notes`, not a longer headline
- `bullets` is the last resort: if the content is ordered use `steps`, dated `timeline`, phased `roadmap`, numeric `chart` or `metric`

## Content cues

What you mark in the content; how it looks is the designer's call.

- **`kicker`** (≤ 3 words): names the part of the story the slide belongs to ("The problem", "ปัญหา", "How it works"). Most slides of an explainer; not the title or the close
- **The accent:** one `*word or phrase*` per headline, the thing the audience should remember (`ใช้ AI แต่ขาด *ระบบทีม*`)
- **Order:** items appear in the order you write them; the point that matters goes first
- **`caption`** (≤ 120 characters, one sentence): the line to remember when the headline alone doesn't carry it; 1 slide in 3 at most, except in read-alone decks
- **`narration` + `duration`** for `read-alone` decks (and `live` ones only when the requester asks for auto-play): narration is the voice-over, ≤ 40 words, two short sentences that add to the slide rather than read it out; duration is 4–30 seconds, about 1 second per 3 words plus time to read the slide. Not the same as `notes`, which are for a live presenter
- **`footnote`:** a qualifier the audience must see ("Target, not yet measured")
- A number, date or timeframe in any of these needs the slide's `source`, like everywhere else

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
| `steps` | Ordered actions for an end-user, or stages a client goes through | `steps[] {label, detail?}`, `source?` | 3–6 steps; `label` ≤ 8 words, imperative, no leading number (the template numbers them); `detail` ≤ 12 words. A count in the headline ("three steps", "12 ขั้น") must match; a duration needs `source`. **A longer process** (a full workflow) uses `groups[] {label, steps[]}` instead: 2–4 groups of 1–6 steps, 12 in all, numbered straight through; group labels ≤ 3 words ("Plan", "Build", "Ship") |
| `features` | Things of equal standing shown together: the roles of a team, the commands of a tool, the ways it helps, what's included | `items[] {title, text?, tag?, source?}` | 3–10 cards; `title` ≤ 6 words, `text` ≤ 22 words (≤ 14 when more than 6 cards), `tag` ≤ 3 words (e.g. a command or a number label). A count in the headline ("10 roles", "หกทาง") must match the cards. Not for an order (`steps`), a time (`roadmap`) or numbers (`metric`) |
| `statement` | One sentence to remember, at a turn in the story (what is → what could be) | `support?` (≤ 20 words), `source?` | Headline ≤ 15 words; ≤ 2 per deck, never two in a row. It is not evidence: if it needs proof, the next slide proves it. A benefit claim needs `source`. Never a claim the source marks as assumed or unconfirmed: that belongs in `notes` or a risk slide |
| `cta` | Close: the decision asked for, or the action | `kind` (`decide` \| `act`), `ask`, `next[]`, `contact?` | One per deck, last. `kind` follows the role: `decide` / `evaluate` → `decide`, the rest → `act`. A `decide` ask names the decision and when it is needed (a date or "by <meeting>"; a date needs a slide `source`, usually `request`); an `act` cta lists what to do in `next[]`: things the audience can do now, never a `TBD` or a summary (open facts go in the final message) |
