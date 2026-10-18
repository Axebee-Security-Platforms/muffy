# Present mode (`/muffy present "<request>"`)

On demand only, never a step of the team flow. The Orchestrator runs `product-manager` in present mode to write the content of a deck for a client or end-users from documents that already exist, then hands it to the requester to review. No other agent reviews it. Skips Analyze, Onboard, Setup and Run profile; needs no task folder.

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
2. **Spawn** `product-manager` fresh at effort `medium` with "Present deck: `<request>`" ([present/overview.md](../../../agents/references/product-manager/present/overview.md)) and: the request verbatim, the audience profile `{who, role, familiarity, cares, setting}`, sources, slug, output folder (`docs/presentations/<slug>/` unless the user names one), language, the design-system paths (`docs/design-system/tokens.css` and `README.md`) when they exist, `round: 1`, the commit trailer
3. **Missing documents.** Status `blocked` with blockers → follow [doc-request.md](doc-request.md): ask the requester once which documents to have written, spawn only the owners they approve (or add a path they give to the sources), relay owner questions, then `SendMessage` the product-manager "docs updated: <paths>" and "skipped: <B-n>"
4. **Outline gate.** Validate the hand-off (`validate-handoff.mjs`). Status `needs-input` → show the user `outline.md` (the path and its slide lines) and the questions; relay the answers with `SendMessage` to the same product-manager, with `round: 2`. Never build without the user's confirmation
5. **Check the content.** On status `done`: `node .claude/skills/muffy/scripts/check-presentation.mjs --content <output folder>`. A FAIL goes back to the product-manager once with the printed lines
6. **Design.** Spawn `designer` fresh with "Design deck: `<output folder>`", the design-system paths when they exist, and the commit trailer ([designer presentation.md](../../../agents/references/designer/presentation.md)). Then the full check: `node .claude/skills/muffy/scripts/check-presentation.mjs <output folder>`. A FAIL goes back to the designer once; a content problem the designer reports goes to the product-manager, then the designer lays it out again. Still failing → tell the user what failed and stop, never publish it
7. **Publish** `deck.html` as an Artifact (`icon: slides`; pass the earlier `url` on a later round so the link stays the same). Private; sharing is the user's call. The Artifact tool unavailable → give the file path instead
8. **Hand to the requester:** the Artifact link, the paths of `outline.md` and `data.csv` (for editing in Canva, Google Slides or PowerPoint), and every open `TBD` from the final message. Ask for notes
9. **Revision rounds.** Notes → `SendMessage` to the same product-manager with `round` + 1, content notes to the product-manager, then steps 5–8; notes only about the look go straight to the designer (`SendMessage`), then steps 6–8. No round limit; stop when the user is satisfied
10. **Commit** on the user's go-ahead only: the output folder, with the commit trailer. Nothing else changes

## Rules
- The requester is the only reviewer. The product-manager and the designer build the deck; do not route it to code-reviewer or any other agent for review
- The product-manager never reads more than the confirmed sources; do not add paths to its prompt later without the user's OK
- The product-manager writes the content; the designer makes the deck look and move like a real slide show, from the project design system. Neither changes the other's files.
- No `.team/<task>/` folder, checkpoint or brain note is created for present mode
