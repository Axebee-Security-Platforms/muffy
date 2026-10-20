# Route — pick the entry and the agents from the prompt

Runs first, on every request, before any other reference. The Orchestrator reads the requester's prompt and picks the smallest route that delivers the outcome they asked for. It then says the route in one line before spawning anything: `Route: <name> → <agents>. Because: <the words in the prompt that decided it>.` The requester can override it.

The route is decided by the **outcome asked for**, not by a single keyword. "Bug" alone does not make a fix, "review" alone does not make a review-only run; the signals below decide.

## Signals (read in this order)

1. **Stop point.** Did the requester name where to stop? ("just the design", "only review", "plan it, don't build", "research, no code"). A stated stop point wins over the default.
2. **Outcome.** What artifact do they want back: a code change, a design, a spec or contract, a plan, a research brief, a review verdict, tests, docs, a deployment, a deck, a diagram, or an answer?
3. **Writes to the repo?** Code, tests or deploy config means the run must carry review, QA, staging and the Human gate. Chat-only answers and read-only reviews do not.
4. **Scope.** One file or one screen (a trivial edit) versus a feature that spans UI, API and data.

## Minimum intake (ask before spawning)

Each route needs a few facts before any agent starts. Most under-specified prompts miss exactly these, and the missing facts are what cause repeated re-prompting later. If the prompt does not give one of them, ask all the missing ones together in one `AskUserQuestion` (up to 4 questions), then route.

| Route | Must be known before spawning | Missing → ask |
|---|---|---|
| fix | symptom, plus a location or a way to reproduce | what happens, and where or how to trigger it |
| lite | the goal, the named area (module, endpoint, table or query), and for performance work a measured before-number | the missing one, in one question |
| full flow | the goal in one sentence and who it is for | requirements interview ([requirements.md](requirements.md)) |
| research | the question and the decision it feeds | the decision |
| plan | the goal and the stop point | the goal |
| design | which screens or flow, and "no code" or not | the screens or flow |
| spec | the feature and who consumes the API or schema | the consumer |
| ops | the target (staging or production) and the action | the target. Production is never assumed |
| review | the diff: branch, PR or file list | the branch or PR |
| qa | the branch and what to test | the branch |
| docs | the shipped change or its diff, and whether the diff is approved | the change |
| none | nothing | nothing |

## Routes

