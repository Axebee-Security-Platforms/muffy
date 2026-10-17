# Visual Style

The look and motion are fixed by `.claude/skills/muffy/templates/presentation.html` and match the diagrams ([diagram-style.md](../../../skills/muffy/references/diagram-style.md)), so a deck and a diagram read as one set. You never write CSS or markup: you choose the content, the template does the rest. Colors, font and radius come from the design system through `#theme` ([workflow.md](workflow.md) step 9).

## What the template does
- **Surface:** blueprint grid paper on every slide, tinted from the theme's text color; calm and minimal
- **Floating cards:** roadmap cards, metric values and the caption sit on cards with a soft drop shadow
- **Motion:** when a slide comes into view it settles in, then its parts rise one after another (headline, then items in order). Chart bars grow from the axis, a line chart draws in, timeline track draws left to right
- **Connectors:** `diagram` edges draw in with an arrowhead, then carry a slow flowing pulse
- **Lower third:** an optional `caption` on any slide shows as one bold sentence on a floating card at the bottom center
- **Navigation:** arrow keys, Page Up/Down and Space move between slides; `f` goes fullscreen
- **Accessibility and print:** users who prefer reduced motion get static, fully visible slides; printing or saving as PDF shows every slide finished, one per page

## Background

`deck.json` `background` is one of `blueprint` (the grid), `plain` (flat surface) or `soft` (a light accent wash). No source ties a background to an audience type; the only evidence is about legibility: plain grounds read faster than textured ones, and what people prefer doesn't predict reading speed ([research](../../../docs/research/presentation-audiences.md) §4.3). So the choice follows the setting, and the rest is house style:

| Setting | Background | Why |
|---|---|---|
| `read-alone` | `plain` | ✅ No presenter to direct attention; legibility first |
| `live` | `blueprint`, `soft` or `plain` | ⚠️ House style: `blueprint` matches the diagrams; `soft` is a warmer tone, often picked for `use` / `informed` decks; `plain` when the slides carry dense numbers |

State the choice and its reason in the brief at the top of `outline.md`.

## What you decide
- **Order of items** is the order they appear: put the point that matters first in a list, the recommended option where the eye lands, the key edge first in `edges`
- **`caption`** (optional, ≤ 120 characters, one sentence): the line you want the audience to remember from that slide, when the headline alone doesn't carry it. Use it on 1 slide in 3 at most; a caption on every slide is noise. A number in a caption needs the slide's `source`
- **No decoration for its own sake:** no emoji as icons, no extra slides to "show off" motion. Motion supports the explanation; it never carries information on its own, since a printed deck has none
- **No images or stock footage** (photos of people coding, desks, offices): they show how the team works, which the audience doesn't need, and their license can't be checked. If the requester wants an image, say in the final message that v1 decks take none
