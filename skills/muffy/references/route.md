# Route — pick the entry and the agents from the prompt

Runs first, on every request, before any other reference. The Orchestrator reads the requester's prompt and picks the smallest route that delivers the outcome they asked for. It then says the route in one line before spawning anything: `Route: <name> → <agents>. Because: <the words in the prompt that decided it>.` The requester can override it.

The route is decided by the **outcome asked for**, not by a single keyword. "Bug" alone does not make a fix, "review" alone does not make a review-only run, "ออกแบบ" alone does not make a design run; the decision order below decides.

## Decision order

Walk it top to bottom and stop at the first step that answers. The fix and lite lanes keep their own triage; this order only decides which triage runs.

1. **Continue earlier work** ("continue", "resume", ทำต่อ) → resume
2. **A named mode** (`/muffy analyze | onboard | present | diagram`, or a request that can only mean one of them: "find what is half done", "make a deck for the client", "draw the deployment diagram") → that mode. A diagram request first passes the two checks in [diagram.md](diagram.md#before-the-scope-question): the subject has an open task → **diagram-in-task**; the subject is not designed yet (no schema, migration, model or code) → **spec**, with the diagram as its stop point
3. **A question** about the code or the repo ("how does X work?", "X ทำงานยังไง") → none
4. **A stated stop point** ("just the design", "plan it, don't build", "research, no code", "ยังไม่ต้องเขียนโค้ด", "แค่รีวิว") → the route for that stop point, even when the request also names a feature
5. **The outcome is not a code change** (a brief, a plan, a design, a design review, a contract, an architecture review, an ADR, a review verdict, tests, docs, a deployment) → that route from the table below
6. **The outcome is a code change:**
   1. Text only, one line, nothing renders or behaves differently (typo, comment, a copy string) → none
   2. A bug report (something that worked or should work does not) → fix triage ([fix-profile.md](fix-profile.md)): fix, full, or ask first
   3. Internal work, nothing a user or outside caller sees except speed → lite triage ([lite-profile.md](lite-profile.md)): lite, full, or ask first
   4. Anything else → full flow
7. **Two routes still fit** → one `AskUserQuestion` with the candidate routes as options, the smaller first. Never guess a route that writes code

After the route is picked, check its minimum intake (below). A missing fact is asked before any spawn.

## Words that point to more than one route

The verb alone never decides. Read the object of the verb, then use the tie-break. Thai first, since most prompts are Thai.

| Words | Object | Route | Tie-break when the object is missing or vague |
|---|---|---|---|
| ออกแบบ / design | หน้าจอ, flow, UI, wireframe | design | — |
| ออกแบบ / design | API, schema, ฐานข้อมูล, data model | spec | — |
| ออกแบบระบบ / design the system | a whole feature, no stop point | full flow | Ask: "screens, API/schema, or build it?" with design, spec, full flow as options |
| รีวิว / review / เช็ค / check | PR, branch, diff, โค้ด | review | No PR or branch named → ask for it |
| รีวิว / review | ดีไซน์, หน้าจอ, canvas, UX | design-review | No URL, canvas or screen named → ask for it |
| รีวิว / review | architecture, ADR, contract, สถาปัตยกรรม | arch-review | — |
| แก้ / fix / ปรับ | something broken, an error, a wrong result | fix triage | No symptom or no place → ask (fix triage) |
| แก้ / ปรับ / change | wording only (typo, label text) | none | — |
| แก้ / ปรับ / change | look (colour, spacing) with existing tokens | fix triage (cosmetic) | — |
| ปรับ / refactor / แยก / split | a named module, nothing visible changes | lite triage | — |
| ทำให้เร็วขึ้น / faster / optimise | a named query, endpoint or page | lite triage | No before-number → ask for the measurement |
| เขียน / write | test, เทสต์ | qa | — |
| เขียน / write | docs, README, คู่มือ | docs (a change) or docs-existing (code as it is) | Ask: "for a recent change, or the code as it is?" |
| เขียน / write | ADR, บันทึกการตัดสินใจ | adr | — |
| สร้าง / วาด / draw | ERD, flow, state, diagram of something that exists | diagram | The subject has an open task → diagram-in-task |
| สร้าง / ออกแบบ | ERD, data model of a feature not designed yet | spec | Not sure it exists → check the repo for its schema, migration or model before asking |
| ทำ / สร้าง / build / add | a feature | full flow (or lite or fix by triage) | — |
| วางแผน / plan | a feature or a roadmap | plan | — |
| วิจัย / หาข้อมูล / compare | options, libraries, competitors | research | — |
| deploy / ขึ้น / rollback | staging, production, a version | ops | No target named → ask; production is never assumed |

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
| design-review | what to look at: a canvas or Artifact URL, a running page URL, or screenshots | where the screens are |
| spec | the feature and who consumes the API or schema | the consumer |
| arch-review | the document or area: an ADR, `contract.md`, `baseline.md`, or a module path | which document or area |
| adr | the decision and whether it is product or technical ([adr.md](adr.md)) | the decision |
| ops | the target (staging or production) and the action | the target. Production is never assumed |
| review | the diff: branch, PR or file list | the branch or PR |
| qa | the branch and what to test | the branch |
| docs | the shipped change or its diff, and whether the diff is approved | the change |
| docs-existing | the area to document and the reader (user, developer, operator) | the reader |
| none | nothing | nothing |

## Routes

| The prompt asks for | Route | Agents, in order | Stops at |
|---|---|---|---|
| A question about the code or the repo ("how does X work?") | none | main session answers, reading with Grep/Read | the answer. No muffy |
| A text-only one-line edit (typo, comment, a copy string) | none | main session edits | the edit. No muffy |
| A bug or cosmetic fix with a symptom | fix ([fix-profile.md](fix-profile.md)) | diagnose and fix (FE and/or BE), `code-reviewer`, `qa-tester`, `devops` staging | Human gate |
| Internal work with a known shape: an internal API, a refactor, a measured performance fix, an index or reversible migration, nothing a user sees ("split this module", "add an index, p95 is 1.8 s") | lite ([lite-profile.md](lite-profile.md)) | `architect` (+ devops for a migration), frontend-dev ∥ backend-dev, code-reviewer, qa-tester, devops staging | Human gate, then production |
| A new feature or behaviour change across UI, API or data, "build X" | full flow ([steps.md](steps.md), [run-profile.md](run-profile.md)) | researcher, product-manager, designer ∥ architect ∥ devops, frontend-dev ∥ backend-dev, code-reviewer, qa-tester ∥ docs-writer, devops | Human gate, then production |
| Compare options, "what is the best library", "what do competitors do" | research | `researcher` (L0–L2 by the question's depth) | the research brief, in chat. Saved to `docs/research/<slug>.md` only if asked |
| User stories, acceptance criteria, a phased plan, priorities | plan | `researcher` only if facts are missing, then `product-manager` | `ac.md` and the plan, for the requester to approve |
| Screens, user flow, wireframes, UI states, design only | design | `designer` (plus `architect` if the screens need an API the requester has not defined) | the design canvas, at the design gate. Code is not written |
| A UX/UI review of screens that already exist (a canvas, a running page, screenshots) | design-review | main session with the `impeccable` skill, following [design-review.md](design-review.md) steps 2–4 on the given screens | findings in chat (`UX-<n>`, severity, suggested fix). No file changes; fixes are a design or fix route the requester picks |
| API, schema, contract or data model only | spec | `architect` | `contract.md`. No code |
| A review of an architecture, an ADR, a contract or a module's design | arch-review | `architect`, read-only ("Review only" in the prompt) | findings in chat. A changed decision is a new ADR only if the requester then asks for one |
| Write or supersede an ADR | adr | `architect` (technical) or `product-manager` (product), per [adr.md](adr.md) | the new `docs/adr/NNNN-*.md`, committed on the requester's go-ahead |
| Deploy, rollback, infra, runtime pin, staging or production | ops | `devops` (check mode, or deploy mode after its gate) | the deploy result. Production only after the Human gate, never from this route alone |
| Review an existing diff, branch or PR, "is this safe", "check my change" | review | `code-reviewer` (read-only) | the verdict in chat, saved as `review-<n>.md` only inside a task. No fixes |
| Write or run tests, QA, regression on a branch | qa | `qa-tester` | `qa-report.md`. No production code change. Whole-system run needs `pause:full-regression` |
| API docs or release notes for a change | docs | `docs-writer`, then `code-reviewer` on the docs | the reviewed docs. If the diff is not yet approved, route to review first |
| README, a guide or API docs for code as it already is (no new change) | docs-existing | `docs-writer` ("Docs for existing code" in the prompt), then `code-reviewer` on the docs | the reviewed docs |
| A standalone diagram of something that already exists, with no open task | diagram | per [diagram.md](diagram.md) | the diagram file |
| A diagram of a feature whose task is still open | diagram-in-task | the task's `architect` (or `product-manager` for gantt and story-map) specs it, `designer` draws, step 3e publishes ([diagram.md](diagram.md#inside-an-open-task)) | the diagram, recorded in that task; the task's next step is unchanged |
| A deck or presentation for a client or end-users | present | per [present.md](present.md) | the deck |
| Find unfinished work in a repo or tracker | analyze | per [analyze.md](analyze.md) | the confirmed task list |
| First run on an existing codebase | onboard | per [onboard.md](onboard.md) | `baseline.md` and ADR, after review |
| Continue earlier work ("continue", "resume") | resume | per [resume.md](resume.md) | the next step in `checkpoint.md` |

## Rules

- **Smallest route that delivers the outcome.** "Plan it" stops at the plan. "Review this branch" is `code-reviewer` alone, not the full flow. Escalate to a bigger route only when the prompt asks for the later step.
- **Code always carries the gates.** Any route that writes code keeps review, QA, staging and the Human gate. A design-only, spec-only, research-only or review-only route writes no code, so it does not start the team flow.
- **None or fix.** The main session edits only text that renders the same way (a typo, a comment, a copy string). A change to how something looks or behaves, even one line (a colour, a spacing value, a condition), goes through fix triage, because it needs a visual check or a regression test.
- **Single-agent routes are real runs.** Spawn the agent fresh with the request verbatim, the route's stop point and the commit trailer. It still ends with a hand-off block that is validated. Create `.team/<task>/` only when the route writes a repo file that belongs to a task (`ac.md`, `contract.md`, `qa-report.md`, `review-<n>.md`); otherwise the agent's output goes to the requester in chat.
- **Mixed prompts.** "Fix this bug and also plan the next feature": split at the outcome. Run the fix lane and keep the plan as a separate task (`pause:scope` cuts out the extra work, see [fix-profile.md](fix-profile.md)).
- **Missing inputs for the route.** A bug with no symptom or location, or a review with no diff or branch, asks for that one thing before routing. A feature with no goal asks through the requirements interview ([requirements.md](requirements.md)).
- **Standalone agents never run the full flow to answer a small question.** If the requester only wants an answer, answer it.

## Examples

Every row is also a scenario in `evals/route-scenarios.json`; change both together.

| Prompt | Route | Why |
|---|---|---|
| "Submit on /contact returns 500 when message is empty. `TypeError at src/api/contact.ts:41`" | fix | Symptom, location, one file |
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
| "Fix the typo in the footer" | none | Text only, renders the same |
| "เจอบั๊ก แก้ไขให้หน่อย" | ask first | Bug report with no symptom or location |
| "ช่วยเช็คว่า PR นี้ปลอดภัยไหม" | ask first | A review, but no PR or branch named |
| "ช่วยรีวิว PR #42 ก่อน merge หน่อย" | review | Verdict on a named PR |
| "ทำระบบรีเซ็ตรหัสผ่านให้หน่อย" | full flow | Build a feature across UI, API and data |
| "ออกแบบหน้าจอให้ก่อน ยังไม่ต้องเขียนโค้ด" | design | Stop point: design, no code |
| "ออกแบบ API กับ schema สำหรับระบบคืนสินค้า" | spec | ออกแบบ + API/schema |
| "ออกแบบระบบแจ้งเตือนให้หน่อย" | ask first | ออกแบบระบบ with no stop point: screens, API or build |
| "รีวิวดีไซน์หน้า checkout ใน canvas นี้หน่อย https://claude.ai/artifact/abc" | design-review | รีวิว + ดีไซน์, the canvas is named |
| "ช่วยรีวิว ADR 0007 เรื่องเลือก queue หน่อย" | arch-review | รีวิว + ADR |
| "เขียน ADR ว่าเราเลือก Postgres แทน Mongo" | adr | A technical decision to record |
| "เขียน README ให้โมดูล billing ที่มีอยู่ สำหรับ dev ใหม่" | docs-existing | Docs for code as it is; reader named |
| "ปุ่ม Submit หน้า checkout สีผิดใน dark mode" | fix | A look that is wrong, existing tokens |
| "แยกไฟล์ src/billing/service.ts เป็นหลายโมดูล พฤติกรรมเหมือนเดิม" | lite | Refactor of a named area, nothing visible |
| "ทำให้ API เร็วขึ้นหน่อย" | ask first | No area and no measurement |
| "query หน้า orders ช้า p95 1.8 วิ ช่วยเพิ่ม index ให้หน่อย (แนบ EXPLAIN ANALYZE)" | lite | Named query with a before-number |
| "วางแผน roadmap ไตรมาสหน้าให้หน่อย" | plan | Outcome is a plan |
| "ทำต่อจากเมื่อวาน" | resume | Continue earlier work |
| "ทำสไลด์สรุปฟีเจอร์ login ให้ลูกค้า" | present | A deck for a client |
| "วาด ERD ของตารางที่มีอยู่ในโมดูล billing" | diagram | Draw something that exists, no open task |
| "สร้าง ERD ของ feature คูปองที่ยังไม่ได้เริ่มทำ" | spec | Not designed yet: the ERD is the data model to design |
| "สร้าง ERD ของ task coupon ที่กำลังทำอยู่" | diagram-in-task | The task is open: its contract is the source |
| "deploy ให้หน่อย" | ask first | No target; production is never assumed |
