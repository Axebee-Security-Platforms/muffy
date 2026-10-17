## Design system intake

Create the design system **only when the project has none**: a brand-new project, or an existing one with a UI but no `docs/design-system/`. When it exists you read it and obey it, and you ask nobody anything about style. Most orderers have no brand or reference yet, so the intake is one question that never stops the run: you build on a ready starter and the question rides on your `done` hand-off.

### When it applies
| Situation | What you do |
|---|---|
| `docs/design-system/` exists | Nothing to create. Design only with its tokens and components. A missing piece is a design-system change in this task (Changelog entry), not a new intake |
| New project, no UI code yet | The intake below, then create it |
| Existing UI code, no design system (the onboard did not write one, or was skipped) | Extract what the code already uses (colors, fonts, spacing, radius, components) and consolidate it. Do not ask about style: the look is "keep the current one" and the source is `[from code]`. Ask only if the code is too inconsistent to consolidate |
| An internal tool or admin screen (the brief says users are the team itself) | No question. Use the starter |
| No UI (API-only, a CLI without screens) | No design system |

### Step 0: read before you ask
Never ask what a file already answers. Read `requirements.md` (earlier answers, including any recorded style answer), `brief.md`, `baseline.md` (Stack: component library and platform), the manifests (`package.json`, `pubspec.yaml` and the like) when there is no baseline, theme and style files in the repo (CSS, Tailwind or theme config, asset folders for logos and fonts), and any brand material the repo holds. If any of them settles the style, use it (`[user]` or `[from code]`) and stop here. The contract is written in the same parallel message, so do not wait for its Stack; a mismatch is fixed when you align with `contract.md` after it exists.

### Step 1: one question, without stopping
You cannot talk to the user, and you do not wait for them. Create the design system from the starter below, finish the design, and return `status: done` with exactly one entry in `questions[]`, `blocking: false` ([requirements.md](../../../skills/muffy/references/requirements.md)). The Orchestrator puts it in the `pause:design-review` question, where the user is looking at the screens anyway:

> Do you have a brand or a reference for how it should look?

Options (the first is the `default`): **not yet, choose a sensible starter style for me** / **yes, I will share it** (colors, logo, fonts or a description) / **I want to pick a personality** (calm and professional, friendly and approachable, bold and technical) / **make it resemble a product I will describe**. `why`: it sets the colors, type and tone of every screen, and can be changed later. The user can type their own answer.

The README's `Style: starter (no brand supplied)` line is the record of this choice. The answer is not given or is the first option → nothing changes. Do not ask anything else.

### Step 2: only when the user has a brand or a reference
The Orchestrator resumes you with `requirements.md`. If the answer already holds what you need, apply it. Otherwise one follow-up round (`status: needs-input`; the user is already at the design gate, so it adds no new wait), at most 4 questions, each with a default of "you decide": the brand colors and logo (in the repo or in chat), the fonts, light only or light and dark, and a short description of the reference. Things you cannot look up (you have no web access) the user describes in words. Whatever stays unanswered falls back to the starter for that item. Two rounds in total, never more.

### The starter
Use it whenever no brand or reference exists. It is one fixed set, so nothing is guessed value by value:
- One neutral ramp and one accent color, plus the status colors, in the two-layer color system of [rules-and-guardrails.md](rules-and-guardrails.md); light and dark; comfortable density
- The system font stack; for Thai or another script that needs it, a font that supports the script and a larger line height; for a right-to-left language, mirrored layout tokens
- The component library's default theme (from `baseline.md` or the manifest; for example shadcn/ui neutral), so components look like the library the team already uses
- WCAG 2.2 AA contrast, 44 pt or 48 dp touch targets on touch platforms
When the user chose a personality, apply it to the accent color, the corner radius and the type weight only; the rest stays the starter.

### Then create it
Write `tokens.css` and `README.md` per [output-format.md](output-format.md). A brand applied after Step 2 changes the primitive layer and adds a Changelog entry; screens keep their semantic tokens. In the README, put **one line** near the top, `Style: starter (no brand supplied)`, or `Style: <brand or reference or personality>`, and tag only what has a real source: `[user]` for what the orderer said, `[from code]` for what came from existing UI. Do not tag every value `[assumed]`: the starter line already says it. Never invent a logo, claim a brand color the user did not give, or present the starter as the brand.

**Changing it later is cheap:** components use semantic tokens only, so adding a brand is one change to the primitive layer. Say so in the README under a short "Rebranding" note. A later brand or reference from the user is a design-system change with a Changelog entry, made by you at the user's word, and the style line is updated.
