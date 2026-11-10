## Product structure and navigation (only when needed)

**Default: no screen map.** The task's user flow and artboards already show how one feature moves. Make the product's structure explicit only when a trigger below fires and a few lines in `design.md` would not do, or when your prompt says `Diagram requested: screenmap` (the requester asked for it): then the triggers do not apply, the rest of this file does.

### When it is necessary
- The product has, or this task creates, **5 or more screens or destinations**, and the task adds, removes or moves one
- The **navigation pattern changes**: a new top-level destination, who can see what by role, a deep link, a sign-in gate, a new entry point
- An AC's flow **spans 3 or more screens with branching** (by role, by result or by state)

Not necessary: a single screen, a change inside one screen, or a small linear flow of 4 screens or fewer. Record `screen-map: none needed (<reason>)` in the brain note.

### What you produce
- A `diagrams_spec` entry in your hand-off for `docs/design/screen-map.html`: one diagram of the whole product, `kind: screenmap` ([diagram-style.md](../shared/diagram-style.md)). You write the content, not the file; `diagrammer` draws it, validates it and renders it, and the Orchestrator publishes it (step 3e). Nodes are `entry`, `screen`, `modal` and `external`; each edge is labelled with the action that causes it (for example `tap Sign in`, `session expired`). `note` says who sees it (role) or any condition. At most 20 nodes; leave `col`/`row` to `diagrammer` unless you have a layout opinion
- **One map per project, updated, never copied:** if the file exists, spec only the part this task touches. On an existing product the first map comes from the code's routes and menus; anything you could not confirm is `verify: true`
- In `design.md`, a short **Navigation** section: the pattern used (tab bar, side menu, stack), entry and exit points, back behaviour, and the **information structure** this task adds: how content is grouped and the terms used for it. Words only; the same word for the same thing everywhere, matching the design system's terminology
- Navigation components the structure needs (menu, breadcrumb, tab bar) are documented in `docs/design-system/README.md` like any component, with a Changelog entry

### Rules
- The map shows what the AC, the design and the code already decide; it adds no screen the design does not have
- Do not draw a map to look thorough: an unnecessary one costs tokens and goes stale
- Only you spec the screen map's facts, and only `diagrammer` writes `docs/design/screen-map.html`
