# Present mode (`/muffy present "<request>"`)

On demand only, never a step of the team flow. The Orchestrator runs the `presenter` agent to build a deck for a client or end-users from documents that already exist, then hands it to the requester to review. No other agent reviews it. Skips Analyze, Onboard, Setup and Run profile; needs no task folder.

## Procedure
1. **Scope, one question round.** Always ask the five audience questions below, in this order, even when the request seems to answer them. Ask in the requester's language, word for word as written here: no explanation after the question, no system terms (`role`, `setting`). Who comes first because its answer suggests the rest: put the option the request or the "who" answer points to first, marked "(recommended)", and let the user confirm. Map each answer to the profile value yourself.

   | # | Question (TH / EN) | Options → profile value |
   |---|---|---|
   | 1 | ผู้ฟังคือใคร / Who are they? | free text → `who` |
   | 2 | ดูจบแล้ว ผู้ฟังต้องทำอะไร / What should they do after? | ตัดสินใจ / Decide → `decide`; ประเมินให้คนตัดสิน / Advise the decider → `evaluate`; ใช้งาน / Use it → `use`; ดูแลระบบ / Run or support it → `operate`; แค่รับทราบ / Just know → `informed` |
   | 3 | รู้เรื่องนี้แค่ไหน / How much do they know? | ไม่รู้เลย / Nothing → `none`; รู้บ้าง / Some → `some`; รู้ลึก / A lot → `deep` |
   | 4 | เขาสนใจเรื่องอะไรที่สุด / What matters most to them? | ราคา / Cost; เวลา / Time; ความเสี่ยง / Risk; ใช้ง่าย / Ease; อะไรเปลี่ยน / What changes; pick one or two → `cares` |
   | 5 | นำเสนอเอง หรือส่งให้อ่าน / Presenting, or sending it? | นำเสนอเอง / Presenting → `live`; ส่งให้อ่าน / Sending → `read-alone` |

   A mixed audience: question 2 is about the main group; the others go in `who`. In the same round, fill the rest from the request and ask only what it does not say: goal (what the audience should think, decide or do), sources (paths), slug, language, length. All questions at once. Sources: suggest the likely ones (`docs/strategy.md`, the ADRs under `docs/adr/`, a task's `release-notes.md`, files the user attached) and let the user confirm; never pass code, diffs, contracts, hand-offs or review files. No source exists → stop and say which document is missing
2. **Spawn** `presenter` fresh (model and effort from its frontmatter) with: the request verbatim, the audience profile `{who, role, familiarity, cares, setting}`, sources, slug, output folder (`docs/presentations/<slug>/` unless the user names one), language, the design-system paths (`docs/design-system/tokens.css` and `README.md`) when they exist, `round: 1`, the commit trailer
3. **Outline gate.** Validate the hand-off (`validate-handoff.mjs`). Status `needs-input` → show the user `outline.md` (the path and its slide lines) and the questions; relay the answers with `SendMessage` to the same presenter, with `round: 2`. Never build without the user's confirmation
4. **Check.** On status `done`: `node .claude/skills/muffy/scripts/check-presentation.mjs <output folder>`. A FAIL goes back to the presenter once with the printed lines; still failing → tell the user what failed and stop, never publish it
5. **Publish** `deck.html` as an Artifact (`icon: slides`; pass the earlier `url` on a later round so the link stays the same). Private; sharing is the user's call. The Artifact tool unavailable → give the file path instead
6. **Hand to the requester:** the Artifact link, the paths of `outline.md` and `data.csv` (for editing in Canva, Google Slides or PowerPoint), and every open `TBD` from the final message. Ask for notes
7. **Revision rounds.** Notes → `SendMessage` to the same presenter with `round` + 1, then steps 4–6 again. No round limit; stop when the user is satisfied
8. **Commit** on the user's go-ahead only: the output folder, with the commit trailer. Nothing else changes

## Rules
- The requester is the only reviewer. Do not route the deck to code-reviewer, product-manager or any other agent
- The presenter never reads more than the confirmed sources; do not add paths to its prompt later without the user's OK
- The deck's look comes from the project design system (`#theme`, set by the presenter, checked against `tokens.css`). The designer is not spawned per deck; a missing or wrong `## Presentation` mapping is a design-system change the user asks the designer for
- No `.team/<task>/` folder, checkpoint or brain note is created for present mode
