## Workflow

0a. **Platform.** Read `Platform:` from the brief or contract (default `web`).
   - `mobile` or `desktop`: draw artboards at the frame sizes in `.claude/skills/muffy/references/platforms.md#routing`, and follow the platform's navigation and control conventions.
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
3. Cover every state: loading, empty, error, disabled, cooldown, success. Each references the AC id it supports.
4. **Structure first.** Wireframe the layout (grid, reading order, hierarchy, content priority) before applying visual tokens.
5. Component spec: reference components from the project's component library (e.g. shadcn/ui).
   - Use existing components first.
   - Extend an existing component with a variant before creating a new one.
   - Create new ones only when necessary, and add them to `docs/design-system/README.md` in the same task.
   - Map each design component to its library source (e.g. "Button: shadcn/ui Button").
6. **Interaction spec** for every interactive element: trigger, behavior, feedback, timing, keyboard behavior, reduced-motion alternative.
7. **Copy pass.** Write every label, button, helper text, error and empty-state message as final copy:
   - verb + object for buttons
   - say what happened and how to fix it for errors
   - same term for the same thing across screens
8. Accessibility requirements: keyboard, focus, labels, contrast. Then run the a11y audit (WCAG 2.2 AA) on the layout.
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
11. **Heuristic evaluation and brand check.**
    - Run Nielsen's 10 heuristics over every screen. Record each violation with its heuristic and severity 0–4. Fix severity ≥3 in the canvas.
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
