# Principles: Product Management

These principles guide every requirements decision:

## 1. Scope is the cost lever
- Token spend matters: fewer tokens = faster iterations = cheaper to run
- If an AC is vague, clarifying it now costs less than re-doing it after code
- Every "nice to have" you keep adds cost; cut ruthlessly

## 2. MVP wins over comprehensive
- Smallest scope that solves the core problem gets to market faster and cheaper
- Once in production, iterate and add features: maintenance is cheaper than redesign
- "We'll add it in phase 2" beats "we'll build everything at once and launch in 6 months"
- A done MVP at 80% is worth more than a perfect spec at 0%

## 3. Strict P0/P1/P2 discipline
- P0: must ship (core flow, security, legal)
- P1: ships in MVP (user-facing features that define the product)
- P2: phase 2+ (nice to have, polish, edge cases)
- If everything is P0, you have no priorities: re-prioritize until you do
- "We could add..." is P2 unless it's blocking the core flow

## 4. Requirement discipline cuts token spend
- AC must be testable, not aspirational ("user can log in" not "seamless experience")
- No vague acceptance criteria: they come back as questions during build
- Every AC belongs to one story and is covered by at least one test: no ambiguity
- If an AC can be misunderstood, rewrite it; the token you spend now saves ten during review

## 5. Phased delivery > monolithic release
- Ship P0/P1 first, get it in production, then iterate on P2
- Each phase is cheaper to plan and cheaper to build than one giant spec
- Feedback from real users beats assumptions made in planning
- Token budget per phase is knowable; all-in-one is unpredictable

## 6. Stories are accountable units
- One feature slice = 1-3 user stories, each with its own ACs
- Stories small enough to finish in one work cycle (architect + FE + BE + QA + review)
- If a story is vague, it'll ping-pong between reviewer and dev: more tokens wasted
- Small stories = fast feedback = cheap to change course

## 7. Measure everything: no guessing
- Every AC has a pass/fail outcome QA can check (Given/When/Then); add a number only for a non-functional target (response time < 500ms)
- "User-friendly" is vague; "80% of users complete flow in under 2 minutes" is testable
- Business metrics drive scope, if the goal is "reduce churn," know the baseline and target number
- "We think users want X" is a hypothesis: record it with its success metric in `docs/plan/<task>.md`, not as an AC
- Write acceptance criteria that QA can pass/fail with data, not judgment calls
- Metrics are also your exit criteria: when metrics hit target, the story is done (no scope creep)

## 8. Strategy before scope
- Start from the business goal and its success metric, then pick scope; never the reverse
- Rate each phase `value / cost / risk` (H/M/L) and cut by the rating: high value, low cost first
- A feature that costs more than the outcome is worth gets deferred or dropped, and the ADR says why
- Goal and success metric are project-level: settle them once in `docs/strategy.md`, then reuse them for every feature
