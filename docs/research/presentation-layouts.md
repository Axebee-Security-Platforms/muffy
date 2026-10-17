# Presentation Layout Patterns for Client and End-User Decks

Research for the `presenter` agent (template: `skills/muffy/templates/presentation.html`; types: `agents/references/presenter/slide-types.md`). Researched 2026-10-17.

Constraints this is judged against: no images or stock footage, every number traces to a source document, self-contained HTML/SVG, headline = takeaway sentence.

Source strength: **[P]** = primary (the author's or owner's own site, paper or API docs). **[S]** = secondary or not checked against the primary. **[U]** = could not check at all.

## 1. Summary

- **Keep the headline rule. Back it with evidence.** Alley's controlled study found that sentence headlines plus visual evidence beat topic headlines plus bullets on comprehension (p < .01) ([P] [Penn State research page](https://writing.engr.psu.edu/research.html)). Storytelling with Data argues the same: the title states the takeaway, not the topic ([P] [SWD, annotate with text](https://www.storytellingwithdata.com/blog/2015/02/annotate-with-text)). The rule muffy already has is the best-supported finding here. Make it stricter (section 4), and don't loosen it for any new type.
- **Add 1: `chart` annotation (`highlight` + `note`), not a new type.** Knaflic's most repeated advice is to state the takeaway in words and use colour sparingly to show where to look ([P] [SWD, power pairing](https://www.storytellingwithdata.com/blog/2019/7/10/power-pairing-color-words)). It costs little, needs no new data, and stops the chart from contradicting the headline.
- **Add 2: `section`.** Google Slides lists `SECTION_HEADER` as a predefined layout ([P] [Google Slides API](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/request#PredefinedLayout)). It carries no numbers, so it adds no sourcing risk, and it gives longer decks the structure of Minto's pyramid ([P] [barbaraminto.com/concept](https://www.barbaraminto.com/concept)). Use it only in decks of 10 or more slides.
- **Add 3: `steps`.** A numbered process is the end-user's "what you need to do" slide. Today it is forced into `bullets` or `diagram`, and the Feature-intro recipe uses `bullets` for it. Steps are ordered by definition, carry few numbers, and suit an end-user audience.
- **Add 4: `statement`.** Google calls this layout `MAIN_POINT` ([P] [Google Slides API](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/request#PredefinedLayout)). Use it for Duarte-style turning points between "what is" and "what could be" ([P] [Duarte, contrast guide](https://www.duarte.com/blog/ultimate-guide-to-contrast/)). Cap it hard (one or two per deck), because a slide with no evidence breaks the assertion-evidence model if overused.
- **Add 5 (later): waterfall as `chart.kind`.** The FT Visual Vocabulary lists the waterfall under both Flow and Part-to-whole ([P] [FT Visual Vocabulary](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)). It is the honest answer to "how did we get from A to B" (budget, headcount, time saved). It needs the steps to sum exactly, which a checker can verify.
- **Defer `matrix` (2x2).** It is well established in consulting, e.g. the BCG growth-share matrix ([P] [BCG](https://www.bcg.com/about/overview/our-history/growth-share-matrix)). But item positions are usually judgment, not data, and that clashes with "every number traces to a source". Add it only with the honesty rules in section 3: defined axes, and a source per position or qualitative quadrants only.
- **Defer `features` / bento grid.** I found no primary source for the bento pattern as a presentation layout; it reads as a product-marketing trend ([S]). For client and end-user decks it overlaps `bullets`, `roadmap` cards and `metric`. Revisit if requesters ask for "what's included" slides. If added, it should be a 3–6 card grid with no icons, so it doesn't break the no-decoration rule.

## 2. Pattern catalogue

| Pattern | What it's for | Evidence / source | Fit with constraints | Maps to |
|---|---|---|---|---|
| Action title / sentence headline | The headline states the slide's conclusion | Alley: sentence headline + visual evidence beat topic + bullets on comprehension, p < .01 [P] ([research](https://writing.engr.psu.edu/research.html)). SWD: use active titles, not descriptive ones [P] ([annotate](https://www.storytellingwithdata.com/blog/2015/02/annotate-with-text)) | Full: text only | Existing rule (`headline`). Tighten, see §4 |
| Assertion-evidence body | Visual evidence under the headline instead of bullets | Alley tutorial: messages as sentence headlines, visual evidence, details in notes [P] ([craftscicom](https://www.craftscicom.org/ae_tutorial.html)) | Full. "Evidence" here = chart, diagram, timeline, metric (no photos) | Existing types. Shifts weight away from `bullets` |
| Pyramid / SCQ | Order the deck: one governing thought, grouped support | Minto: ideas organized as a pyramid under a single point; SCQ framework identifies the reader's question [P] ([minto.com](https://www.barbaraminto.com/), [concept](https://www.barbaraminto.com/concept)) | Full: structure, not layout | Recipes + `section` |
| Sparkline (what is / what could be) | Alternate current state and better future; end on "new bliss" | Duarte's own blog [P] ([contrast guide](https://www.duarte.com/blog/ultimate-guide-to-contrast/), [sparklines](https://www.duarte.com/blog/creating-moments-of-impact-using-sparklines-for-strategic-conversations/)). The book *Resonate* itself was not checked [U] | Full. Needs sourced "what is" facts. "What could be" claims still need a source (plan/ADR) | Recipe pattern + `statement`, `chart` before-after |
| Section divider | Signal a new part of the deck | Google Slides predefined layout `SECTION_HEADER` [P] ([API](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/request#PredefinedLayout)). Keynote layouts not checked [U] | Full: no numbers | **New: `section`** |
| Statement / main point | One big sentence, no body | Google Slides `MAIN_POINT` [P] (same link) | Full. Risk: a sentence with no evidence | **New: `statement`** |
| Big number | One headline figure | Google Slides `BIG_NUMBER` [P] (same link) | Full if sourced | Existing `metric` (1 value) |
| Numbered process (steps) | Ordered actions or stages | Common as an office "Process" graphic. I found no primary source for it as a named slide pattern [S] | Full | **New: `steps`** |
| 2x2 matrix | Place items on two defined dimensions; quadrants imply action | BCG growth-share matrix: four quadrants from relative market share × growth, each with an action [P] ([BCG](https://www.bcg.com/about/overview/our-history/growth-share-matrix)). Gartner Magic Quadrant methods page returned 403 [U] | Partial. Positions are often judgment; needs sourced positions or qualitative quadrants | **New: `matrix` (deferred)** |
| Feature / bento grid | Several cards of uneven size, each one feature or fact | No primary source; Apple product pages use it but Apple does not document it [S] | Partial. Tempts icons/decoration | **New: `features` (deferred)** |
| Annotated / highlighted chart | Grey context, one accent colour on the point, text callout | SWD: state the conclusion in words; use colour sparingly [P] ([annotate](https://www.storytellingwithdata.com/blog/2015/02/annotate-with-text), [color + words](https://www.storytellingwithdata.com/blog/2019/7/10/power-pairing-color-words)). FT: "Don't be afraid to highlight the points of interest" (Ranking) [P] ([FT VV](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)) | Full. The annotation text needs a source if it has a number | **`chart` fields: `highlight`, `note`** |
| Waterfall | Start value, +/- steps, end value | FT VV: under Flow (budgets, +/- components) and Part-to-whole (negative components) [P]. SWD: start, changes, end; label values because bars lack a common baseline [P] ([SWD waterfall](https://www.storytellingwithdata.com/blog/2011/11/waterfall-chart)) | Full. Steps must sum; checkable | **`chart.kind: waterfall`** |
| Small multiples | Same small chart repeated per category, shared scale | Tufte lists small multiples as a topic of *Envisioning Information* [P] ([book page](https://www.edwardtufte.com/book/envisioning-information/)). His wording on the method, from search snippets only [S] | Full, but crowded on a 16:9 slide | Defer. `grouped-bar` covers most client cases |
| Slope chart | Change in rank/value between two points for several items | FT VV, Ranking [P] | Full | Possible `chart.kind` later. `before-after` covers one item |
| Zelazny: chart from message | Pick the chart from the comparison the message makes | *Say It With Charts* (book). Not checked online [U] | Full | Already how `data-compare.md` works ("Pick the chart from the question") |

## 3. Per-candidate notes

All shapes follow `slide-types.md`: every slide has `type`, `headline`, optional `notes`, `footnote`, `caption`, `derived`; every shown number needs a `source` on the object that holds it.

### 3.1 `chart` annotation (priority 1, extends existing type)

- **When:** Any chart whose headline points at one bar, point or category ("Mobile drove the drop"). SWD's advice is to mute everything first, then add colour only where you want the eye to go ([P] [SWD](https://www.storytellingwithdata.com/blog/2019/7/10/power-pairing-color-words)).
- **When not:** When the headline is about the whole pattern ("all regions grew"). Then highlighting one point misleads. Never highlight more than one item.
- **Fields:**

  ```json
  { "type": "chart", "kind": "line", "headline": "Sign-ups doubled after the March launch",
    "categories": ["Jan","Feb","Mar","Apr"], "series": [{ "name": "Sign-ups", "values": [210, 220, 380, 440] }],
    "unit": "sign-ups / month", "source": "data/signups.csv#monthly",
    "highlight": { "category": "Mar", "series": "Sign-ups" },
    "note": { "at": "Mar", "text": "Launch: 2026-03-04", "source": "docs/release-notes.md#v2" } }
  ```

- **Limits:** One `highlight` (the other marks render in `--muted`), at most one `note`, `note.text` ≤ 60 characters. A number or date in `note.text` needs `note.source`.
- **Honesty:** The highlighted item must be the one the headline names. SWD warns that people can draw different conclusions from the same chart ([P] [SWD](https://www.storytellingwithdata.com/blog/2015/02/annotate-with-text)). Annotation fixes that only if it agrees with the data. Don't highlight to hide an unfavourable series; the existing rule "use every relevant data point" still applies.

### 3.2 `section` (priority 2)

- **When:** Decks of 10 or more slides, between groups that answer different parts of the main question (Minto's pyramid: a single thought, then groups under it ([P] [Minto](https://www.barbaraminto.com/concept))). It mirrors `agenda` items.
- **When not:** Decks under 10 slides, or as decoration between every slide.
- **Fields:** `{ "type": "section", "headline": "Phase 2 delivers self-service reporting", "number?": 2 }`
- **Limits:** At most one per `agenda` item. `headline` is still a takeaway sentence, not just "Phase 2". `number` is the agenda position, so it needs no source. Deck needs an `agenda` if it uses `section`.
- **Honesty:** No numbers other than `number`. A digit in the headline needs a slide-level `source`, same as `bullets`.

### 3.3 `steps` (priority 3)

- **When:** Ordered actions for an end-user ("How to switch on two-factor login"), or stages a client goes through (onboarding). This is the "what you need to do" slide in the Feature-intro recipe.
- **When not:** Unordered points (`bullets`), dated items (`timeline`), phases with deliverables (`roadmap`), system flow with branches (`diagram`).
- **Fields:** `{ "type": "steps", "headline": "Switching on takes three steps", "steps": [ { "label": "Open Settings → Security", "detail?": "On the web or the app" } ], "source?": "docs/release-notes.md#2fa" }`
- **Limits:** 3–6 steps, `label` ≤ 8 words in imperative mood, `detail` ≤ 12 words. The template numbers the steps; don't write numbers in `label`.
- **Honesty:** The step count in the headline must equal `steps.length`. Steps come from a source (release notes, plan AC). A duration ("takes 2 minutes") needs a `source`.

### 3.4 `statement` (priority 4)

- **When:** One sentence the audience must remember, at a turn in the story: the shift from "what is" to "what could be" in Duarte's sparkline ([P] [Duarte](https://www.duarte.com/blog/ultimate-guide-to-contrast/)), or the governing thought of a Minto pyramid stated up front.
- **When not:** As a replacement for evidence. Alley's model is a headline *plus* visual evidence ([P] [tutorial](https://www.craftscicom.org/ae_tutorial.html)), and a statement slide has none. If the sentence needs proof, follow it with the slide that proves it.
- **Fields:** `{ "type": "statement", "headline": "Your team stops re-keying orders by hand", "support?": "One line of context, ≤ 20 words", "source?": "..." }`
- **Limits:** Headline ≤ 15 words. At most 2 per deck, never two in a row, never the last slide (`cta` is last).
- **Honesty:** Same as `quote` minus the attribution: a claim of benefit needs a `source` (plan, ADR). Confidence words ("guaranteed", "will") need a source that says so (principles.md §3).

### 3.5 `matrix` (deferred)

- **When:** Choosing among 3–8 options on two named criteria (value × effort; impact × urgency). BCG's matrix shows the form: two defined axes, four quadrants, an action per quadrant ([P] [BCG](https://www.bcg.com/about/overview/our-history/growth-share-matrix)).
- **When not:** When the two axes are correlated or undefined, or when the placement is the team's opinion with nothing written down. Then use `comparison`, which shows criteria as text.
- **Fields (draft):**

  ```json
  { "type": "matrix", "headline": "Two of five requests are high value and low effort",
    "x": { "label": "Effort", "low": "Days", "high": "Months" },
    "y": { "label": "Value to users", "low": "Few users", "high": "Most users" },
    "quadrants": ["Quick wins", "Big bets", "Fill-ins", "Avoid"],
    "items": [ { "label": "Export to Excel", "x": "low", "y": "high", "source": "docs/plan.md#estimates" } ] }
  ```

- **Limits:** 3–8 items. Positions are **quadrant only** (`low` | `high` per axis), never x/y coordinates. Without a numeric source, exact positions imply precision that doesn't exist.
- **Honesty:** Both axes must be labelled with what low and high mean. Every item needs a `source` that supports its quadrant (an estimate, a survey, an ADR). An item with no source is not placed; list it in `notes` as `TBD`. The headline count must match the items in the named quadrant.

### 3.6 `features` / bento (deferred)

- **When:** "What's included" for end-users: 3–6 capabilities of equal standing.
- **When not:** When there's an order (`steps`), a time (`roadmap`), or numbers (`metric`). Not as a decorative mosaic.
- **Fields (draft):** `{ "type": "features", "headline": "...", "items": [ { "title": "≤ 5 words", "text": "≤ 15 words", "size?": "wide" } ] }`
- **Limits:** 3–6 items, at most one `wide`, no icons or emoji (visual-style.md bans decoration).
- **Honesty:** Each feature must exist in the release notes or plan. A number on a card needs `source` on the item.
- **Evidence gap:** I found no primary source that defines bento grids as a presentation layout. Apple uses the look on product pages but publishes no guidance [S]. Treat it as a style choice, not an established pattern.

## 4. Findings that should change existing types or recipes

1. **Headline rule (all types).** Add these to `slide-types.md`:
   - The headline is a full sentence with a verb (Alley's messages are full sentences ([P] [tutorial](https://www.craftscicom.org/ae_tutorial.html))).
   - No question headlines. SWD: questions can divide attention or imply uncertainty ([P] [SWD](https://www.storytellingwithdata.com/blog/be-careful-using-questions-as-slide-titles)).
   - Give it a length cap (suggest ≤ 2 lines at template size). Alley is widely cited for a two-line limit, but I could not confirm that from his pages [U].
   - Secondary details go in `notes`, which the tutorial also recommends ([P]).
2. **`bullets` should be a last resort.** principles.md §4 already says this. Alley's tutorial says bullet lists lead to more text than listeners can process while listening ([P] [tutorial](https://www.craftscicom.org/ae_tutorial.html)), which is evidence for it. Recipes: replace "`bullets` (what you need to do)" in *Feature intro for end-users* with `steps`. Consider `statement` + `chart` instead of `bullets` (problem) in *Pitch / proposal*.
3. **Chart titles vs. headline.** SWD prefers an action slide title over a descriptive graph title ([P] [SWD transforming titles](https://www.storytellingwithdata.com/blog/2020/3/5/transforming-slide-titles)). muffy has no separate graph title, so the axis/`unit` text plays that role. Keep `unit` descriptive and the headline as the takeaway. Add to data-compare.md: the headline must name what the highlight shows.
4. **Labelling.** SWD: every graph and every axis needs a title, except obvious ones like months ([P] [SWD annotate](https://www.storytellingwithdata.com/blog/2015/02/annotate-with-text)). The template prints `unit` on the y-axis but has no x-axis label. Consider an optional `xLabel` when categories aren't self-explanatory.
5. **Waterfall `chart.kind`.** Shape: `categories` = start, each change, end; one series where changes are signed. Rules: start + Σ changes = end (checker-verifiable); value labels on every bar, because SWD notes waterfall bars lack a common baseline ([P] [SWD waterfall](https://www.storytellingwithdata.com/blog/2011/11/waterfall-chart)); the axis starts at zero, as for bars. Add to the "Pick the chart" table: "How did we get from A to B? → `waterfall`".
6. **Sparkline in recipes.** The *Pitch / proposal* recipe already moves problem → solution. Duarte argues a pitch with no "what is" contrast sounds too good to be true ([P] [Duarte](https://www.duarte.com/blog/ultimate-guide-to-contrast/)). Suggest: alternate sourced current-state evidence (`chart`/`metric`/`quote`) with "what could be" slides (`roadmap`, `statement`), and end on `cta`.
7. **SCQ for the opening.** Minto's SCQ framework identifies the question in the reader's mind ([P] [barbaraminto.com](https://www.barbaraminto.com/)). In recipes, the slides after `title` can map to Situation (context), Complication (problem) and the answer (governing thought, as headline or `statement`). The details of SCQA (the "A") come from the book, which I did not check online [U].
8. **`metric` with one value = Google's `BIG_NUMBER`.** No change needed; this confirms the existing type covers that layout ([P] [Google Slides API](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/request#PredefinedLayout)).
9. **Small multiples and slope.** Don't add yet. On a 16:9 slide with the template's font sizes, more than 4 panels won't read. `grouped-bar` and `before-after` cover most client questions.

## 5. Sources

Primary:
- Alley et al., research page with study summaries (Garner, Alley, Wolfe, Sawarynski, *IJEE* 29(6), 2013; Aippersbach, Alley, Garner, ASEE 2013; Alley et al., *Technical Communication* 2006, headlines): https://writing.engr.psu.edu/research.html
- Garner et al. 2013 full text (fetched but not parsed; the claims above rely on the authors' own summary page): https://www.ijee.ie/articles/Vol29-6/23_ijee2791ns.pdf
- Alley, assertion-evidence home: https://www.assertion-evidence.com/
- Alley, AE tutorial: https://www.craftscicom.org/ae_tutorial.html
- Minto, home (SCQ Framework): https://www.barbaraminto.com/
- Minto, concept: https://www.barbaraminto.com/concept
- Duarte, contrast guide (Presentation Sparkline): https://www.duarte.com/blog/ultimate-guide-to-contrast/
- Duarte, sparklines for strategic conversations: https://www.duarte.com/blog/creating-moments-of-impact-using-sparklines-for-strategic-conversations/
- Duarte, *Resonate* book page: https://www.duarte.com/resources/books/resonate/
- Knaflic, annotate with text: https://www.storytellingwithdata.com/blog/2015/02/annotate-with-text
- Ricks (SWD), power pairing: color + words: https://www.storytellingwithdata.com/blog/2019/7/10/power-pairing-color-words
- Velez (SWD), transforming slide titles: https://www.storytellingwithdata.com/blog/2020/3/5/transforming-slide-titles
- Rowe (SWD), questions vs takeaway titles: https://www.storytellingwithdata.com/blog/be-careful-using-questions-as-slide-titles
- Knaflic, the waterfall chart: https://www.storytellingwithdata.com/blog/2011/11/waterfall-chart
- Financial Times, Visual Vocabulary: https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary
- Tufte, *Envisioning Information* book page: https://www.edwardtufte.com/book/envisioning-information/
- Google Slides API, `PredefinedLayout`: https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/request#PredefinedLayout
- BCG, growth-share matrix: https://www.bcg.com/about/overview/our-history/growth-share-matrix

Not verified (book only, blocked, or no primary found):
- Zelazny, *Say It With Charts* (McGraw-Hill): book not read.
- Minto, *The Pyramid Principle* (book): the SCQA "Answer" step and slide-level rules.
- Duarte, *Resonate* / *slide:ology* (books): only Duarte's blog was checked.
- Alley's ≤ 2-line headline rule: widely repeated, not found on the pages fetched.
- Tufte's small-multiples method wording: search snippets only.
- Gartner Magic Quadrant methodology: HTTP 403.
- Apple Keynote layout names (Statement, Big Fact, Section) and bento grids: no Apple documentation found.
