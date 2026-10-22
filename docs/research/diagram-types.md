# Diagram types muffy is missing

Research for diagram mode (`skills/muffy/references/diagram.md`). Question: muffy draws eight kinds in one card-and-wire look, and every example reads like an engineer wrote it. Which kinds are missing for a reader who is not an engineer?

Source strength: **[S]** = secondary (vendor or tutorial pages, found by web search, not checked against a primary). Nothing here is a primary standard; **[J]** = my judgment from the muffy code. The searches found no primary source on diagram label wording (GOV.UK and ONS plain-English guidance is about prose; applying it to labels is an inference).

## 1. What muffy draws today

`architecture`, `deployment`, `state`, `erd`, `flow` (sequence between actors), `screenmap`, `gantt`, `story-map` [J]. Five of the eight are the same picture: cards joined by labelled wires. All five are engineer-facing; only `gantt`, `story-map` and `screenmap` are natural for a product reader.

## 2. What the sources say a non-technical reader needs

| Need | Diagram | Source |
|---|---|---|
| Who does what, and where work is handed over | Swimlane (cross-functional flowchart): one lane per person or team | [S] [vanihq](https://www.vanihq.com/blog/types-of-diagrams-in-business.html), [Lark](https://www.larksuite.com/blog/workflow-diagram-examples) |
| What the customer goes through | Journey map: stages left to right, what the person does and feels | [S] [koji](https://www.koji.so/docs/customer-journey-map-vs-service-blueprint) |
| What the organisation does behind the customer's steps | Service blueprint: journey map plus lanes below the line of visibility | [S] [koji](https://www.koji.so/docs/service-blueprint-guide), [Pratt IxD](https://ixd.prattsi.org/2019/09/service-blueprint/) |
| A branching choice and its outcomes | Decision tree | [S] vanihq, Lark |
| Where information moves | Data-flow diagram (more technical; only when the reader must follow data) | [S] vanihq |
| The system as one box with its users and neighbours | C4 level 1, System Context. Sources agree this is the level for non-technical readers; Container and below are for engineers | [S] [Justice Digital](https://docs.analytical-platform.service.justice.gov.uk/documentation/diagrams/c4/c4-diagrams.html), [Visual Paradigm](https://s.visual-paradigm.com/guide/what-is-the-c4-model-a-comprehensive-guide-to-visualizing-software-architecture/) |

## 3. Gap against muffy

| Missing | Why it matters | Build cost [J] |
|---|---|---|
| **System context** (one box, its users, the outside services; no technology) | muffy's `architecture` starts at components; a stakeholder's first question is "who uses this and what does it touch". Could be a `pattern: context` of `architecture` (hard limits: one `system` node, at most 8 neighbours, no `note` with technology) | Low: reuses the grid renderer and checks |
| **Swimlane / process** (who does what, handovers) | The most common business diagram; `flow` shows systems talking, not people and teams handing over | Medium: new renderer (lanes, steps in order); reuse the flow step bar |
| **User journey** (stages, what the person does, where it goes wrong) | Pairs with `story-map`; shows pain points | Medium: new renderer; fits `story-map`'s table layout |
| **Decision tree** (a rule with outcomes, e.g. who gets which plan) | Business rules are today buried in `ac.md` | Medium: tree layout |
| **Before / after** | muffy has `delta` for topologies only; a reader asks "what changes for me" | Low: pattern on `journey` or `swimlane` |

Not recommended: data-flow diagrams (engineer-facing, overlap `flow` and `architecture`), mind maps and org charts (no muffy source of facts), full BPMN or UML (stricter notations than the reader needs) [J].

## 4. Recommendation

Build in this order: `context` pattern (cheapest, biggest effect for stakeholders), then `swimlane`, then `journey`. Each ships with a plain-language example in `templates/diagram-examples/`, a route row in `diagram.md` (who owns the facts) and the same validator and render checks. Decision tree and before/after wait for a request that needs them.

## 5. Shipped alongside this note

The wording and sequence problems were fixed in the checker rather than researched: `check-diagram.mjs` now WARNs on code-like or engineering words and unspelled acronyms in subtitle, notes and flow step labels, and on a flow with more than 8 steps or 4 actors, a first step not at the leftmost actor, an unused actor, no notes on a long flow, or a failing step with no note. These are heuristics; whether the words are clear is still a reader's judgment.

## 6. Addendum: mikelopster, "Diagram basic" (Thai, 2024 blog post)

Source: [mikelopster.dev/posts/diagram-basic](https://mikelopster.dev/posts/diagram-basic) **[S]**, one developer's practitioner write-up, not a standard. It covers the five diagrams a developer meets most: flowchart, sequence, class, state and ER. Each is shown next to the code it matches.

| Diagram | What the post says | muffy today [J] |
|---|---|---|
| **Flowchart** | Start/end, process boxes, decision diamonds, arrows, optional input/output. It shows the overview of a module or process and deliberately leaves out inner detail (how a check is done, what is saved). Its login example loops back to the prompt after an error | **Missing.** `flow` is a sequence between actors; nothing draws a decision with two outcomes or a loop back |
| **Sequence** | Actors across the top, lifelines, messages in time order top to bottom, dashed returns, and **fragments** (`alt` for a condition, `loop`, scenarios). Its order example splits into "in stock: charge and confirm" and "out of stock: tell the customer". It records the order of messages only, not how the code is written | **Partial.** Has actors, ordered steps and a `fail` mark. No `alt`/`loop`: a branch has to be a second diagram or a failing step |
| **Class** | Classes, attributes, operations, associations, multiplicity; for object-oriented design | **Missing, and not recommended.** Engineer-only, derived straight from code, and stale on the next refactor. `erd` covers the data side |
| **State** | States, activities on a change, transitions, conditions. The author rarely uses it because web work is mostly many services together | Covered (`state`, `lifecycle`) |
| **ER** | Entities, attributes, relationships, cardinality | Covered (`erd`, `db-schema`) |

What this adds to the earlier findings:

1. **Branches are the real gap, in two places.** A flowchart-style *decision* kind (what the earlier sections call decision tree / swimlane) and `alt` fragments inside `flow`. Both come up in the post's own examples (login retry, out of stock). A reader who is not an engineer asks "what if it fails?", and today `flow` answers with a single red step. Cheapest fix [J]: add an optional `branch` to a `flow` step (two labelled outcomes, each with its own short run of steps), capped at one level and counted in the 8-step limit.
2. **The post agrees with the overview rule.** Its flowchart "shows the overview and not the inner detail", which matches the checks added for plain words and step count; no change needed there.
3. **It says some diagrams need no technical background** but does not say which. Its examples (flowchart, order sequence) are the ones a non-engineer can follow; class and ER are not.
4. **Text-first diagrams (Mermaid)** are why developers use these five. muffy already imports Mermaid (`diagram-import.mjs`), so a user's existing flowchart (`graph` with a `{decision}` node) lands as `architecture`, which loses the decision meaning. Worth a `flowchart` kind or at least a warning on import [J].

Revised build order: (1) `alt` branches in `flow`, (2) a `flowchart` kind with decision nodes (start/end, step, decision, loop-back), (3) `context` pattern, (4) `swimlane`, (5) `journey`. Class diagram stays out.

## 7. Addendum: draw.io, "Diagrams in software design"

Source: [drawio.com/docs/diagram-types/use-cases/diagrams-software-design](https://www.drawio.com/docs/diagram-types/use-cases/diagrams-software-design/) **[S]**: a vendor's overview page. It is short and mostly links to other pages; it gives no rules for labels or reading order, so nothing here changes the wording and sequence checks. What it does give is a way to sort diagrams by when they are drawn.

**Forward design** (before the code): it lists user stories and workflows, navigation trees, UI mockups and process flows, data structures (ER and class), and high-level integrations (architecture, network, component diagrams), then detailed UML sequence and activity diagrams and state machines. **Backward design** (after the code): API, system and architecture documentation with a dependency graph, deployment settings, software testing flows (drawn as swimlanes), and user documentation: installation and support processes as flowcharts, labelled screenshots. It says to update diagrams after every sprint and calls this the step most often skipped. It names Kanban, timelines and Gantt as the non-technical project diagrams.

| Point from the page | muffy today [J] | Consequence |
|---|---|---|
| Forward vs backward design | `diagram.md` already splits them: facts that exist are read from code or contract; facts not designed yet route to spec, design or plan first | Confirms the design. No change |
| **Activity diagram** (a workflow with branches and parallel paths), listed next to sequence | Only the sequence-style `flow` | Same gap as the branch work in §6: a decision-capable kind. Parallel paths are not in the plan; treat them as out of scope |
| **Swimlane for test and process flows** | None | Backs `swimlane` in the build order. The page's example is testing, so a QA-facing use (who runs which check, in what order) is a second use case beside business handovers |
| **Dependency graph** | None; `architecture` shows only components that exist and the call between them | New candidate. Engineer-facing, so a low priority; it could be a pattern of `architecture` that requires one direction of dependency and flags cycles |
| **User documentation: installation and support as flowcharts** | None | This is the clearest non-engineer audience on the page. It strengthens the `flowchart` kind with decisions ("did it install? yes/no") over a new sequence feature |
| **Navigation tree** | `screenmap` is a graph of screens joined by actions, not a tree | Probably enough; a tree would add little |
| **Network diagram** | `deployment` covers hosts, containers and ports | Covered |
| **Update diagrams after each sprint; this step is skipped most** | A diagram can carry `commit` (required only for the onboard overview), so a reader can see which code it was drawn from | Gap: nothing compares that `commit` to the current code. A cheap check could WARN when a diagram's `commit` is not an ancestor-or-equal of HEAD, or is more than N commits behind. Needs git, so it would live in the Orchestrator's publish step, not in the offline validator [J] |

Revised build order after both sources: (1) either/or branches in `flow`, (2) `flowchart` with decisions, aimed first at install and support processes and at order-style business flows, (3) `context` pattern, (4) `swimlane`, covering handovers and test flows, (5) `journey`, (6) a staleness WARN on `commit`. Class diagrams and dependency graphs stay out for now.
