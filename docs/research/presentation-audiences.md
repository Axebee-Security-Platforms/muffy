# Presentation Audience Types for Client and End-User Decks

Research for present mode (product-manager; the designer builds the deck) (inputs: `agent-references/product-manager/present/required-inputs.md`; recipes: `recipes.md`; look: `agent-references/designer/presentation.md`; schema: `slide-types.md`; checker: `skills/muffy/scripts/check-presentation.mjs`). Researched 2026-10-17.

Constraints this is judged against: the requester answers one question round and muffy never infers the audience. Sources are limited to plan, ADRs, release notes, research brief and supplied data. Every shown number traces to a source. The deck's `audience` is now `client` | `end-user`, and `background` (`blueprint` | `plain` | `soft`) is meant to follow it.

Source strength: **[P]** = primary (the author's or owner's own site, paper or official guidance). **[S]** = secondary or not checked against the primary. **[U]** = could not check at all. **Judgment** = my recommendation, not a finding.

## 1. Summary

- **Use both: a small role axis plus a few dimensions, not a longer list of types.** None of the authorities checked uses a flat list on its own. Purdue OWL sorts readers by role (gatekeeper, primary/decision maker, secondary/technical expert, shadow, affected stakeholders), then analyses each by needs, values and attitudes ([P] [Purdue OWL](https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/audience_analysis/index.html), [development stage](https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/audience_analysis/development_stage.html)). McMurrey gives four categories (experts, technicians, executives, nonspecialists), then analyses background and needs ([P] [McMurrey](https://human.libretexts.org/Bookshelves/Composition/Technical_Composition/Online_Technical_Writing_(McMurrey)/04%3A_Processes_and_Guidelines_in_Technical_Writing/4.02%3A_Audience_analysis)). Stikeleather's five levels mix role with familiarity ([P] [HBR](https://hbr.org/2013/04/how-to-tell-a-story-with-data)).
- **Replace `group: client | end-user` with `role`: what the audience will do after the deck.** Options: `decide` / `evaluate` / `use` / `operate` / `informed`. Role is the axis the sources agree on. It covers decision maker vs. technical adviser vs. the people who build, run or use the thing ([P] Purdue, McMurrey). It also sets the `cta` kind directly: `decide` for deciders, `act` for users and operators (judgment).
- **Add one question: attitude toward the message** (supportive / neutral / sceptical). Knaflic's context checklist asks what biases could make the audience resist ([P] [SWD](https://www.storytellingwithdata.com/blog/2015/02/consulting-for-context)). Purdue's reader chart has an Attitudes column ([P]). Duarte calls out "new or reluctant audiences" ([P] [Audience Needs Map](https://www.duarte.com/resources/guides-tools/audience-needs-map/)). Attitude decides whether the deck needs Duarte's what-is / what-could-be contrast.
- **Keep familiarity, cares and setting. They are evidence-based.** Stikeleather frames visuals around what the audience already knows ([P]). Duarte's slidedoc guidance says a deck sent to read alone needs enough context to stand without a voice-over ([P] [HBR 2014](https://hbr.org/2014/03/a-presentation-isnt-always-the-right-way-to-communicate)). The question round grows from 5 to 6 questions (role, who, familiarity, attitude, cares, setting), plus one follow-up for end-users: do they use the current version?
- **Structure follows role and attitude.** For decision-makers, answer first: Duarte says executives won't sit through a long build to a big reveal, so summarize up front ([P] [HBR 2012](https://hbr.org/2012/10/how-to-present-to-senior-execu)). Minto and NN/g's inverted pyramid say the same ([P]). For sceptical or change-affected audiences, add contrast between what is and what could be ([P] [Duarte, budget](https://www.duarte.com/blog/get-your-budget-approved/), [Illuminate](https://www.duarte.com/blog/change-communication-for-ai-adoption/)). The split between those two cases is judgment. For existing users, lead with what changes, because users dislike change itself ([P] [NN/g](https://www.nngroup.com/articles/fresh-vs-familiar-aggressive-redesign/)).
- **No authority matches background or visual style to audience type.** The only related evidence is about legibility. Plain backgrounds were searched faster than medium-texture ones in a small GUI study, and preference ratings did not predict speed ([P] [Hill & Scharff](https://laurenscharff.com/research/Oxford.html)). The checker's rule that blueprint "reads as technical" and so is never for end-users has no evidence behind it. Let background follow setting and legibility, not audience type (judgment).
- **Don't offer investor, regulator or partner decks as types yet.** Investors are well documented, but what Sequoia asks for (market, competition, team, financials, vision) is mostly absent from plan, ADR and release notes, so those slides would be `TBD` ([P] [Sequoia](https://www.sequoiacap.com/article/writing-a-business-plan/)). I found no primary guidance for regulators/auditors or partners/vendors as presentation audiences ([U]).
- **Make `audience` a profile object in `deck.json` and map the old values for compatibility** (`client` → role `decide`, `end-user` → role `use`). The files that change are listed in §4.5. This research edits none of them.

## 2. Audience catalogue

Verdict column: **established** = described as an audience in at least one primary source checked; **partial** = covered only through a broader category; **not found** = no primary source checked describes it.

| Audience type | Verdict | What they care about | Detail level and length | Structure | Things to avoid | Source |
|---|---|---|---|---|---|---|
| Executives / budget approvers (client side) | Established | Significance and conclusions; the decision; ROI | Low. Summary slides up front, the rest as appendix; Duarte's 10% rule (5 summary slides per 50 appendix slides). muffy has no appendix type, so detail goes in `notes` | Answer first: findings, conclusions, recommendation and call to action at the start; answer what they asked before anything else | A long build to a big reveal; technical detail (executives usually know as little of it as nonspecialists) | [P] [Duarte HBR 2012](https://hbr.org/2012/10/how-to-present-to-senior-execu); [P] [Stikeleather](https://hbr.org/2013/04/how-to-tell-a-story-with-data) "executive"; [P] [McMurrey](https://human.libretexts.org/Bookshelves/Composition/Technical_Composition/Online_Technical_Writing_(McMurrey)/04%3A_Processes_and_Guidelines_in_Technical_Writing/4.02%3A_Audience_analysis) "executives"; [P] [Purdue](https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/audience_analysis/index.html) primary = decision maker |
| Managers / project leads (client side) | Established | Actionable understanding of how the parts interrelate | Medium to high: in-depth, with access to detail | Answer first, then supporting detail | Oversimplifying | [P] Stikeleather "managerial"; [P] Purdue primary (project lead, point of contact) |
| Technical evaluators on the client side | Established | Facts, evidence, new or contradictory information; whether the claims hold | High. Comfortable with shared jargon, but still prefer plain, scannable text | Facts first; lead with data; summaries and headings as shortcuts | Hype, overstated outcomes, fluffy introductions | [P] Purdue secondary = "technical expert within audience's organization"; [P] [NN/g domain experts](https://www.nngroup.com/articles/writing-domain-experts/); [P] [GOV.UK, write clearly for specialists](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/); [P] Stikeleather "expert" |
| Client's operations / support team (people who run it) | Partial (McMurrey "technicians"; GOV.UK task-based needs) | Practical: how to run, maintain, fix; the task they must do | Medium. Practical, not theoretical | Task first: what to do, then why | Theory and design rationale; content that asks them only to "understand" without an action | [P] McMurrey "technicians"; [P] [GOV.UK user needs](https://www.gov.uk/guidance/content-design/user-needs) |
| Internal users inside the client's organisation (staff affected by a change) | Partial (Duarte change communication; Purdue "stakeholders") | What changes for them; fear, uncertainty, doubt | Low to medium | Contrast current state with a better future; acknowledge resistance; celebrate progress at later stages | Ignoring the resistance; vision with no concrete next step | [P] [Duarte, Illuminate](https://www.duarte.com/blog/change-communication-for-ai-adoption/) (Duarte blog post); [P] Purdue action stage: people affected by the decisions |
| Existing end-users | Established (NN/g) | What changed, where their familiar features went, what they must do | Low | What changes first, then what stays, then steps | Change for its own sake; surprising them | [P] [NN/g, fresh vs familiar](https://www.nngroup.com/articles/fresh-vs-familiar-aggressive-redesign/); [P] [NN/g, users hate change](https://www.nngroup.com/videos/users-hate-change/) |
| New end-users | Partial (McMurrey "nonspecialists"; Stikeleather "novice") | Practical benefit; how to start | Low. First exposure, but they don't want to be talked down to | Benefit, then steps | Jargon; branded internal terms; oversimplifying | [P] Stikeleather "novice"; [P] McMurrey "nonspecialists"; [P] [NN/g plain language](https://www.nngroup.com/articles/plain-language-experts/) |
| General public | Established | Practical or civic reasons (McMurrey's example: enough understanding to vote for or against a bond); curiosity | Lowest. Overviews and background may be needed | Plain; most important point first | Jargon; branded terms | [P] McMurrey "nonspecialists"; [P] NN/g plain language; Alley's book has a chapter on the general public ([S] table of contents only, [Springer](https://link.springer.com/book/10.1007/b97588)) |
| Investors | Established (investor-owned guidance) | Purpose, problem, solution, why now, market, competition, business model, team, financials, vision | Short deck. Sequoia lists about 10 sections; YC-style "10–12 slides" ([S], third-party guides only) | Purpose in one sentence first, then problem → solution | Listing features instead of the mission | [P] [Sequoia](https://www.sequoiacap.com/article/writing-a-business-plan/). **muffy fit: poor.** Market, team and financials are not in plan, ADRs or release notes |
| Partners / vendors | Not found | — | — | — | — | [U] No primary presentation guidance found for this group. In the role model they are `decide` or `evaluate` |
| Regulators / auditors | Not found | — | — | — | — | [U] No primary presentation guidance found. GOV.UK's plain-English evidence for specialists is the closest ([P]). **muffy fit: poor.** Compliance evidence is not in muffy's source set |
| Gatekeeper / shadow audience | Established (Purdue) | Whoever approves the document before it goes out, and anyone it is forwarded to | — | A read-alone deck must stand without its author | Assuming only the named audience reads it | [P] Purdue (gatekeeper, shadow audience) |

Across all types: plain language is preferred even by specialists. GOV.UK cites research where about 80% preferred clear English, and the preference rose with education and specialist knowledge ([P] [GOV.UK](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/); NN/g found the same in usability tests ([P] [NN/g](https://www.nngroup.com/articles/plain-language-experts/))). NN/g says to prioritise when there are several audiences, because writing for everyone reaches no one ([P]). McMurrey says to omit what readers don't need and pitch content at the right level ([P]).

## 3. Audience models from the authorities

### 3.1 What each source does

| Source | Model | Types or roles | Dimensions |
|---|---|---|---|
| Purdue OWL (after Johnson-Sheehan) | Roles by document stage, plus an analysis grid | Development: authors, gatekeeper. Reading: primary (decision maker), secondary (technical expert in their org), shadow. Action: stakeholders affected by the decision | Needs, values, attitudes; who, what, where, when, why, how they read ([P] [index](https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/audience_analysis/index.html), [development stage](https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/audience_analysis/development_stage.html)) |
| McMurrey, *Online Technical Writing* | Four categories, plus traits | Experts, technicians, executives, nonspecialists; most documents have a primary and a secondary audience | Background (knowledge, experience, training), needs and interests, and others ([P] [LibreTexts](https://human.libretexts.org/Bookshelves/Composition/Technical_Composition/Online_Technical_Writing_(McMurrey)/04%3A_Processes_and_Guidelines_in_Technical_Writing/4.02%3A_Audience_analysis)) |
| Stikeleather (HBR) | Role, then a five-level scale | First asks whether the piece is for decision makers, general interested parties or others; then novice, generalist, managerial, expert, executive | The levels are set by how much the audience already knows, correctly or not ([P] [HBR](https://hbr.org/2013/04/how-to-tell-a-story-with-data)) |
| Knaflic (SWD) | Questions, no types | Find the decision maker ([S], book highlights) | Who and what you know about them; biases that make them resistant; familiarity with the data; what success looks like; the one-sentence message ([P] [consult for context](https://www.storytellingwithdata.com/blog/2015/02/consulting-for-context), [3-minute story](https://www.storytellingwithdata.com/blog/2014/02/the-3-minute-story)). The who / what / how frame and live vs. written as "how" come from the book ([S]) |
| Duarte | Questions and a needs map, no fixed types | Executives get their own guidance ([P] HBR 2012). Change audiences move through stages: Dream, Leap, and later ones ([P] Illuminate post) | ROI in their eyes, fears, hopes, resistance ("new or reluctant audiences"), medium ([P] [Audience Needs Map](https://www.duarte.com/resources/guides-tools/audience-needs-map/)). "How might they resist" is attributed to *Resonate* ([S], press quotation). *Resonate* has a section called "Segment the Audience" (p. 56) whose content I could not read ([U]) |
| Minto | No audience types | — | The pyramid works for internal or external audiences, in any medium ([P] [Minto concept](https://www.barbaraminto.com/concept)) |
| GOV.UK / NN/g | User needs and expertise | Specialists vs. general public | Task (what the user wants to do and why), vocabulary, reading level ([P] [GOV.UK user needs](https://www.gov.uk/guidance/content-design/user-needs), [NN/g](https://www.nngroup.com/articles/plain-language-experts/)) |

### 3.2 Reading across them

- **Every source that names types also adds dimensions.** None relies on a list alone. Types answer "what role does this person play?" Dimensions answer "how do I pitch it?" ([P] Purdue, McMurrey).
- **The most consistent axis is role relative to the decision or the task:** decides, advises/evaluates, does the work (builds, runs or uses), affected or informed. Purdue's primary, secondary and stakeholders, and McMurrey's executives, experts/technicians and nonspecialists, both line up on it ([P]).
- **Familiarity is the second consistent axis.** It is Stikeleather's whole scale, McMurrey's "background" and Knaflic's "is your audience familiar with this data" ([P]).
- **Attitude has direct primary support.** It appears as Purdue's Attitudes column, Knaflic's resistance question and Duarte's reluctant audiences ([P]).
- **Live vs. read-alone has direct support from Duarte's slidedocs** ([P] [HBR 2014](https://hbr.org/2014/03/a-presentation-isnt-always-the-right-way-to-communicate), [Slidedocs](https://www.duarte.com/resources/books/slidedocs/)). Reynolds's "slideuments" argument (keep slides and handouts separate) points the same way ([S], summaries only).
- **Internal vs. external is weak as a separate question.** Minto says his method works the same for both ([P]). For muffy every audience is outside the dev team anyway (`purpose.md`). The difference that matters (client staff vs. the client's customers) is already captured by role.

### 3.3 Which fits muffy's question round

**Judgment:** a hybrid. Ask one closed role question with 5 options, then the dimensions muffy already asks plus attitude. A fixed list of 10+ audience types would force the requester to pick a label that hides the facts muffy actually uses: who decides, how much they know, whether they resist, and whether someone will narrate. A dimensions-only model gives no direct route to a recipe. Role gives that route, and it gives the `cta` kind.

## 4. Proposal for muffy

Each line is tagged **[evidence]** (backed by a source in §2–3) or **[judgment]**.

### 4.1 Questions (one round, all together, each with options)

| # | Question | Options | Status | Basis |
|---|---|---|---|---|
| Q-1 role | What will the main audience do after the deck? | `decide` (approve, fund, sign off) / `evaluate` (review and advise whoever decides) / `use` (use the product) / `operate` (run, support or administer it) / `informed` (affected; needs to know) | Replaces `group` | [evidence] Purdue roles, McMurrey categories; [judgment] the five labels |
| Q-1a (only if `use` or `operate`) | Do they use the current version today? | `yes` (existing) / `no` (new) | New, conditional | [evidence] NN/g: redesigns penalise current users, and radical change is safer only when there are few current users ([P] [fresh vs familiar](https://www.nngroup.com/articles/fresh-vs-familiar-aggressive-redesign/)) |
| Q-2 who | Role or segment, in words | free text ("client's CFO and ops lead") | Keep | [evidence] Purdue "who are they" |
| Q-3 familiarity | How much do they already know about the product or project? | `none` / `some` / `deep` | Keep | [evidence] Stikeleather, McMurrey, Knaflic |
| Q-4 attitude | How do they feel about the message today? | `supportive` / `neutral` / `sceptical` | New | [evidence] Knaflic biases, Purdue Attitudes, Duarte reluctant audiences; [judgment] three levels |
| Q-5 cares | The one or two things they judge the deck by | `cost` / `timeframe` / `risk` / `ease` / `what changes for them` / other | Keep | [evidence] Duarte "ROI in their eyes"; GOV.UK task-based needs |
| Q-6 setting | Presented live, or sent to read alone? | `live` / `read-alone` | Keep | [evidence] Duarte slidedocs |

If the audience is mixed, Q-1 asks for the **primary** audience. NN/g says to prioritise ([P]), and McMurrey says writing every section for everyone rarely works ([P]). [evidence] Secondary audiences go in "who" and shape `notes` [judgment].

### 4.2 How answers map to the deck

| Answer | Recipe | Structure and wording | Length | `cta` kind |
|---|---|---|---|---|
| role `decide` | Decision request, Pitch, Roadmap or Progress update (pick from the request) | Answer first: recommendation in the first slides [evidence: Duarte HBR 2012, Minto]. Wording in outcomes, cost and timeframe; no technology names [evidence: McMurrey, executives lack technical detail] | Short: summary slides first, detail in `notes` (no appendix type) [evidence: Duarte 10% rule; judgment: `notes` as the appendix] | `decide`: the decision, who decides, by when [evidence: Duarte "call to action" up front; judgment: field] |
| role `evaluate` | Decision request with `comparison`, then `diagram` / `chart` | Facts and evidence first; options with their trade-offs; shared jargon allowed only at familiarity `deep` [evidence: NN/g domain experts; NN/g jargon for shared vocabularies] | Medium; can be longer than `decide` [judgment] | `decide` with an advisory ask ("raise concerns by <date>") [judgment] |
| role `use` + existing | Feature intro, opening on what changes and what stays | What changes for you → what stays → `steps` [evidence: NN/g change aversion; judgment: order] | Short | `act`: what to do, by when [evidence: GOV.UK needs are actions; SWD know or do] |
| role `use` + new | Feature intro | Benefit → `steps` | Short | `act` |
| role `operate` | New recipe (judgment): `title` → `bullets` (what changes for your team) → `timeline` (rollout dates) → `steps` (runbook-level actions) → `bullets` (who to call / known limits) → `cta` | Task first, practical, no theory [evidence: McMurrey technicians, GOV.UK] | Medium | `act` |
| role `informed` | Results / before-after, or a short Feature intro | Most important point first [evidence: NN/g inverted pyramid] | Short | `act` with a light ask (where to learn more) [judgment] |
| attitude `sceptical` | Any recipe | Add sourced what-is evidence before what-could-be; acknowledge the objection [evidence: Duarte contrast and Illuminate; Duarte says a pitch with no "what is" sounds too good to be true]. Still answer first if role `decide` [judgment: reconciling the two] | +1–2 slides for evidence [judgment] | unchanged |
| attitude `supportive` | Any recipe | Skip persuasion; go to next steps [judgment] | Shorter [judgment] | unchanged |
| familiarity `none` | — | Define terms; no internal or branded terms [evidence: NN/g plain language, McMurrey] | — | — |
| familiarity `deep` | — | Shared vocabulary allowed, but still plain [evidence: GOV.UK specialists, NN/g] | — | — |
| setting `read-alone` | — | Fuller headlines, captions on more slides, context that stands without voice-over [evidence: Duarte slidedocs] | — | — |

Reconciling structure. Duarte gives executives answer first, no big reveal ([P]). Her persuasion and change work builds tension between what is and what could be ([P]). Both can hold: state the answer early (SCQ), then use contrast as the proof for audiences who doubt it. Which one leads depends on role, and how much contrast depends on attitude. **[judgment]**

### 4.3 Background

- **[evidence] No authority found ties background or visual style to audience type.** Duarte's *slide:ology* is described as letting audience drive design choices ([S], summaries only), but I found no rule mapping a background to an audience.
- **[evidence] The legibility research is narrow.** Hill & Scharff (N=34, text on GUI backgrounds, a visual-search task) found plain backgrounds faster than medium-texture ones. The effect depended on colour: none on yellow or light-grey grounds, large on blue. Preference ratings did not track speed ([P] [Hill & Scharff](https://laurenscharff.com/research/Oxford.html), [Scharff, Ahumada & Hill](https://laurenscharff.com/research/spie99.html)). The second paper found background contrast energy predicted reading speed better than text contrast alone ([P]). In a later study, both patterned backgrounds were worse than a uniform one ([P] [Scharff & Ahumada](https://laurenscharff.com/research/transtext.html)). None of these tested slides. One search summary claimed background matters only when text contrast is low; I did not confirm that on the primary pages ([S]).
- **[evidence] The checker's rationale is unsupported.** `check-presentation.mjs` comments that the blueprint grid "reads as technical, so end-users never get it." No source checked supports a link between grid backgrounds and perceived technicality. Treat it as house style, not a finding.
- **[judgment] Let background follow setting and legibility.** Use `plain` for `read-alone` (printed or read on small screens, with no presenter to direct attention). Use any of the three for `live`, with `blueprint` kept at low grid contrast behind text, because the only evidence is that busy grounds can slow reading. Use `soft` as the tone option for `use` / `informed` decks if the house wants a warmer look. That is style, not evidence. Consider relaxing the end-user ban to a warning.
- **[judgment]** Preference data doesn't predict legibility ([P] Hill & Scharff), so "the requester likes the grid" is not a legibility argument either way.

### 4.4 `audience`: enum, grow, or profile object

**[judgment] Profile object.** Growing the enum (`client`, `end-user`, `executive`, `ops`, …) repeats the problem the user raised: it hides familiarity, attitude and setting, and those are what the recipe and wording depend on. Proposed `deck.json` shape:

```json
"audience": {
  "role": "decide",
  "who": "client's CFO and operations lead",
  "existing": null,
  "familiarity": "some",
  "attitude": "sceptical",
  "cares": ["cost", "timeframe"],
  "setting": "live"
}
```

- `role` ∈ `decide | evaluate | use | operate | informed`. `existing` is boolean, required only for `use` / `operate`. `familiarity` ∈ `none | some | deep`. `attitude` ∈ `supportive | neutral | sceptical`. `setting` ∈ `live | read-alone`.
- Back-compat: a string `"client"` is read as `{ role: "decide" }`, and `"end-user"` as `{ role: "use" }`. Either way the checker asks for the missing fields.
- `cta` gains `kind: decide | act`, derived from role: `decide` / `evaluate` → `decide`; the rest → `act`. The checker can then require a deadline or decision wording for `decide`, and `next[]` steps for `act` (judgment).
- Don't offer investor, regulator or partner as roles. Partners map to `decide` / `evaluate`. Investor and regulator decks need sources muffy doesn't have, so they belong in `when-to-use.md` as "not this agent" until a source type exists (judgment).

### 4.5 Files that would change (not edited here)

- `agent-references/product-manager/present/required-inputs.md`: question list (Q-1 role, Q-1a, Q-4 attitude)
- `skills/muffy/references/present.md`: the Orchestrator's question round (line 6 lists `group`)
- `agent-references/product-manager/present/slide-types.md`: `deck.json` shape, `cta.kind`
- `agent-references/product-manager/present/recipes.md`: role → recipe column, new operator recipe, sceptical variant
- `agent-references/product-manager/present/workflow.md` step 1 and `quality-checks.md`: profile fields
- `agent-references/designer/presentation.md`: background rule (setting and legibility)
- `skills/muffy/scripts/check-presentation.mjs`: lines 70–73 (audience enum, blueprint ban)
- `skills/muffy/templates/presentation.html`: sample `"audience": "client"` (line 169), comment at line 45
- `evals/` fixtures that set `audience`

## 5. Gaps

- **Regulators / auditors and partners / vendors:** no primary presentation guidance found for either ([U]).
- **Duarte, *Resonate* "Segment the Audience" (p. 56):** table of contents only; content not read ([U]). The "how might they resist" question comes from a press quotation ([S]). The Audience Needs Map's 8 questions sit behind an interactive tool; only its landing page was read ([P] for the landing page only).
- **Duarte HBR 2012:** read from the article page. Tips beyond the first paragraph were in the page source but behind a paywall overlay ([P], but not visible to all readers).
- **Knaflic's who / what / how frame and "identify the decision maker":** book highlights only ([S]). The blog's context questions are [P].
- **Garr Reynolds:** presentationzen.com pages returned 403/404. The slideuments position comes from reviews and Martin Fowler's bliki ([S]). No Reynolds audience typology found ([U]).
- **Michael Alley:** *The Craft of Scientific Presentations* opens with audience, purpose and occasion and has a general-public chapter, per its table of contents only ([S]). The model itself was not read ([U]).
- **Investor deck length (10–12 slides):** third-party guides only; the YC library page did not render ([S]).
- **plainlanguage.gov / digital.gov:** only the guide-series index was read; no audience-specific guidance extracted ([U]).
- **University of Minnesota *Stand Up, Speak Out* (demographic / psychographic / situational analysis):** HTTP 403 ([U]).
- **Background and audience:** no source found, primary or secondary, matching a background or visual style to an audience type. Legibility studies are lab tasks on GUI or web text, not slides. The claim that "texture matters only at low text contrast" is [S].
- **Sceptical → contrast, decide → answer first, as a combined rule:** each half has a source. The split is my judgment.

## 6. Sources

Primary:
- Purdue OWL, Audience Analysis Overview (reading, development and action stages): https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/audience_analysis/index.html
- Purdue OWL, Development Stage (questions after Johnson-Sheehan; reader chart with needs, values, attitudes): https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/audience_analysis/development_stage.html
- McMurrey, *Online Technical Writing*, 4.2 Audience analysis (LibreTexts, CC BY 4.0): https://human.libretexts.org/Bookshelves/Composition/Technical_Composition/Online_Technical_Writing_(McMurrey)/04%3A_Processes_and_Guidelines_in_Technical_Writing/4.02%3A_Audience_analysis
- Stikeleather, "How to Tell a Story with Data," HBR, 2013-04-24: https://hbr.org/2013/04/how-to-tell-a-story-with-data
- Duarte, "How to Present to Senior Executives," HBR, 2012-10-04: https://hbr.org/2012/10/how-to-present-to-senior-execu
- Duarte, "A Presentation Isn't Always the Right Way to Communicate," HBR, 2014-03-17: https://hbr.org/2014/03/a-presentation-isnt-always-the-right-way-to-communicate
- Duarte, Slidedocs book page: https://www.duarte.com/resources/books/slidedocs/
- Duarte, Audience Needs Map (landing page): https://www.duarte.com/resources/guides-tools/audience-needs-map/
- Duarte blog, "Presentation storytelling 101: Your audience is the hero" (2024-07-15): https://www.duarte.com/blog/presentation-storytelling-audience-is-hero/
- Duarte blog (Nick Graveline), "How to Get Your Next Budget Approved" (2026-08-04): https://www.duarte.com/blog/get-your-budget-approved/
- Duarte blog, "A Guide to AI Adoption: Change Communication That Works" (Illuminate, 2026-10-08): https://www.duarte.com/blog/change-communication-for-ai-adoption/
- Duarte, contrast guide (sparkline; "what is" vs "what could be"): https://www.duarte.com/blog/ultimate-guide-to-contrast/
- Minto, concept: https://www.barbaraminto.com/concept
- Knaflic, consult for context: https://www.storytellingwithdata.com/blog/2015/02/consulting-for-context
- Knaflic, the 3-minute story: https://www.storytellingwithdata.com/blog/2014/02/the-3-minute-story
- Knaflic, what's the Big Idea?: https://www.storytellingwithdata.com/blog/2014/02/whats-big-idea
- GOV.UK, Use clear language (write clearly for specialists too): https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/
- GOV.UK, Identify user needs: https://www.gov.uk/guidance/content-design/user-needs
- NN/g (Loranger), Plain Language Is for Everyone, Even Experts: https://www.nngroup.com/articles/plain-language-experts/
- NN/g (Loranger, Moran), Writing Digital Copy for Domain Experts: https://www.nngroup.com/articles/writing-domain-experts/
- NN/g (Schade), Inverted Pyramid: https://www.nngroup.com/articles/inverted-pyramid/
- NN/g (Nielsen), Fresh vs. Familiar: https://www.nngroup.com/articles/fresh-vs-familiar-aggressive-redesign/
- NN/g (Nielsen), Users Hate Change (video summary): https://www.nngroup.com/videos/users-hate-change/
- Sequoia, Writing a Business Plan: https://www.sequoiacap.com/article/writing-a-business-plan/
- Hill & Scharff, Legibility of Computer Displays as a Function of Colour, Saturation, and Texture Backgrounds (1999): https://laurenscharff.com/research/Oxford.html
- Scharff, Ahumada & Hill, Discriminability Measures for Predicting Readability: https://laurenscharff.com/research/spie99.html
- Scharff & Ahumada, Predicting Readability of Transparent Text on Textured Backgrounds (ARVO 2001): https://laurenscharff.com/research/transtext.html

Secondary or not verified:
- Duarte, *Resonate* (Wiley, 2010), "Segment the Audience" p. 56: table of contents only.
- Duarte, *slide:ology* (2008): reviews and summaries only.
- Knaflic, *Storytelling with Data* (2015), who / what / how and "decision maker": Goodreads highlights only.
- Reynolds, *Presentation Zen*, slideuments and handouts: reviews; Martin Fowler, https://martinfowler.com/bliki/Slideument.html
- Alley, *The Craft of Scientific Presentations* (Springer), table of contents: https://link.springer.com/book/10.1007/b97588
- Y Combinator seed deck guidance: third-party summaries; https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck did not render.
- University of Minnesota, *Stand Up, Speak Out*, ch. 5: HTTP 403.
- plainlanguage.gov / digital.gov plain-language guides: index page only.
