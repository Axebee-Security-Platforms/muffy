# Route examples

Companion to [route.md](route.md), which holds the decision order. Read only to calibrate an unclear prompt.

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
| "วาด deployment diagram ของระบบตอนนี้" | diagram | Draw something that exists |
| "ขอ gantt ของแผน onboarding ที่ยังไม่ได้วางแผน" | plan | Not planned yet: the timeline is the plan to make |
| "วาด screen map ของแอปใหม่ที่ยังไม่มีหน้าจอ" | design | No screens yet: the map is design work |
| "วาด flow การ login ของ task sso ที่กำลังทำ" | diagram-in-task | The task is open: its contract is the source |
| "deploy ให้หน่อย" | ask first | No target; production is never assumed |