| The prompt asks for | Route | Agents, in order | Stops at |
|---|---|---|---|
| A question about the code or the repo ("how does X work?") | none | main session answers, reading with Grep/Read | the answer. No muffy |
| A one-line edit with no behaviour risk (typo, one line) | none | main session edits | the edit. No muffy |
| A bug or cosmetic fix with a symptom | fix ([fix-profile.md](fix-profile.md)) | diagnose and fix (FE and/or BE), `code-reviewer`, `qa-tester`, `devops` staging | Human gate |
| Internal work with a known shape: an internal API, a refactor, a measured performance fix, an index or reversible migration, nothing a user sees ("split this module", "add an index, p95 is 1.8 s") | lite ([lite-profile.md](lite-profile.md)) | `architect` (+ devops for a migration), frontend-dev ∥ backend-dev, code-reviewer, qa-tester, devops staging | Human gate, then production |
| A new feature or behaviour change across UI, API or data, "build X" | full flow ([steps.md](steps.md), [run-profile.md](run-profile.md)) | researcher, product-manager, designer ∥ architect ∥ devops, frontend-dev ∥ backend-dev, code-reviewer, qa-tester ∥ docs-writer, devops | Human gate, then production |
| Compare options, "what is the best library", "what do competitors do" | research | `researcher` (L0–L2 by the question's depth) | the research brief, in chat. Saved to `docs/research/<slug>.md` only if asked |
| User stories, acceptance criteria, a phased plan, priorities | plan | `researcher` only if facts are missing, then `product-manager` | `ac.md` and the plan, for the requester to approve |
| Screens, user flow, wireframes, UI states, design only | design | `designer` (plus `architect` if the screens need an API the requester has not defined) | the design canvas, at the design gate. Code is not written |
| API, schema, contract or data model only | spec | `architect` | `contract.md`. No code |
| Deploy, rollback, infra, runtime pin, staging or production | ops | `devops` (check mode, or deploy mode after its gate) | the deploy result. Production only after the Human gate, never from this route alone |
| Review an existing diff, branch or PR, "is this safe", "check my change" | review | `code-reviewer` (read-only) | the verdict in chat, saved as `review-<n>.md` only inside a task. No fixes |
| Write or run tests, QA, regression on a branch | qa | `qa-tester` | `qa-report.md`. No production code change. Whole-system run needs `pause:full-regression` |
| API docs or release notes for a change | docs | `docs-writer`, then `code-reviewer` on the docs | the reviewed docs. If the diff is not yet approved, route to review first |
| A standalone diagram | diagram | per [diagram.md](diagram.md) | the diagram file |
| A deck or presentation for a client or end-users | present | per [present.md](present.md) | the deck |
| Find unfinished work in a repo or tracker | analyze | per [analyze.md](analyze.md) | the confirmed task list |
| First run on an existing codebase | onboard | per [onboard.md](onboard.md) | `baseline.md` and ADR, after review |
| Continue earlier work ("continue", "resume") | resume | per [resume.md](resume.md) | the next step in `checkpoint.md` |

## Rules

- **Smallest route that delivers the outcome.** "Plan it" stops at the plan. "Review this branch" is `code-reviewer` alone, not the full flow. Escalate to a bigger route only when the prompt asks for the later step.
- **Code always carries the gates.** Any route that writes code keeps review, QA, staging and the Human gate. A design-only, spec-only, research-only or review-only route writes no code, so it does not start the team flow.
- **Single-agent routes are real runs.** Spawn the agent fresh with the request verbatim, the route's stop point and the commit trailer. It still ends with a hand-off block that is validated. Create `.team/<task>/` only when the route writes a repo file that belongs to a task (`ac.md`, `contract.md`, `qa-report.md`, `review-<n>.md`); otherwise the agent's output goes to the requester in chat.
- **Mixed prompts.** "Fix this bug and also plan the next feature": split at the outcome. Run the fix lane and keep the plan as a separate task (`pause:scope` cuts out the extra work, see [fix-profile.md](fix-profile.md)).
- **Ambiguous.** Two routes fit equally and the prompt does not say which: ask one `AskUserQuestion` with the candidate routes as options, the smaller one first. Never guess a route that writes code.
- **Missing inputs for the route.** A bug with no symptom or location, or a review with no diff or branch, asks for that one thing before routing. A feature with no goal asks through the requirements interview ([requirements.md](requirements.md)).
- **Standalone agents never run the full flow to answer a small question.** If the requester only wants an answer, answer it.

## Examples

| Prompt | Route | Why |
|---|---|---|
| "Submit on /contact returns 500 when message is empty. `TypeError at src/api/contact.ts:41`" | fix (BE) | Symptom, location, one file |
| "Add password reset" | full flow | New behaviour across UI, API and data |
| "Compare Zod, Valibot and Yup for our form validation, no code" | research | Outcome is a comparison; stop point is "no code" |
| "Write user stories and acceptance criteria for password reset, don't design yet" | plan | Stop point before design |
| "Design the checkout screens, I'll do the API myself" | design | Designer only; no contract needed |
| "Design the orders API and schema for the new returns flow" | spec | Architect only |
| "Review the branch feature/invoices-export before I merge" | review | Read-only verdict on an existing diff |
| "Write Playwright tests for the login flow on this branch" | qa | Tests only, no production change |
| "Write the release notes for the invoices export" | docs | Docs, then review; if the diff is unapproved, review first |
| "Deploy the hotfix to staging" | ops | Staging only; production waits for the gate |
| "How does the retry queue work?" | none | A question about the code |
| "เจอบั๊ก แก้ไขให้หน่อย" | ask first | Bug report with no symptom or location |
| "ช่วยเช็คว่า PR นี้ปลอดภัยไหม" | review | Outcome is a verdict on an existing change; ask for the PR or branch if not named |
| "ทำระบบรีเซ็ตรหัสผ่านให้หน่อย" | full flow | Build a feature across UI, API and data |
| "ออกแบบหน้าจอให้ก่อน ยังไม่ต้องเขียนโค้ด" | design | Stop point: design, no code |
