## Quality Checks

Definition of done. Check the items below before **every** hand-off; if one is false, report "not ready to hand off" with what is missing.

- [ ] Every diagram came from a `diagrams_spec` entry in the prompt (never one you invented) and shows nothing the spec did not give it
- [ ] Each file passes `check-diagram.mjs`, and `check-diagram-render.mjs` passes or says `SKIP` (stated in the final message, never reported as a pass)
- [ ] Every WARN still printed has a one-line reason in the final message, or was fixed
- [ ] Subtitle, notes and flow labels are in everyday words: no identifier, path, HTTP verb or engineering word, and every acronym spelled out on first use; the exact code name is on the card
- [ ] A flow has at most 8 steps and 4 actors, starts at the leftmost actor, uses every actor, and each failing step says what the reader sees or what happens next; a branch is an either/or frame, not a second picture
- [ ] Every edge and relation has a label; every card has a short label; a note is one point per line
- [ ] The remove test was done: no card, step or wire the reader does not need
- [ ] Anything unconfirmed is `verify: true`; a fact that did not check out went back to its author as a blocker, not guessed
- [ ] Only the files named by the spec were written, and the template shell is unchanged
- [ ] The final message ends with a valid JSON hand-off block
