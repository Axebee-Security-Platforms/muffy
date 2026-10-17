# Requirements interview

Researcher (step 1), product-manager (step 2), architect (step 3, provider choices only), devops (step 3, mode 1, infrastructure choice only) and designer (step 3, design-system intake only) may not talk to the user. When the request leaves a decision open they return `status: needs-input` with `questions[]` in the hand-off block, and the Orchestrator relays them. This is a clarification round, not a fix loop: it never touches the loop counters.

## Orchestrator procedure

1. Validate the hand-off. `needs-input` without `questions` is invalid → fallback ladder rung 1 ([loops.md](loops.md))
2. Ask the user with `AskUserQuestion`: ≤ 4 questions per call, recommended option first (the question's `default`), the agent's `why` as context. More than 4 → highest-impact first (`blocking: true`, then hard-to-reverse), then a second call. Never forward more than 8 questions in total per round
3. Append the answers to `.team/<task>/requirements.md` (create it on first use), one dated section per round: `Q-id · question · answer · asked by`. A question the user skips or answers "you decide" is recorded as `assumed: <default>`
4. Resume the same agent with `SendMessage` (round + 1), giving only the path `.team/<task>/requirements.md`. Never paste the answers into the prompt
5. Record `clarify <role> n/2` in checkpoint `## Status`. Every later prompt to any agent lists `.team/<task>/requirements.md` under `Read:`

## Limits

- At most 2 clarification rounds per agent per task. In the 2nd round the agent must stop asking: every open item becomes an assumption in its deliverable, marked `[assumed]`
- Non-blocking questions (`blocking: false`) never stop the run. The agent proceeds on its `default` and lists it under `assumptions`; the Orchestrator may batch them into the next ask
- A question already answered in `requirements.md`, the request, `baseline.md` or an ADR is never asked again. Orchestrator drops duplicates before asking
- The user's answer overrides the agent's default. If an answer contradicts an accepted ADR, tell the user once and let them choose; a changed decision needs a new ADR from the owner of that ADR's kind (product-manager for product, architect for technical; [adr.md](adr.md))

## What each agent asks

| Agent | Asks about | Examples |
|---|---|---|
| `researcher` | Context and constraints that change what to research | existing systems to integrate, stack or vendor limits, scale, compliance, budget, deadline, prior attempts, what "better" means |
| `architect` | Which third-party provider to use, when a capability is better bought than built and the choice has a recurring cost, handles personal data or locks in ([third-party-providers.md](../../../agents/references/architect/third-party-providers.md)) | payments (Stripe vs Adyen vs build), auth (managed vs self-hosted), email, search, file storage |
| `designer` | One question, only when the project has no design system and is not an internal tool: does the orderer have a brand or a reference? (default: no, use the starter). A second round of at most 4 questions only if the answer is yes. Never blocking ([design-system-intake.md](../../../agents/references/designer/design-system-intake.md)) | not yet, starter / yes, I will share it / pick a personality / resemble a product I describe |
| `devops` | Where it runs, only when the user answered `infra: propose` and nothing already decides it: cloud, on-premises, hybrid or existing infrastructure, and which provider or hardware, with cost, operational load and data location ([infrastructure-options.md](../../../agents/references/devops/infrastructure-options.md)) | managed platform vs own servers, one cloud vs another, buy hardware vs colocation |
| `product-manager` | Product decisions that change the AC or the plan | who the users are, the problem and success metric, MVP cut, priority of each need, edge-case behaviour, out-of-scope, non-functional targets |

The PM reads `requirements.md` and `brief.md` first and asks only what is still open. The researcher never decides requirements; its questions gather facts and constraints, and anything that is a product choice goes into the brief as an open question for the PM to ask.

## Question shape

Defined by `questions[]` in [handoff.schema.json](../schemas/handoff.schema.json): `id` (`Q-n`, stable across rounds), `question`, `why` (what it changes), `options` (2–4 concrete choices, no "other"), `default` (one of the options, the agent's recommendation), `blocking`. Ask closed, concrete questions with options; never "anything else?".
