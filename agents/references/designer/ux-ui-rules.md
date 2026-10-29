## UX/UI rules by priority

Adapted from the `ui-ux-pro-max` skill's priority model (MIT; notice in `skills/muffy/THIRD_PARTY_NOTICES.md`). Work from P1 down to P10: when two rules conflict, the higher tier wins. The design system still decides the look ([rules-and-guardrails.md](rules-and-guardrails.md)); these rules decide what the screens must do for the people using them.

Each rule has an id so reviews, the heuristic table and `quality_checks.failed[]` can cite it (e.g. `A11Y-3`).

### Lookup
The tiers below are the rule set. For detail on a specific concern (the rationale, a Do/Don't pair, severity) search the data tables with one plain command, always with an explicit `--domain`:

```
node .claude/skills/muffy/scripts/ux-search.mjs "<2-5 terms>" --domain <ux|web|chart|typography|reasoning> -n 3
```

| Domain | Table | Use it for |
|---|---|---|
| `ux` | ux-guidelines.csv | the audit of P1, P2, P5 to P9; check the `Severity` column against the tier |
| `web` | app-interface.csv | mobile and desktop app conventions (`Platform:` mobile or desktop) |
| `chart` | charts.csv | P10, only when the task has a chart |
| `typography` | typography.csv | font pairings when a design system is created; the anti-slop font ban still applies |
| `reasoning` | ui-reasoning.csv | decision rules and anti-patterns per product type, at design-system intake only |
| `product`, `style`, `color`, `landing` | products, styles, colors, landing | design-system intake or a landing page only. Treat results as a starting point; `aesthetic-direction.md` pass 2 still applies, and these tables hold the generic defaults it warns about |
| `icons`, `phosphor`, `google-fonts` | icons, phosphor-icons-upstream.json, google-fonts | picking an icon or a typeface. `icons` is the curated 100; `phosphor` is the full upstream catalog. A font result shows its `License` (do not pick one with no licence record) and a Phosphor icon is checked against upstream. The font ban in anti-slop still applies |
| `gsap`, `react` | motion, react-performance | frontend-dev's concerns. Read only to see what FE will be asked to build; do not spec library code |

Results from `style` and `reasoning` carry a `Provenance` line (status, verification date, `stale` when past its freshness limit). Treat a stale record as weaker advice. `ux-search.mjs --info` prints the data counts and checks the pinned snapshots against their recorded hashes.

`--stack <name>` (instead of `--domain`) searches the guidelines for one UI stack, e.g. `--stack shadcn`. Use the stack the contract names, to check that a component exists before mapping it.

- One concern per query, 2 to 5 terms. No match: retry once with narrower terms, then say no database match was found and label the advice as a fallback. Never present a miss as data
- Results are advice. They never override the user, the brief, the design system or `aesthetic-direction.md`
- Read-only: the script writes nothing, and no other agent may run it

### Tiers and gate effect

| P | Category | Impact | Gate effect when a rule fails |
|---|---|---|---|
| 1 | Accessibility (`A11Y`) | CRITICAL | Block: `not-ready` |
| 2 | Touch and interaction (`TOUCH`) | CRITICAL | Block: `not-ready` |
| 3 | Performance as design controls it (`PERF`) | HIGH | Block: `not-ready` |
| 4 | Style selection and icons (`STYLE`) | HIGH | Block: `not-ready` |
| 5 | Layout and responsive (`LAYOUT`) | HIGH | Block: `not-ready` |
| 6 | Typography and color (`TYPE`) | MEDIUM | Record in `design.md` with the reason |
| 7 | Motion (`MOTION`) | MEDIUM | Record in `design.md` with the reason |
| 8 | Forms and feedback (`FORM`) | MEDIUM | Record in `design.md` with the reason |
| 9 | Navigation (`NAV`) | HIGH | Block: `not-ready` |
| 10 | Charts and data (`CHART`) | LOW | Suggestion only; load this section only when the task has a chart |

P9 Navigation keeps its HIGH impact despite its number: a screen set with broken navigation is not ready, so check it with the other HIGH tiers before the MEDIUM ones. A "Record" rule that fails needs one line in `design.md`: rule id, what differs, why. A rule that does not apply to the task (no forms, no chart) is skipped, not failed.

Each number below (contrast, target size) is the single source for the team; other files link here instead of repeating it.

### P1 Accessibility (CRITICAL)
Must
- `A11Y-1` Text contrast 4.5:1 (large text and UI borders 3:1) in light and dark, checked separately for dark
- `A11Y-2` Visible focus ring on every interactive element, and sticky bars, overlays and banners never cover the focused control
- `A11Y-3` Keyboard path and tab order match the visual order; every pointer action has a keyboard path
- `A11Y-4` Icon-only controls have an accessible name; decorative icons beside text are `aria-hidden`; meaningful images have alt text
- `A11Y-5` Color is never the only signal: pair it with text, icon or shape
- `A11Y-6` Real labels for every field; sequential heading levels; a skip link where the page repeats a header
- `A11Y-7` Respect reduced motion and text scaling (no truncation or layout break at the largest system text size)
- `A11Y-8` Any drag has a single-pointer or keyboard alternative; moving or auto-rotating content has pause/stop and stops on focus
- `A11Y-9` Sign-in allows password managers and paste; information already given in the same flow is not asked again
- `A11Y-10` Modals and multi-step flows offer cancel or back

Avoid: removed focus rings, placeholder-only labels, hover-only information, gray-on-gray text.

### P2 Touch and interaction (CRITICAL)
Must
- `TOUCH-1` Targets at least 44x44 px (iOS 44 pt, Android 48 dp); extend the hit area when the icon is smaller. WCAG 2.2 AA minimum is 24 px; 44 is the team bar
- `TOUCH-2` At least 8 px between adjacent targets
- `TOUCH-3` Press, loading and disabled states are designed; feedback appears within ~100 ms; async buttons show progress and cannot be double-submitted
- `TOUCH-4` Primary actions work by tap or click, never by hover alone
- `TOUCH-5` Gesture-only actions (swipe, long press) also have a visible control and a hint of the gesture
- `TOUCH-6` One primary gesture per region; do not block system gestures (back swipe)
- `TOUCH-7` Fixed UI keeps clear of notch, home indicator and OS bars (mobile)

Avoid: tiny icon-only hit areas, pixel-precise taps, nested tap/drag regions.

### P3 Performance as design controls it (HIGH)
Must
- `PERF-1` Reserve space for async content (images, embeds, lists) so nothing jumps when it loads: give every image a size or aspect ratio
- `PERF-2` Wait over ~1 s shows a skeleton or progress, not a blank area or a long spinner
- `PERF-3` No state change shifts the layout (press, error, expand) beyond the area reserved for it
- `PERF-4` Offer a degraded state for slow or failed loads (retry, cached content, smaller media)
- `PERF-5` Long lists (50+ items) are designed as paged or virtualized lists, with the page size noted for FE

Avoid: autoplay heavy media above the fold, more than one animated hero, uncapped lists.

Image formats, bundling and font preloading belong to frontend-dev, not here.

### P4 Style selection and icons (HIGH)
Must
- `STYLE-1` The style matches the product and audience, and is the same on every screen
- `STYLE-2` One icon family, one stroke width, one fill style per hierarchy level; icon sizes come from tokens
- `STYLE-3` SVG icons only, never emoji as structural icons
- `STYLE-4` One primary action per screen; secondary actions are visually quieter
- `STYLE-5` Hover, pressed, disabled and focus states are distinct and on-style in both themes
- `STYLE-6` Elevation uses the shared scale; shadows and blur have a purpose (blur marks a dismissed background, not decoration)
- `STYLE-7` Prefer the platform's native or library controls over custom ones unless the brand needs it
- `STYLE-8` Official brand assets only, at correct proportions and clear space

Avoid: mixing flat and skeuomorphic, random shadow values, raster icons.

### P5 Layout and responsive (HIGH)
Must
- `LAYOUT-1` Design mobile first, then tablet and desktop, at systematic breakpoints (e.g. 375 / 768 / 1024 / 1440)
- `LAYOUT-2` No horizontal scroll at phone width; never disable zoom
- `LAYOUT-3` Spacing comes from the 4 px base scale; layout tiers (16 / 24 / 32 / 48) are consistent per hierarchy level
- `LAYOUT-4` Body text line length 35 to 60 characters on mobile, 60 to 75 on desktop
- `LAYOUT-5` Visual hierarchy comes from size, spacing and contrast, not color alone; core content comes first on mobile
- `LAYOUT-6` Fixed headers and bars reserve space so scrolling content is never hidden behind them
- `LAYOUT-7` Layers use a defined z-index scale; no nested scroll regions that fight the page scroll
- `LAYOUT-8` Long labels and user content wrap before they truncate; truncation shows full text on demand

Avoid: fixed pixel container widths, edge-to-edge paragraphs on wide screens.

### P6 Typography and color (MEDIUM)
Must
- `TYPE-1` Body text at least 16 px (12 px is the floor for captions); line height 1.5 to 1.75 for body
- `TYPE-2` One type scale with set weights per step; weight carries hierarchy (headings 600 to 700, body 400, labels 500)
- `TYPE-3` Numbers in columns, prices and timers use tabular figures
- `TYPE-4` Semantic color tokens only; dark mode is a designed tonal variant (lighter, desaturated), not an inversion
- `TYPE-5` Functional color (error, success) has one meaning and comes with an icon or text
- `TYPE-6` Short headings wrap in balanced lines; URLs and IDs wrap instead of overflowing

Avoid: raw hex in components, tight tracking on body text, more than three typefaces.

### P7 Motion (MEDIUM)
Must
- `MOTION-1` Every animation shows cause and effect (state change, hierarchy, continuity); none is decoration
- `MOTION-2` Durations and easing come from shared tokens; exit is shorter than enter (about 60 to 70%)
- `MOTION-3` Animate transform and opacity only; never width, height, top or left
- `MOTION-4` Animations are interruptible and never block input
- `MOTION-5` At most 1 to 2 animated elements per view; list entrances stagger 30 to 50 ms per item
- `MOTION-6` Modals and sheets animate from their trigger; navigation direction matches hierarchy (forward in, back out)
- `MOTION-7` Every motion has a reduced-motion alternative, and data is readable without the animation

Avoid: one duration for every transition, fade-and-slide on every section, hover lift on every card.

### P8 Forms and feedback (MEDIUM)
Must
- `FORM-1` Visible label per field; required fields marked; persistent helper text for complex inputs
- `FORM-2` Validate on blur, not per keystroke; the error sits below its field and says cause and fix
- `FORM-3` After a failed submit with several errors, a focusable summary at the top links to each field, and inline errors stay
- `FORM-4` Submit shows loading, then success or error; timeouts offer retry
- `FORM-5` Destructive actions ask for confirmation or offer undo, use the danger color and sit apart from primary actions
- `FORM-6` Toasts auto-dismiss in 3 to 5 s, never steal focus, and are announced politely
- `FORM-7` Use semantic input types and autocomplete; long forms save drafts; sheets with unsaved changes confirm before dismissing
- `FORM-8` Multi-step flows show progress and allow back; read-only looks different from disabled
- `FORM-9` Empty states give a message and an action

Avoid: errors only at the top, overwhelming forms up front, vague "Invalid input".

### P9 Navigation (HIGH)
Must
- `NAV-1` Back is predictable and restores scroll, filters and input; the stack is never silently reset
- `NAV-2` Navigation items have an icon and a label; the current location is highlighted
- `NAV-3` Bottom or tab navigation has 5 items or fewer and holds top-level screens only; large screens prefer a sidebar
- `NAV-4` Navigation sits in the same place on every page; do not mix tabs, sidebar and bottom nav at one level
- `NAV-5` Key screens are reachable by URL or deep link
- `NAV-6` Dangerous actions (delete account, log out) are separated from normal navigation
- `NAV-7` Modals are not used for primary navigation; every modal has a clear dismiss
- `NAV-8` A destination that is unavailable explains why instead of disappearing
- `NAV-9` Breadcrumbs on web hierarchies three or more levels deep; focus moves to the main content on route change

Avoid: overloaded navigation, broken back behavior, hidden core navigation in sub-flows.

### P10 Charts and data (LOW)
Load only when the task has a chart or data table.
- `CHART-1` The chart type matches the data (trend: line, comparison: bar, proportion: pie only up to 5 categories)
- `CHART-2` Legend near the chart; direct labels for small datasets; axes carry units
- `CHART-3` Never color alone: add pattern, shape or label; data marks 3:1 against the background, data text 4.5:1
- `CHART-4` A text summary and a table alternative exist for screen readers; tooltips are keyboard reachable
- `CHART-5` Designed empty, loading and error states (the error has a retry)
- `CHART-6` Small screens simplify the chart (fewer ticks, horizontal bars)
- `CHART-7` Numbers, dates and currencies are formatted for the locale
