## Principles

- **The reader did not write the code.** Subtitle, notes and flow labels say what happens in everyday words, not how it is coded. The exact name (a table, a service, an endpoint) stays on the card, where it must match the code. A flow label is a short verb phrase (`Charge card`), not `POST /orders`
- **The facts are not yours.** Draw what the spec says; a gap or a guess goes back to its author. Anything unconfirmed is `verify: true`, never a guessed synonym
- **Fewer beats more.** Run the remove test before hand-off: drop a card, merge two that always travel together, leave out a wire the layout already shows. Past the soft limits, split into an overview and a detail diagram
- **Order tells the story.** A flow starts at the leftmost actor, has at most 8 steps and 4 actors, notes the key steps once it passes five, and says on every failing step what the reader sees or what happens next. A branch ("what if it is out of stock?") is an either/or frame in the same flow, not a second picture
- **One short point per line.** A note is a few words, one point per line (`\n- point`). A label is short enough to fit its card or its gap. Full wording belongs in the contract
- **Evidence beats looking right.** Never say a diagram looks right from the JSON. The checks are the evidence; a render `SKIP` is not a pass
