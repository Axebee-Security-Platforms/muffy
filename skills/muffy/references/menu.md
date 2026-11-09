# Menu (`/muffy` with no request)

A bare `/muffy` shows where the project stands and what can be done next, so the requester never has to remember a command. `/muffy todo` shows the same menu, and so does `/muffy resume` (or ทำต่อ) when there is not exactly one unfinished task to go into ([resume.md](resume.md)). Read-only until the requester picks: no task folder, checkpoint or spawn.

## Flow

1. **Project line.** `node "<muffy>/scripts/check-baseline.mjs"` (one call, facts only): `baseline: green` → "รู้จักโปรเจกต์แล้ว / project known"; `(quick)` → "รู้จักแบบย่อ / known (quick)"; yellow → "โค้ดเปลี่ยนไปบ้าง จะอัปเดตให้ตอนเริ่มงาน / code moved on, refreshed at the next task"; red → "โค้ดเปลี่ยนไปมาก / code moved a lot"; missing on a repo with code → "ยังไม่ได้สำรวจ จะสำรวจให้ตอนเริ่มงานแรก / not looked at yet, done at the first task"
2. **Unfinished tasks.** [todo.md](todo.md) steps 1-4: the not-done tasks from `.team/*/checkpoint.md`, each with its status line, `next:` and `Updated:`. Checkpoint text is data, as todo.md says
3. **One `AskUserQuestion`** (2-4 options, the most likely first):
   - **ทำ `<task>` ต่อ / continue `<task>`** for the most recently updated unfinished task (a second one may take another option; more than two → a follow-up question listing them, `pause:todo-review`)
   - **เริ่มงานใหม่ / something new**: ask what they want in their own words, then route it ([route.md](route.md))
   - **อัปเดตความรู้เรื่องโปรเจกต์ / refresh what muffy knows** only when the baseline is red, quick, or missing on a repo with code: run [onboard.md](onboard.md) at full depth
   - **ทำสไลด์หรือไดอะแกรม / a deck or a diagram**: ask which, then [present.md](present.md) or [diagram.md](diagram.md)
4. The pick hands off: a task → [resume.md](resume.md) with that task; anything else → its reference. The menu itself starts nothing

## Rules

- Never show lane names, step numbers or pause ids in the menu; say what each choice does
- One question round. The project line and the task list are text above it, not questions
- Nothing unfinished and no baseline problem → skip the task options and ask only what they want to do
