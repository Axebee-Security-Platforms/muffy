# Design review (step 3c, UX/UI)

The Orchestrator reviews the **rendered** canvas before the user sees it at `pause:design-review`. The designer cannot do this: it has no browser and cannot open the Artifact, so it only checks its source files. This review is the second pair of eyes, on the screens as they render.

Run it after 3b publishes the canvas and after the designer's Definition of done (3c check 1) passes. Read this file only then.

## Procedure

1. **Skill present?** The `impeccable` skill must be available in the main session. Not installed → skip this review, write `ux-review: skipped (impeccable not installed)` in checkpoint `## Status`, and say so in the 3c question. Never block the gate on it
2. **Open the canvas** at its Artifact URL (`canvas:` in checkpoint `## Status`) in the browser pane. `Platform: web` → desktop width and phone width (375px). `mobile` → the phone frame (375 × 812), plus tablet only if the AC names it. `desktop` → the window's min and default sizes from the AC, no phone frame ([platforms.md](platforms.md#routing)). Judge against the platform's own conventions (system navigation, native controls, touch target size) as well as the design system
3. **Run the impeccable skill's critique and audit** on what renders, scoped to this task's artboards (every AC × state in `design.md`), against `docs/design-system/` tokens and components. Look at: visual hierarchy, layout and spacing, typography, colour and contrast in light and dark, phone-width behaviour, states (empty, loading, error), copy, and consistency between screens. Review only; never edit the canvas or `docs/design-system/` yourself
4. **Write `.team/<task>/design-review-<n>.md`** (≤ 60 lines): one row per finding, `id · artboard · problem · severity (high | medium | low) · suggested fix`. `high` = blocks an AC, fails WCAG 2.2 AA, breaks at phone width, or contradicts the design system. Ids are `UX-<n>`, stable across rounds like blocker ids
5. **Route on severity**:
   - Any `high` → `SendMessage` the designer with the path of `design-review-<n>.md` (+ `architect` if a fix touches the contract). Designer fixes, the Orchestrator republishes, then runs 3c check 1 and this review again on the changed artboards only. Each send-back counts at loop point `3c:designer` ([loops.md](loops.md))
   - No `high` → go to the user question; list the `medium` and `low` findings there as suggestions the user may accept or ignore
6. **The user question** also carries the links of the diagrams 3e published this round (the screen map, `docs/design/screen-map.html`, when the designer specced one and the diagrammer drew it) and the designer's non-blocking intake question, if its hand-off had one (the default option first). An intake answer other than the default → record it in `requirements.md`, resume the designer with that path to apply the brand, republish, re-run 3c check 1 and this review on the changed artboards, then ask again. It is a clarification round ([requirements.md](requirements.md)), not a loop

## Standalone (route `design-review`)
The requester asks for a UX/UI review of screens that already exist, outside a task. Run steps 1–3 on what they named (a canvas or Artifact URL, a running page URL, or screenshots) instead of the task canvas; with no `design.md`, review every screen given, against `docs/design-system/` when it exists and the platform conventions otherwise. Give the findings in chat in the step 4 row format; write no file, create no task folder, spawn no designer. A fix is a new request: the requester picks a design or fix route.

## Rules

- The user decides. A finding is advice; only the user's Approve passes the gate
- Don't relay: the designer gets the file path, never pasted findings
- Token discipline: review only the artboards this task added or changed; on a re-review, only the ones the fix round touched
- Record in checkpoint `## Status`: `ux-review: r<n> · high <k> · medium <k> · low <k>` (or `skipped`)
