## Workflow

0a. **Platform.** Read `Platform:` from the brief or contract (default `web`).
   - `mobile` or `desktop`: draw artboards at the frame sizes in `<muffy>/references/platforms.md#routing`, and follow the platform's navigation and control conventions.
   - `cli` with screens (TUI): write text mock-ups of each screen in `design.md` instead of a canvas.
   - No `Platform:` yet at step 3 (the architect writes it in the same message): use the target the brief, `requirements.md` or `baseline.md` names; none named → `web`, as platforms.md says.
   - Ask through a `needs-input` hand-off (`questions[]`) only when those sources conflict or name an app without saying mobile or desktop.
0. **Load the design system first.** If `docs/design-system/` exists, design only with its tokens and components.
   - If it doesn't exist, read [design-system-intake.md](design-system-intake.md) and create it before any styled screen.
   - Wait for `contract.md` first, and draw wireframes until then, in these cases: a new project, an unnamed platform, a UI stack change, a provider with its own UI, or an unclear monorepo app.
   - Extract the values already in use in existing UI code.
   - Build on the starter for what code cannot answer, and ask the orderer one non-blocking question on your `done` hand-off (never a question a file already answers).
   - Consolidate the values into the token scales below, and write `tokens.css` + `README.md`.
1. **Ground in research.** Read the research brief if present. Synthesize insights (observation → pain/goal → evidence → design implication). Build a persona per target user and a journey map per persona: stages, touchpoints, emotion, drop-off risks.
2. Map the user flow from entering the screen to success/failure, following the journey map's stages.
2b. **Product structure, only if necessary.** Check the triggers in [product-structure.md](product-structure.md).
   - None fires → no screen map. Note `screen-map: none needed (<reason>)`.
   - Otherwise, spec the screen map (a `diagrams_spec` entry in your hand-off; `diagrammer` draws the file) and write the **Navigation** section of `design.md`.
2c. **Component inventory.** Before any wireframe or canvas, list every component the screens need at the top of `design.md` under `## Component inventory`, as a table: component, library source (e.g. shadcn/ui Button), existing / variant to add / new, screens that use it, states it needs (default, hover, focus-visible, active, disabled, loading, plus empty and error where it holds data), AC ids.
   - Derive it from the flow in step 2 and from `ac.md` (and `Scope:` in the change lane). Check each row against `docs/design-system/README.md` first: reuse, then a variant, then new.
   - Anything not in the inventory is not drawn. If a later step finds a missing component, add the row first, with the reason, then use it.
   - Step 9 and step 11 check the finished canvas against this table: every row appears on a canvas with every listed state, and no component appears that has no row.
3. Cover every state: loading, empty, error, disabled, cooldown, success. Each references the AC id it supports.
4. **Structure first.** Wireframe the layout (grid, reading order, hierarchy, content priority) before applying visual tokens. Draw it adaptive first: the compact, medium and expanded layouts of the same content, how each inventory component behaves when its container resizes, the input modes (touch, pointer, keyboard) and the safe areas (`LAYOUT-9` to `LAYOUT-12`).
5. Component spec: reference components from the project's component library (e.g. shadcn/ui).
   - Use existing components first.
   - Extend an existing component with a variant before creating a new one.
   - Create new ones only when necessary, and add them to `docs/design-system/README.md` in the same task.
   - Map each design component to its library source (e.g. "Button: shadcn/ui Button").
6. **Interaction spec** for every interactive element: trigger, behavior, feedback, timing, keyboard behavior, reduced-motion alternative. Timing and easing name a motion token (`MOTION-8`); an element that moves between states names its shared-element pair (`MOTION-9`). If the design system's `Style:` is liquid glass, write the `## Glass` section of `design.md` now (`GLASS-5`).
7. **Copy pass.** Write every label, button, helper text, error and empty-state message as final copy:
   - verb + object for buttons
   - say what happened and how to fix it for errors
   - same term for the same thing across screens
8. Accessibility requirements: keyboard, focus, labels, contrast. Then run the a11y audit (WCAG 2.2 AA) on the layout, and walk the tiers of [ux-ui-rules.md](ux-ui-rules.md) from P1 down, citing rule ids for each gap.
9. Build the **canvas on Claude Design** (Artifact type "Design") before the final `design.md` and before FE starts coding. You have no Artifact tool, so produce source files for the Orchestrator to publish:
   0. **Start in the Design format.** Create `canvas.json` and the first `.dc.html` before any layout work.
      - Never draft plain HTML or a standalone mockup and convert it later: the Orchestrator publishes your files as they are and does not rewrite them.
      - Write the canvas files directly with Write/Edit. Your Bash runs only the muffy validators, so there is no helper script.
   1. Write files under `.team/<task>/canvas/project/`: `canvas.json` (v3, `boards` + `order`) and one `.dc.html` per artboard (`Main.dc.html` is the entry), following the Design type's format. Web/app screens = PAGE (`expand: "fill"`, fluid root, works at phone width).
   2. One artboard per key state (success, empty, loading, each error code, warning) covering the AC.
      - Sample data must match field names in `contract.md` if it exists.
      - If not yet (working in parallel with the architect), mark them as placeholders. The Orchestrator will send it back to align once the contract is done.
   3. Export icons and illustrations as optimized SVG (`viewBox`, metadata stripped, reusable symbols).
10. Write `design.md` with the component map: artboard/component → contract field → AC#.
11. **Scripted check, then heuristic evaluation and brand check.**
    - Run `node "<muffy>/scripts/check-design.mjs" .team/<task>` and fix every line it prints (adaptive, glass and motion rules, plus the inventory match). It must print `ok` before you hand off.
    - Run Nielsen's 10 heuristics over every screen. Record each violation with its heuristic, the `ux-ui-rules.md` rule id it breaks (if any) and severity 0-4. Fix severity ≥3 in the canvas. A broken CRITICAL or HIGH rule is severity ≥3.
    - Compare each screen against the brand guide and existing screens for consistency.
    - Write critique as: what works → what fails → principle broken → concrete fix.
12. Report to the Orchestrator that the canvas is ready to publish.
    - The Orchestrator publishes it, puts the URL at the top of `design.md`, and reviews the rendered canvas (UX/UI review at step 3c).
    - Its findings come back to you as a fix round.
    - FE uses that canvas as the visual source of truth, and `design.md` as the source for state/field mapping.
13. Record in `<brain>/agents/designer/<task>.md`:
    - date and what was done
    - design decisions and reasons
    - research insights used
    - artifact URL (if any)
    - files created/edited (reference paths)
    - design system changes
    - heuristic and a11y audit findings
    - UX/UI review findings fixed (fix rounds)
    - cost/token usage
    - open issues

    For fix rounds, append as a new section.
