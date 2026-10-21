## Quality Checks

Definition of done. Check the items below before **every** hand-off; if one is false, report "not ready to hand off" with what's missing. Two items depend on the Orchestrator and are checked only where marked:

At step 3 (first round, parallel with architect) the canvas source is ready to publish with no URL yet, and fields not yet in `contract.md` are marked as placeholders; neither counts as a failure. When the design system waits for the contract (design-system-intake.md), the step-3 artboards are wireframes, `design.md` starts with `Design system: after contract (<condition>)` and no `docs/design-system/` file is written; that is not a failure either. In the align round (after `contract.md`, step 3b/3c) the two `[3b/3c]` items must also be true; the Orchestrator verifies the published canvas at the 3c gate.

- [ ] `[3b/3c]` The Artifact URL the Orchestrator published is at the top of `design.md` (you cannot open it; the Orchestrator checks it is viewable)
- [ ] The canvas source is `canvas.json` (v3) plus `.dc.html` artboards listed in it; there is no plain `.html` mockup, and nothing needs converting before publish
- [ ] Artboards exist for every screen × every state the AC requires (table `AC id → artboard`); no AC without a visual
- [ ] `[3b/3c]` No `Design system: after contract` line is left in `design.md`: the design system exists for the contract's library and platform and every artboard uses its tokens
- [ ] `[3b/3c]` Fields/names are aligned with `contract.md` — no placeholders waiting on the contract (at step 3: every not-yet-known field is marked as a placeholder)
- [ ] On-screen text is final copy (FE can copy it verbatim)
- [ ] Works at the sizes the platform needs, per `.claude/skills/muffy/references/platforms.md#routing`: web, phone width (no horizontal scroll); mobile, the phone frame; desktop, the window's min and default sizes
- [ ] Every value on the canvas comes from `tokens.css`; no raw hex/px outside it (native targets: the same tokens, named so the stack's theme layer can bind them)
- [ ] Every component used is documented in `docs/design-system/README.md` with variants and states; new or changed ones are in the Changelog
- [ ] Every component on the canvas is mapped to the project's component library (e.g. shadcn/ui Button, shadcn/ui Input); no custom base components; a component the library lacks is added to `docs/design-system/` first (with a Changelog entry), never a one-off
- [ ] Semantic color pairs meet contrast in both light and dark
- [ ] The same state uses the same pattern on every screen
- [ ] Persona and journey map exist; every journey drop-off risk has a designed state or message
- [ ] Every button, error, empty state and helper text is final copy (verb + object buttons, actionable errors, consistent terminology)
- [ ] Interaction spec covers every interactive element (trigger, feedback, timing, keyboard, reduced motion)
- [ ] Heuristic evaluation done; no open violation with severity ≥3
- [ ] A11y audit (WCAG 2.2 AA) passed: keyboard path, focus order, accessible names, target size, contrast
- [ ] Icons and illustrations are optimized SVG with `viewBox`, metadata stripped, alt text or `aria-hidden` set
- [ ] Design system: it already existed and was obeyed, or it was created after at most one question (a second round only when the user has a brand), nothing was asked that a file answered, no intake question was blocking, and the README has one `Style:` line (`starter` when no brand was supplied) with `[user]` or `[from code]` only on sourced values, not `[assumed]` on every value
- [ ] Screen map: none spec'd with `screen-map: none needed (<reason>)` in the brain note, or one `diagrams_spec` entry (`kind: screenmap`) that matches a trigger in `product-structure.md` and adds no screen the design lacks; you wrote no `.html` diagram file
- [ ] The `<brain>` note is written
- [ ] The final message ends with a valid JSON hand-off block
