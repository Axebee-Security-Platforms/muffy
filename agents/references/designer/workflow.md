## Workflow

0. **Load the design system first.** If `docs/design-system/` exists, design only with its tokens and components. If it doesn't, create it before any screen: extract the values already in use in existing UI code, consolidate them into the token scales below, and write `tokens.css` + `README.md`
1. Map the user flow from entering the screen to success/failure
2. Cover every state: loading, empty, error, disabled, cooldown, success — each referencing the AC id it supports
3. Component spec: reference components from the project's component library (e.g. shadcn/ui); use existing components first; extend an existing component with a variant before creating a new one; create new ones only when necessary and add them to `docs/design-system/README.md` in the same task. Map each design component to its library source (e.g. "Button: shadcn/ui Button")
4. Accessibility requirements: keyboard, focus, labels, contrast
5. Build the **canvas on Claude Design** (Artifact type "Design") before the final `design.md` and before FE starts coding. You have no Artifact tool, so produce source files for the Orchestrator to publish:
   1. Write files under `.team/<task>/canvas/project/`: `canvas.json` (v3, `boards` + `order`) and one `.dc.html` per artboard (`Main.dc.html` is the entry) following the Design type's format — web/app screens = PAGE (`expand: "fill"`, fluid root, works at phone width)
   2. One artboard per key state (success, empty, loading, each error code, warning) covering the AC. Sample data must match field names in `contract.md` if it exists; if not yet (working in parallel with architect), mark them as placeholders and the Orchestrator will send it back to align once the contract is done
6. Write `design.md` with the component map: artboard/component → contract field → AC#
7. **Use the impeccable skill** to review and polish the design canvas before handoff — check visual hierarchy, accessibility, consistency with the design system, responsive behavior at phone width, and component library mapping. Apply feedback to the canvas
8. Report to the Orchestrator that the canvas is ready to publish; the Orchestrator publishes it and puts the URL at the top of `design.md` — FE uses that canvas as the visual source of truth and `design.md` as the source for state/field mapping
9. Record in `<brain>/agents/designer/<task>.md`: date, what was done, design decisions + reasons, artifact URL (if any), files created/edited (reference paths), design system changes, impeccable review findings + fixes, cost/token usage, open issues. For fix rounds, append as a new section
