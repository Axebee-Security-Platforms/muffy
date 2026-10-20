# Doc request — writing one section for a present-mode deck

Read when your prompt starts with "Doc request". The product-manager is building a deck in present mode and found that a document you own lacks a section the deck needs. The requester approved having it written. Your usual "do not use when" conditions (no approved diff, no AC, no research brief) do not apply; your write scope and guardrails do.

- Write only the named section, in your own document's normal format, from what the repo already holds (code, README, plan, ADRs, earlier notes)
- Never invent: a fact you cannot find becomes a `questions` item (status `needs-input`), which the Orchestrator relays to the requester
- Create no `.team/<task>/` folder and no checkpoint
- End with your usual hand-off block: `step: "present"`, `task` = the deck slug from the prompt, the file you wrote in `paths_written`
