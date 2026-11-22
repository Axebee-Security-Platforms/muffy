# Route: pick the entry and the agents from the prompt

Runs first on a free-text request, before any other reference. A request that starts with a mode command (`/muffy todo | onboard | present | diagram | resume | fix | lite | redesign | feature`; `lite` and `redesign` start the change lane) is already routed: skip this file. The Orchestrator reads the requester's prompt and picks the smallest route that delivers the outcome they asked for. It then shows the plan before spawning anything ([Say the plan](#say-the-plan)), in the words of the work, never a lane name alone. The requester can override it.

The route is decided by the **outcome asked for**, not by a single keyword. "Bug" alone does not make a fix, "review" alone does not make a review-only run, "ออกแบบ" alone does not make a design run; the decision order below decides.

## Decision order

Walk it top to bottom and stop at the first step that answers. The fix and change lanes keep their own triage; this order only decides which triage runs.

1. **Continue earlier work** ("continue", "resume", ทำต่อ) → resume. **A bare `/muffy`** (no request) or `/muffy todo` → menu ([menu.md](menu.md)). `/muffy resume` with no task is resume: one unfinished task goes straight in, several or none show the menu
2. **`/muffy redesign <request>`** → the change lane with a visible scope; its scope question is still asked. **`/muffy lite <request>`** → the change lane, `internal` scope, through its triage.
   **`/muffy feature <request>`** → full flow, with no fix or change triage and no Examples read. It skips only this decision; minimum intake, `pause:scope` and every gate still run. When the request is plainly a typo or a one-line text edit, say so once ("`/muffy fix` is cheaper") and carry on as asked
   **A named mode** (`/muffy todo | onboard | present | diagram`, or a request that can only mean one of them: "find what is half done", "make a deck for the client", "draw the deployment diagram") → that mode. A diagram request first passes the two checks in [diagram.md](diagram.md#before-the-scope-question): the subject has an open task → **diagram-in-task**; the subject is not designed yet → the kind's own route (**spec** for architecture, deployment, erd, state and flow; **design** for a screen map; **plan** for a gantt or story map), with the diagram as its stop point ([kinds table](diagram.md#kinds-fixed-never-ask-the-user-to-pick-an-agent))
3. **A question** about the code or the repo ("how does X work?", "X ทำงานยังไง") → none
4. **A stated stop point** ("just the design", "plan it, don't build", "research, no code", "ยังไม่ต้องเขียนโค้ด", "แค่รีวิว") → the route for that stop point, even when the request also names a feature
5. **The outcome is not a code change** (a brief, a plan, a design, a design review, a contract, an architecture review, an ADR, a review verdict, tests, a branch reviewed and tested before merge, docs, a deployment) → that route from the table below
6. **The outcome is a code change:**
   1. Text only, one line, nothing renders or behaves differently (typo, comment, a copy string) → none
   1b. A version bump of a dependency or runtime already in the manifest ("อัปเกรด React เป็น 19", "bump Node to 22") → upgrade ([upgrade-profile.md](upgrade-profile.md)); a dependency the project does not have yet goes on down this list (full flow)
   2. A bug report (something that worked or should work does not) → fix triage ([fix-profile.md](fix-profile.md)): fix, full, or ask first
   3. Internal work, nothing a user or outside caller sees except speed → change triage, `internal` scope ([change-profile.md](change-profile.md#the-internal-scope)): change, full, or ask first
   4. A change to a screen, UX flow or business-logic rule the product already has, not a bug and not a new capability → change ([change-profile.md](change-profile.md)); its visible scope (the look, the look and the rules, the rules only) is always asked
   5. A new capability the product lacks ("build X", "add X") → full flow
   6. Anything else → step 7
7. **Two routes fit, or the prompt is too vague to tell** → ask in rounds of one `AskUserQuestion` until one route fits. Each question cuts the candidates; options run smallest route first, full flow last. "ทำเลย" or "แล้วแต่" means the smallest route that fits, never full flow. Never guess a route that writes code. For a code change, ask in the requester's words, never with lane names, in this order, stopping once one fits:
   1. "มีอะไรพังหรือทำงานผิดอยู่ไหม / Is something broken or wrong?" yes → fix triage
   2. "ของนี้มีอยู่แล้ว หรือเป็นของใหม่ / Does this exist already, or is it new?" new → full flow
   3. "ผู้ใช้จะเห็นอะไรเปลี่ยนไหม / Will a user see anything change?" nothing → change triage, scope `internal`; the screens → change, scope `ui-only` or `ui+logic`; only the rules or results → change, scope `logic-only`

After the route is picked, check its minimum intake (below). A missing fact is asked before any spawn.

## Say the plan

The requester sees what will happen before the first spawn:

- **A lane** (fix, change, verify, upgrade, full flow): `node "<muffy>/scripts/next-action.mjs" plan-card <lane> [--scope <scope>] [--until <step>] [--skip 3d] [--lang en]` prints the card from `lanes.mjs`: what is being done, the steps in order, what is skipped and why, where it stops. Thai by default; `--lang en` for an English request. Change: an internal triage has its scope; a visible change asks its scope first, on its own ([change-profile.md](change-profile.md)), then the card with `--scope`
- The card's question rides in the lane's `pause:scope` call as its first question, so it costs no extra round: **go (recommended)** / **bigger or smaller** (the next route up or down: fix ↔ change ↔ full flow; upgrade ↔ full flow; verify ↔ review or qa), and on the full-flow card **stop earlier** (the plan or the design route: [Stop points](#stop-points)). Any pick but go re-routes before anything is spawned: drop the task's row from `project.md` → `## Tasks` and its task note, then run the new route's setup
- **A single-step route or a mode**: one line in the same shape, from its Routes row: what, who in plain words, where it stops ("รีวิว PR #42: code-reviewer อย่างเดียว · หยุดที่: ผลรีวิวในแชท"). No question; the requester can still override
- `route: <name>` still goes in checkpoint `## Status` ([memory-model.md](memory-model.md#checkpoint))

## Stop points

A stated stop point (decision order step 4) picks the route. Most are single-step routes that run only their own agents, so their card is the one line from their Routes row; a stop inside a lane (diagnose only) is that lane's card with `--until`, and the lane line carries it (`checkpoint.mjs profile … --until <step>`). The requester never has to know the route's name. "Stop earlier" on a full-flow card re-routes to one of these.

| The requester says | Stops at | Route | Card |
|---|---|---|---|
| แค่วางแผน / plan it, don't build | the AC and plan, approved | plan | one line |
| แค่ออกแบบหน้าจอ / just the screens | the design, approved | design | one line |
| ยังไม่ต้องเขียนโค้ด / no code yet | the design or the contract, approved, by what the request names | design or spec | one line |
| แค่ API / schema | `contract.md` | spec | one line |
| แค่วิจัย / research only | the research brief | research | one line |
| แค่รีวิว / just review it | the review verdict | review or design-review | one line |
| แค่หาสาเหตุ / just find the cause, don't fix it | the audited cause in `fix.md` | fix | fix `--until 4b` |

## Words that point to more than one route

The verb alone never decides. Read the object of the verb, then use the tie-break. Thai first, since most prompts are Thai.

| Words | Object | Route | Tie-break when the object is missing or vague |
|---|---|---|---|
| ออกแบบ / design | หน้าจอ, flow, UI, wireframe | design | — |
| ออกแบบ / design | API, schema, ฐานข้อมูล, data model | spec | — |
| ออกแบบระบบ / design the system | a whole feature, no stop point | ask | Ask: "screens, API/schema, or build it?" with design, spec, full flow as options |
| redesign / ออกแบบใหม่ / ปรับหน้า / แก้ flow | an existing page, flow or rule | change | Scope is always asked. Stop point "just the design" → design |
| รีวิว / review / เช็ค / check | PR, branch, diff, โค้ด | review | No PR or branch named → ask for it. Review **and test** it before merge ("ตรวจให้ครบ", "รีวิวและเทส") → verify |
| ตรวจให้ครบ / รีวิวและเทส / review and test / check before merge | a branch someone wrote | verify | Just the review → review; just tests → qa |
| อัปเกรด / upgrade / bump / update | a package, runtime or image version already in the manifest | upgrade | Not in the manifest yet → full flow (a new dependency) |
| รีวิว / review | ดีไซน์, หน้าจอ, canvas, UX | design-review | No URL, canvas or screen named → ask for it |
| รีวิว / review | architecture, ADR, contract, สถาปัตยกรรม | arch-review | — |
| แก้ / fix / ปรับ | something broken, an error, a wrong result | fix triage | No symptom or no place → ask (fix triage) |
| แก้ / ปรับ / change | wording only (typo, label text) | none | — |
| แก้ / ปรับ / change | look (colour, spacing) with existing tokens | fix triage (cosmetic) | — |
| ปรับ / refactor / แยก / split | a named module, nothing visible changes | change triage (internal) | — |
| ทำให้เร็วขึ้น / faster / optimise | a named query, endpoint or page | change triage (internal) | No before-number → ask for the measurement, offering to measure it first ([change-profile.md](change-profile.md#the-internal-scope)) |
| เขียน / write | test, เทสต์ | qa | — |
| เขียน / write | docs, README, คู่มือ | docs (a change) or docs-existing (code as it is) | Ask: "for a recent change, or the code as it is?" |
| เขียน / write | ADR, บันทึกการตัดสินใจ | adr | — |
| สร้าง / วาด / ขอ / draw | any diagram (ERD, architecture, deployment, flow, state, screen map, gantt, story map) of something that exists | diagram | The subject has an open task → diagram-in-task |
| สร้าง / วาด / ออกแบบ | ERD, architecture, deployment, flow or state of something not designed yet | spec | Not sure it exists → check the repo (code, schema, migration, contract) before asking |
| สร้าง / วาด | screen map of an app whose screens are not designed yet | design | — |
| สร้าง / วาด | gantt, timeline, story map of work not planned yet | plan | — |
| ทำ / สร้าง / build / add | a capability the product lacks | full flow (or change or fix by triage) | It exists already → change; unclear → ask |
| วางแผน / plan | a feature or a roadmap | plan | — |
| วิจัย / หาข้อมูล / compare | options, libraries, competitors | research | — |
| deploy / ขึ้น / rollback | staging, production, a version | none | The skill never deploys: say so, point to the task's Deploy hand-off |

## Minimum intake (ask before spawning)

Each route needs a few facts before any agent starts. Most under-specified prompts miss exactly these, and the missing facts are what cause repeated re-prompting later. If the prompt does not give one of them, ask all the missing ones together in one `AskUserQuestion` (up to 4 questions), then route.

| Route | Must be known before spawning | Missing → ask |
|---|---|---|
| fix | symptom, plus a location or a way to reproduce | what happens, and where or how to trigger it |
| change | internal: the goal, the named area (module, endpoint, table or query), and for performance work a measured before-number. Visible: the screen, flow or rule, and what should change | the missing one, in one question |
| full flow | the goal in one sentence and who it is for | requirements interview ([requirements.md](requirements.md)) |
| research | the question and the decision it feeds | the decision |
| plan | the goal and the stop point | the goal |
| design | which screens or flow, and "no code" or not | the screens or flow |
| design-review | what to look at: a canvas or Artifact URL, a running page URL, or screenshots | where the screens are |
| spec | the feature and who consumes the API or schema | the consumer |
| arch-review | the document or area: an ADR, `contract.md`, `baseline.md`, or a module path | which document or area |
| adr | the decision and whether it is product or technical ([adr-writing.md](adr-writing.md)) | the decision |
| ops | the local infra file or area (Dockerfile, compose, runtime pin, CI) and the change, or "does the stack still boot" (a smoke on this branch) | the file or area, or the branch |
| review | the diff: branch, PR or file list | the branch or PR |
| verify | the branch, its base, and what it should do (PR description or the request) | the branch, or what it should do |
| upgrade | the package or runtime, and the target version ("latest" if the requester accepts it) | the target version |
| qa | the branch and what to test | the branch |
| docs | the shipped change or its diff, and whether the diff is approved | the change |
| docs-existing | the area to document and the reader (user, developer, operator) | the reader |
| none | nothing | nothing |

## Routes

| The prompt asks for | Route | Agents, in order | Stops at |
|---|---|---|---|
| A question about the code or the repo ("how does X work?") | none | main session answers, reading with Grep/Read | the answer. No muffy |
| A text-only one-line edit (typo, comment, a copy string) | none | main session edits | the edit. No muffy |
| A bug or cosmetic fix with a symptom | fix ([fix-profile.md](fix-profile.md)) | `debugger` diagnoses, `auditor` checks the cause, then fix (FE and/or BE), `code-reviewer`, the test gate (a script), `docs-writer` after the gate | Human gate |
| Internal work with a known shape: an internal API, a refactor, a measured performance fix, an index or reversible migration, nothing a user sees ("split this module", "add an index, p95 is 1.8 s") | change ([change-profile.md](change-profile.md)) | scope `internal`: `architect`, frontend-dev ∥ backend-dev (backend-dev runs a migration up and down), code-reviewer, the test gate (a script), docs-writer after the gate | Human gate |
| A new capability across UI, API or data, "build X" | full flow ([steps.md](steps.md), [run-profile.md](run-profile.md)) | researcher, product-manager, designer ∥ architect, frontend-dev ∥ backend-dev, code-reviewer, the test gate (a script), docs-writer after the gate | Human gate |
| A change to an existing screen, UX flow or business-logic rule ("redesign the dashboard", "ปรับ flow สมัครสมาชิก") | change ([change-profile.md](change-profile.md)) | a visible scope: `product-manager`, `designer` and/or `architect`, `frontend-dev` and/or `backend-dev` by the scope asked, `code-reviewer`, `qa-tester` on touched paths, `docs-writer` after the gate | Human gate |
| Compare options, "what is the best library", "what do competitors do" | research | `researcher` (L0-L2 by the question's depth) | the research brief, in chat. Saved to `docs/research/<slug>.md` only if asked |
| User stories, acceptance criteria, a phased plan, priorities | plan | `researcher` only if facts are missing, then `product-manager` | `ac.md` and the plan, for the requester to approve |
| Screens, user flow, wireframes, UI states, design only | design | `designer` (plus `architect` if the screens need an API the requester has not defined) | the design canvas, at the design gate. Code is not written |
| A UX/UI review of screens that already exist (a canvas, a running page, screenshots) | design-review | main session with the `impeccable` skill, following [design-review.md](design-review.md) steps 2-4 on the given screens | findings in chat (`UX-<n>`, severity, suggested fix). No file changes; fixes are a design or fix route the requester picks |
| API, schema, contract or data model only | spec | `architect` | `contract.md`. No code |
| A review of an architecture, an ADR, a contract or a module's design | arch-review | `architect`, read-only ("Review only" in the prompt) | findings in chat. A changed decision is a new ADR only if the requester then asks for one |
| Write or supersede an ADR | adr | `architect` (technical) or `product-manager` (product), per [adr-writing.md](adr-writing.md) | the new `docs/adr/NNNN-*.md`, committed on the requester's go-ahead |
| Bump a dependency or runtime already in the manifest, and fix what breaks | upgrade ([upgrade-profile.md](upgrade-profile.md)) | `researcher` (changelog), `architect` (upgrade ADR), the user approves the ADR, devs (backend-dev boots the stack on the new version), `code-reviewer`, the test gate (a script), `docs-writer` after the gate | Human gate |
| Review and test a branch someone already wrote, and accept it before merge | verify ([verify-profile.md](verify-profile.md)) | `code-reviewer`, the test gate (a script), Human gate, `docs-writer`, on a copy `verify/<task>`; a reject is reported and fixed on the copy only if the requester says so | Human gate |
| Local infra files: Dockerfile, compose, runtime pin, CI config; or "does the stack boot on this branch" | ops | `backend-dev` (`devops` is retired; local only: writes or checks the Dockerfile, compose, runtime pin or CI config and boots the stack on docker local on that branch) | the infra change, checked on docker local. It never deploys; a deploy request is answered with the Deploy hand-off |
| Review an existing diff, branch or PR, "is this safe", "check my change" | review | `code-reviewer` (read-only) | the verdict in chat, saved as `review-<n>.md` only inside a task. No fixes |
| Write or run tests, QA, regression on a branch | qa | no agent (`qa-tester` is retired): run `node "<muffy>/scripts/test-gate.mjs" .team/<task> --cwd <worktree>` | `qa-report.md` from the project test command. No production code change. Regression beyond that is the human's |
| API docs or release notes for a change | docs | `docs-writer`, then `code-reviewer` on the docs | the reviewed docs. If the diff is not yet approved, route to review first |
| README, a guide or API docs for code as it already is (no new change) | docs-existing | `docs-writer` ("Docs for existing code" in the prompt), then `code-reviewer` on the docs | the reviewed docs |
| A standalone diagram of something that already exists, with no open task | diagram | per [diagram.md](diagram.md) | the diagram file |
| A diagram of a feature whose task is still open | diagram-in-task | the task's owner of that kind specs it (`architect`; `product-manager` for gantt and story map; `designer` for the screen map), `diagrammer` draws, step 3e publishes ([diagram.md](diagram.md#inside-an-open-task)) | the diagram, recorded in that task; the task's next step is unchanged |
| A deck or presentation for a client or end-users | present | per [present.md](present.md) | the deck |
| Find unfinished tasks in `.team` | todo | per [todo.md](todo.md) | the list of not-done tasks |
| First run on an existing codebase | onboard | per [onboard.md](onboard.md) | `baseline.md` and ADR, after review |
| Continue earlier work ("continue", "resume") | resume | per [resume.md](resume.md) | the next step in `checkpoint.md` |

## Rules

- **Smallest route that delivers the outcome.** "Plan it" stops at the plan. "Review this branch" is `code-reviewer` alone, not the full flow. Escalate to a bigger route only when the prompt asks for the later step.
- **Code always carries the gates.** Any route that writes code keeps review, QA and the Human gate. A design-only, spec-only, research-only or review-only route writes no code, so it does not start the team flow.
- **None or fix.** The main session edits only text that renders the same way (a typo, a comment, a copy string). A change to how something looks or behaves, even one line (a colour, a spacing value, a condition), goes through fix triage, because it needs a visual check or a regression test.
- **Single-agent routes are real runs.** Spawn the agent fresh with the request verbatim, the route's stop point and the commit trailer. It still ends with a hand-off block that is validated. Create `.team/<task>/` only when the route writes a repo file that belongs to a task (`ac.md`, `contract.md`, `qa-report.md`, `review-<n>.md`); otherwise the agent's output goes to the requester in chat.
- **Mixed prompts.** "Fix this bug and also plan the next feature": split at the outcome. Run the fix lane and keep the plan as a separate task (`pause:scope` cuts out the extra work, see [fix-profile.md](fix-profile.md)).
- **Missing inputs for the route.** A bug with no symptom or location, or a review with no diff or branch, asks for that one thing before routing. A feature with no goal asks through the requirements interview ([requirements.md](requirements.md)).
- **Standalone agents never run the full flow to answer a small question.** If the requester only wants an answer, answer it.

## Examples

Worked prompts for every route, one table, also scenarios in `evals/route-scenarios.json`: [route-examples.md](route-examples.md). Open it only when two routes still fit after the decision order, or the prompt matches no row above; a clear prompt (a named mode, a bug with a symptom, a question) never needs it.
