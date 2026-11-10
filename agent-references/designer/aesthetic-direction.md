## Aesthetic direction

Adapted from Anthropic's `frontend-design` skill. It decides **what the look is**, once, when the design system is created or its look changes. It never overrides an existing design system: consistency wins ([rules-and-guardrails.md](rules-and-guardrails.md)).

### When it applies
| Situation | What you do |
|---|---|
| `docs/design-system/` exists, task is a normal screen | Skip this file. Obey the system |
| Design system is being created (intake), the user gave no brand | Run the two passes below, then build the primitive layer from the plan instead of a generic starter palette. The starter's fixed rules still hold: system font stack unless a font is justified, component library's theme, WCAG 2.2 AA |
| User gave a brand, reference or personality | Their words win on every axis they pin down. Use this file only for the axes left free |
| A deck (present mode) or a marketing/landing page | Same two passes, per [presentation.md](presentation.md) for decks |
| Internal tool or admin screen | Skip. Use the plain starter |

### Ground it in the subject
Before choosing anything, state in one line each: the subject (what the product is), the audience, and the primary job of the screen. Take them from `brief.md`, `requirements.md` and `ac.md`; do not invent them. The subject's industry, materials and vocabulary are where distinctive choices come from (a toy for children and a dashboard for financial analysts do not look alike). Use real content and real labels from the brief throughout.

### Pass 1: a short design plan
Write it at the top of `docs/design-system/README.md` (design system creation) or in `design.md`, compact:
- **Color**: 4-6 named values for the base palette, each with its role
- **Type**: typefaces and their roles (one family or two; if two, clearly distinct), a type scale with intentional weights and spacing, line length under 80 characters, serif body text gets slightly more line height than sans
- **Layout**: a concept in one sentence, an ASCII wireframe, the alignment rule (left, centered, justified)
- **Principle**: the one thing that makes this product look like itself

Brainstorm, then compare two layout ideas in ASCII before picking.

### Pass 2: review against the brief before building
Check the plan against the generic defaults below. For each part that reads like what you would produce for any similar product, revise it, and record one line: what changed and why. Only then create tokens and artboards.

Common generated-design defaults. All are legitimate when the brief calls for them; they are defaults, not choices, so do not spend a free axis on them:
1. Warm cream background with a high-contrast serif display and a terracotta or clay accent
2. Near-black background with one acid-green or vermilion accent
3. Broadsheet layout: hairline rules, zero radius, dense columns
4. The SaaS-card kit: identical rounded cards, one radius everywhere, the same soft grey shadow, gradient washes
5. Template chrome whatever the subject: a tracked-out ALL-CAPS eyebrow above every heading, meta strings joined with middle dots, `WORD — fragment` labels, tinted near-black standing in for black, a monospace face for small data labels, a `→` on every link or button

Typographic tells to avoid: accenting a single word of a headline (italic, bold, other color), ALL CAPS labels, unnecessary labels above content. Numbered markers (01 / 02 / 03) only when the content really is a sequence. Borders, dividers, eyebrows and labels must encode information, not decorate.

### Hero and motion
- The first view opens with the most characteristic thing in the subject's world (a headline, image, live demo, interactive moment). A big number with a small label and a gradient accent is the default; use it only when it is truly best
- Motion that answers a user action is welcome. Non-user-triggered motion is for one deliberate moment (one page-load sequence or reveal), never fade-and-slide-up on every section or hover lift on every card. Always keep the reduced-motion alternative

### Restraint
- Spend boldness in one place: one memorable element, everything around it quiet. Cut decoration that does not serve the brief; before handoff, remove one accessory
- Quality floor, not announced: responsive to mobile, visible keyboard focus, reduced motion, accessible contrast
- Take a screenshot to critique when your environment allows; otherwise review the artboards against the plan
- Choose typefaces deliberately, not the family you reach for on every project. The anti-slop list in the rules still bans Inter/Roboto/Arial

### Writing
Words are design content (see principle 8 in [principles.md](principles.md)). Write from the end user's side, name things by what users understand, active voice, sentence case. A CTA says exactly what happens ("Save changes", not "Submit") and keeps its name through the flow (Publish → "Published"). Errors say what went wrong and how to fix it, never apologize, never vague. An empty screen invites an action. One job per written element.

### CSS pitfall
Keep selector specificity flat. A type-based class (`.section`) and an element selector (`.cta`) can cancel each other's padding and margin. Prefer tokens and one class layer.
