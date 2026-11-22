# Requirements interview

Researcher (step 1), product-manager (step 2), architect (step 3, provider choices only), and designer (step 3, design-system intake only) may not talk to the user. When the request leaves a decision open they return `status: needs-input` with `questions[]` in the hand-off block, and the Orchestrator relays them. The designer's intake is the exception: it returns `done` with one non-blocking question (see Limits). This is a clarification round, not a fix loop: it never touches the loop counters.

## Orchestrator procedure

1. Validate the hand-off. `needs-input` without `questions` is invalid → fallback ladder rung 1 ([loops.md](loops.md))
2. Ask the user with `AskUserQuestion`: ≤ 4 questions per call, recommended option first (the question's `default`), the agent's `why` as context. More than 4 → highest-impact first (`blocking: true`, then hard-to-reverse), then a second call. Never forward more than 8 questions in total per round
3. Append the answers to `.team/<task>/requirements.md` (create it on first use), one dated section per round: `Q-id · question · answer · asked by`. A question the user skips or answers "you decide" is recorded as `assumed: <default>`
4. Resume the same agent with `SendMessage` (round + 1), giving only the path `.team/<task>/requirements.md`. Never paste the answers into the prompt
5. Record `clarify <role> n/2` in checkpoint `## Status`. Every later prompt to any agent lists `.team/<task>/requirements.md` under `Read:`

## Limits

- At most 2 clarification rounds per agent per task. In the 2nd round the agent must stop asking: every open item becomes an assumption in its deliverable, marked `[assumed]`
- Non-blocking questions (`blocking: false`) never stop the run. The agent proceeds on its `default` and lists it under `assumptions`; the Orchestrator may batch them into the next ask
- A `done` (or `blocked`, `not-ready`) hand-off may carry questions only when every one is `blocking: false` (the schema enforces it). Do not resume the agent for them: add them to the next human question (`pause:design-review` for the designer's intake), record the answers as in step 3, and resume the agent only when an answer differs from its `default`. That resume is a clarification round, not a loop
- A question already answered in `requirements.md`, the request, `baseline.md` or an ADR is never asked again. Orchestrator drops duplicates before asking
- The user's answer overrides the agent's default. If an answer contradicts an accepted ADR, tell the user once and let them choose; a changed decision needs a new ADR from the owner of that ADR's kind (product-manager for product, architect for technical; [adr-writing.md](adr-writing.md))

## Who may ask, and when

What each agent asks about lives in its own workflow; the Orchestrator only needs to know who may return `needs-input`, so it can tell a clarification round from a protocol error.

| Agent | Step | May return `needs-input` for | Its rules |
|---|---|---|---|
| `researcher` | 1 | context and constraints that change what to research (never product decisions: those go to the PM as open questions in the brief) | [workflow](../../../agent-references/researcher/workflow.md) step 1b |
| `product-manager` | 2 | product decisions that change the AC or the plan | [workflow](../../../agent-references/product-manager/workflow.md) step 1b |
| `architect` | 3 | a third-party provider choice only | [third-party-providers.md](../../../agent-references/architect/third-party-providers.md) |
| `designer` | 3 | never for the design-system intake (that is one non-blocking question on a `done` hand-off, asked at `pause:design-review`); only a Platform conflict between sources, or the intake's follow-up round when the user said they have a brand | [design-system-intake.md](../../../agent-references/designer/design-system-intake.md) |

Outside the team flow, present mode and doc requests have their own `needs-input` rounds ([present.md](present.md), [doc-request.md](doc-request.md)).

## Question shape

Defined by `questions[]` in [handoff.schema.json](../schemas/handoff.schema.json): `id` (`Q-n`, stable across rounds), `question`, `why` (what it changes), `options` (2-4 concrete choices, no "other"), `default` (one of the options, the agent's recommendation), `blocking`. Ask closed, concrete questions with options; never "anything else?".
