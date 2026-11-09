# Presentation design (present mode)

Read this only when the prompt says "Design deck: `<output folder>`". The product-manager (present mode) has written the content (`deck.json`, `outline.md`, confirmed by the requester); you turn it into a deck that looks and moves like a real slide show, at the standard of a hand-built keynote: one slide at a time, a drawing-sheet frame, a large display headline with one accent word, floating cards laid out for that slide, connectors that flow, a lower-third caption. The requester reviews it; no other agent does.

The workflow, canvas and per-screen rules in [workflow.md](workflow.md) don't apply here. Your guardrails and write scope do.

## Inputs

- `<output>/deck.json`: the content. Read it in full; it is your only source of words and numbers
- `<output>/outline.md`: the brief at its top (audience profile, goal, setting) and the speaker notes
- `docs/design-system/` (tokens and README) when it exists: colors, fonts, radius, and the `## Presentation` section if you wrote one before
- `<muffy>/templates/presentation-stage.html`: the frame you start from
- `<muffy>/templates/presentation.html` (optional): renders `deck.json` as a plain scrolling preview, handy for reading the content in order; it is not the design

## Build `<output>/deck.html`

1. **Copy the stage.** Keep the frame: viewport and stage, corner ticks, the sheet label, progress bar, caption, controls, the script, and the `#deck` block. Paste `deck.json` into `#deck` unchanged (the stage reads narration and durations from it)
2. **Set the look from the design system.** Map its tokens onto the stage variables (`--paper`, `--ink`, `--muted`, `--accent`, `--accent-soft`, `--card`, `--card-line`, `--good`, `--bad`, `--font-d` display, `--font-b` body, `--font-m` mono), light and dark. Fonts: the families the design system names; load them from Google Fonts with the `<link>` the stage shows, and always keep a system fallback in the stack. No design system → keep the stage's defaults. Record the mapping in the design system's `## Presentation` section so the next deck starts from it
3. **One `<section class="slide">` per slide, in order.** Write the text as static HTML (not built by script), so it can be checked and printed
4. **Lay out each slide for its content.** The slide's `type` tells you what it holds, not how it must look:
   - `title`: a very large display headline, the subtitle beside or under it, room to breathe
   - `kicker` → the `.kicker` line above the headline; `*word*` in a headline → `<em>word</em>` (the accent colour); drop the asterisks everywhere else
   - `features`: cards in a grid or in a composition that shows their relation (around a hub, in rows by group); tags as `.tag`
   - `steps` with `groups`: a flow with nodes per group and connectors (`svg.lines` with `.flow`), the requester's gates or key steps marked
   - `diagram`: positioned node cards joined by SVG lines that flow
   - `comparison`: a two-column table or paired cards, the recommended side marked
   - `chart`, `metric`: draw the chart in SVG from the series exactly; the highlighted category in `--accent`, the rest muted
   - `statement`, `section`: one sentence, very large, little else
   - `cta`: the ask large; next steps as numbered cards
5. **Motion with meaning.** `.pop` with `--i` for the order things appear (headline first, then items in reading order); `.float` on a few cards, not all; `.flow` on connectors. Everything must work with reduced motion (the stage turns animation off) and in print (each slide a finished page)
6. **Check:** `node "<muffy>/scripts/check-presentation.mjs" <output>`. Fix every FAIL

## Rules

- **Words and numbers come only from `deck.json`.** Every slide's headline appears word for word in its slide. You may split text across lines, shorten nothing, add no claim, label, number, date or name. Decorative text (the sheet label, "01 / 11") is the frame's, not yours. The check fails a number on a slide that `deck.json` doesn't hold
- **No images, video or iframes.** Illustrate with inline SVG and CSS shapes (icons, schematic people, screens, devices). No stock photos
- **Outside requests: Google Fonts only.** No CDN scripts, no remote images
- **Legibility first.** Text ≥ 20px on the 1920×1080 stage, contrast that passes in both themes, nothing overlapping the caption band (bottom 120px) on slides with narration
- **Background:** `read-alone` decks keep the grid faint or off behind text (plain grounds read fastest); `live` decks may use the drifting grid
- Your `outline.md` and `deck.json` are read-only; content changes go back to the product-manager through the Orchestrator

## Hand-off

Status `done` with `paths_written` (`deck.html`, and the design system README if you added `## Presentation`). Final message: the layout choices worth knowing (one line per slide at most), the fonts and whether they load from Google Fonts, and anything in `deck.json` you could not fit without changing it (too long for its slide, a missing label). Put that in `summary` too: the Orchestrator sends it to the product-manager, who changes the content, and you lay it out again.
