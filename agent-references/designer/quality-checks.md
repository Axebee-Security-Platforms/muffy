## Quality Checks

Definition of done. Check the items below before **every** hand-off; if one is false, report "not ready to hand off" with what's missing. Two items depend on the Orchestrator and are checked only where marked:

At step 3 (first round, parallel with architect) the canvas source is ready to publish with no URL yet, and fields not yet in `contract.md` are marked as placeholders; neither counts as a failure. When the design system waits for the contract (design-system-intake.md), the step-3 artboards are wireframes, `design.md` starts with `Design system: after contract (<condition>)` and no `docs/design-system/` file is written; that is not a failure either. In the align round (after `contract.md`, step 3b/3c) the two `[3b/3c]` items must also be true; the Orchestrator verifies the published canvas at the 3c gate.

- [ ] `[3b/3c]` The Artifact URL the Orchestrator published is at the top of `design.md` (you cannot open it; the Orchestrator checks it is viewable)
- [ ] The canvas source is `canvas.json` (v3) plus `.dc.html` artboards listed in it; there is no plain `.html` mockup, and nothing needs converting before publish
- [ ] Artboards exist for every screen × every state the AC requires (table `AC id → artboard`); no AC without a visual
- [ ] `[3b/3c]` No `Design system: after contract` line is left in `design.md`: the design system exists for the contract's library and platform and every artboard uses its tokens
- [ ] `[3b/3c]` Fields/names are aligned with `contract.md` — no placeholders waiting on the contract (at step 3: every not-yet-known field is marked as a placeholder)
- [ ] On-screen text is final copy (FE can copy it verbatim)
- [ ] Works at the sizes the platform needs, per `<muffy>/references/platforms.md#routing`: web, phone width (no horizontal scroll); mobile, the phone frame; desktop, the window's min and default sizes
- [ ] Every value on the canvas comes from `tokens.css`; no raw hex/px outside it (native targets: the same tokens, named so the stack's theme layer can bind them)
- [ ] `## Component inventory` is at the top of `design.md` and matches the canvas: every row is drawn with every state it lists, and no component on the canvas lacks a row
- [ ] Every component used is documented in `docs/design-system/README.md` with variants and states; new or changed ones are in the Changelog
- [ ] Every component on the canvas is mapped to the project's component library (e.g. shadcn/ui Button, shadcn/ui Input); no custom base components; a component the library lacks is added to `docs/design-system/` first (with a Changelog entry), never a one-off
- [ ] Semantic color pairs meet contrast in both light and dark (`A11Y-1`)
- [ ] The same state uses the same pattern on every screen
- [ ] Persona and journey map exist; every journey drop-off risk has a designed state or message
- [ ] Every button, error, empty state and helper text is final copy (verb + object buttons, actionable errors, consistent terminology)
- [ ] Interaction spec covers every interactive element (trigger, feedback, timing, keyboard, reduced motion)
- [ ] `check-design.mjs` prints `ok`: no layout-animating transition, every duration and easing a token, a reduced-motion block, glass only from tokens with a reduced-transparency fallback, safe areas reserved, hover behind `(hover: hover)`, intrinsic layout, no raw hex, every inventory component on a canvas
- [ ] Adaptive: the compact, medium and expanded layouts are each drawn or specified, and navigation changes pattern between them (`LAYOUT-11`, `LAYOUT-12`)
- [ ] Glass, only when the design system chooses it: `GLASS-1` and `GLASS-4` hold (floating functional layer only, contrast over the worst content under it)
- [ ] Heuristic evaluation done; no open violation with severity ≥3
- [ ] A11y audit (WCAG 2.2 AA) passed: keyboard path, focus order, accessible names, target size, contrast
- [ ] Icons and illustrations are optimized SVG with `viewBox`, metadata stripped, alt text or `aria-hidden` set
- [ ] Design system: it already existed and was obeyed, or it was created after at most one question (a second round only when the user has a brand), nothing was asked that a file answered, no intake question was blocking, and the README has one `Style:` line (`starter` when no brand was supplied) with `[user]` or `[from code]` only on sourced values, not `[assumed]` on every value
- [ ] Screen map: none spec'd with `screen-map: none needed (<reason>)` in the brain note, or one `diagrams_spec` entry (`kind: screenmap`) that matches a trigger in `product-structure.md` and adds no screen the design lacks; you wrote no `.html` diagram file
- [ ] The `<brain>` note is written

### UX/UI rules by tier ([ux-ui-rules.md](ux-ui-rules.md))
Check in tier order. Start each `quality_checks.failed[]` entry with the rule id (e.g. `A11Y-2: focus ring missing on the filter chips`).

**Block** (CRITICAL and HIGH: any failure means `not-ready`)
- [ ] P1 Accessibility: `A11Y-1` to `A11Y-10`, including focus not hidden by sticky UI (`A11Y-2`) and a keyboard or single-pointer alternative for every drag (`A11Y-8`)
- [ ] P2 Touch: target size and the 8 px gap (`TOUCH-1`, `TOUCH-2`), press/loading/disabled states (`TOUCH-3`), no gesture-only action (`TOUCH-5`)
- [ ] P3 Performance: reserved space for async content, skeleton for waits over ~1 s, no layout shift on state change (`PERF-1` to `PERF-3`)
- [ ] P4 Style and icons: one icon family and stroke, no emoji icons, one primary action per screen (`STYLE-2` to `STYLE-4`)
- [ ] P5 Layout: 375 px has no horizontal scroll, the spacing scale is followed, fixed bars hide no content and reserve safe areas (`LAYOUT-2`, `LAYOUT-3`, `LAYOUT-6`, `LAYOUT-9`)
- [ ] P9 Navigation: back restores state, current location is marked, navigation is in the same place on every page (`NAV-1`, `NAV-2`, `NAV-4`)

**Record** (MEDIUM: a failure is written in `design.md` as rule id, what differs, why; it does not block)
- [ ] P6 Typography and color, P7 Motion, P8 Forms and feedback checked; each deviation has its line in `design.md`
- [ ] Dark mode, 375 px, landscape (where the platform has it) and reduced motion were each checked on their own, not inferred from one view

**Suggest** (LOW)
- [ ] P10 Charts: only if the task has a chart; findings go in the brain note as suggestions
- [ ] The final message ends with a valid JSON hand-off block
