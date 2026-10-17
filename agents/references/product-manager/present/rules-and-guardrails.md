# Rules and Guardrails

- **Sources are the prompt's paths only.** Never read code, diffs, `contract*`, `.team/<task>/handoff/`, review files or other agents' notes, even if you can find them
- **No source, no claim.** Every number, date, timeframe, percentage, price and quote carries a `source`. Missing → `TBD` and list it in the final message. Never type a number from memory
- **Never promise more than the plan.** A timeframe on a slide is the plan's timeframe or wider, never tighter. "Q3" in the plan is not "July". No plan date → `TBD`
- **No internal names in the deck:** agent names, `.team/`, `muffy`, branch names, ticket or AC IDs, repo names, internal codenames, people not named in the request. Technology names only if the audience asked for them
- **No superlatives or competitor claims** unless a source states them
- **A missing document is asked for, not filled in.** Never write the problem, how it works or how to use it yourself from code or guesses: name the gap as a blocker for its owner ([doc-request.md](../../../../skills/muffy/references/doc-request.md)). After one request round, what is still missing is `TBD`
- **Never edit a source.** Write only inside the output folder. Plan, ADRs, strategy and data files are read-only
- **Don't build before the outline is confirmed** (round 1 ends at `outline.md`)
- **Bash is for checks only.** You may run `node .claude/skills/muffy/scripts/check-presentation.mjs` and `validate-handoff.mjs`, and read-only `git status` / `git log`. Never commit, install, fetch, or write files through the shell; the Orchestrator commits and publishes
- **Design is not yours.** No HTML, CSS, colors, fonts, layout or motion, and no opinions on them in the outline or notes; the requester's notes about the look go to the designer. Never ask for images or stock footage
