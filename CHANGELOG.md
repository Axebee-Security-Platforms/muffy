# Changelog

## Unreleased

### Changed

- **Infrastructure is the human's, not devops's.** Onboard and setup no longer ask the infrastructure question, `infra:` is gone from checkpoints and `project.md`, and devops no longer proposes hosting options or applies infrastructure practices (`infrastructure-options.md`, `infrastructure-best-practices.md` and devops web access removed). `deploy.md` keeps `## Pinned runtime`, `## Target`, `## Files devops owns` and `## Risks`; devops still pins the runtime, owns local Dockerfile/compose/CI files and smoke-builds on docker local.
- **No staging or production in any lane.** Work ends on docker local at the Human gate; deploying is the user's step. Steps 8 (docs review) and 9 (staging) are gone and step 11 is now `docs-writer` instead of `devops` production; ids are kept so hand-offs and scripts keep one numbering. `pause:staging-credentials`, the staging question at `pause:scope`, the `staging_none` smoke trigger and devops mode 3 (and its `fix-profile.md`) are removed. The `ops` route is now local infra only; a deploy or rollback request is answered with the Deploy hand-off instead of routed.
- **`docs-writer` runs last, after the Human gate approves,** in the full flow, lite, fix and the new redesign lane. It writes only what the diff touched, with no `TBD` and no second round, ends `release-notes.md` with a **Deploy hand-off** and self-checks its sources; no `code-reviewer` pass. Fix and lite may skip it when nothing a user sees changed, there is no migration or config and no doc mentions the changed part (`docs skipped: <reason>`). The gate summary at step 10 no longer shows release notes or a staging result.
- **Full flow is the last route, not the default.** Decision step 6.4 is replaced: a change to something the product already has goes to redesign, a capability it lacks goes to full flow, and anything vaguer is asked in rounds until one route fits. "ทำเลย" or "แล้วแต่" picks the smallest route that fits.

### Added

- **Redesign lane** (`/muffy redesign`, `references/redesign-profile.md`) for changing an existing screen, UX flow or business-logic rule. The scope (UI only, UI + logic, logic only) is always asked at `pause:scope`; each scope runs only the agents it needs, QA is L3 limited to the touched paths, the AC and design are approved together for UI only, and `pause:scope-upgrade` handles a UI-only run that turns out to need logic. `gate-rules.mjs`, `checkpoint.mjs` and `gate-summary.mjs` know the lane; checks in `scripts/lib/redesign-lane-evals.mjs`.

- **Designer UX/UI rules in priority tiers.** New `agents/references/designer/ux-ui-rules.md` ranks the rules P1 (accessibility) to P10 (charts), adapted from the `ui-ux-pro-max` skill. CRITICAL and HIGH tiers (P1-P5, P9) block the hand-off, MEDIUM tiers (P6-P8) are recorded in `design.md`, LOW (P10) is advice. Each rule has an id that quality checks, the heuristic evaluation and the step 3c review cite.
- **`ux-search.mjs` for the designer.** A Node port of the `ui-ux-pro-max` BM25 search (MIT, notice in `skills/muffy/data/ux/LICENSE`) over five tables in `skills/muffy/data/ux/`. Read-only. `guard-bash-allowlist.mjs` lets only `designer` run it; every other guarded role is refused.

### Fixed

- **Human gates are enforced, not only written.** Step 2b (`pause:plan-review`) and step 3c (`pause:design-review`) were prose: a run could spawn designer, frontend-dev and backend-dev with no answer on record, and merge after a rejected review. Now:
  - `guard-gates.mjs` (PreToolUse on `Agent|Task`, installed by `--with-guard`) blocks a spawn until its gate is recorded as passed or skipped. Spawns are matched to a task by the `Task:` header of the prompt envelope.
  - `checkpoint.mjs gate <dir> 2b|3c approve|reject|skip` is the only writer of the gate lines in `## Status`. Approval needs the pause saved first and a ready `gate-summary.mjs` body; skipping 3c is refused once `design.md` exists.
  - `check-all` has a `gates` check: a hand-off past an open gate is an error (feature lane only).
  - Rules live in `scripts/gate-rules.mjs`; offline checks in `scripts/lib/gate-evals.mjs`.
- **Known limit:** no hook can tell the user's reply from one the Orchestrator types. The answer is a dated, auditable line in `## Status`.
- **The gate guard fails closed.** A run built spawn prompts by hand, with no `Task:` header, so `guard-gates.mjs` let every spawn through and designer, architect and devops started before gate 2b was recorded. Now:
  - A gated muffy role spawned without the header is matched to the task its prompt names (`.worktrees/feature-<task>` or `.team/<task>`) and checked as usual. It is blocked when the prompt names no task while any checkpoint exists in the repo. Roles outside muffy, and product-manager and researcher, are not affected.
  - `checkpoint.mjs unpause` refuses to clear `pause:plan-review` or `pause:design-review` while the gate has no recorded answer, including after a rejection. `checkpoint.mjs gate` records the answer and clears the pause.

## v1.3.0 — 2026-10-22

Changes since v1.2.0.

### Added

- **Routing:** `/muffy feature` forces the full flow without triage. Only the route decision is skipped; intake, `pause:scope` and every gate still run. New route-sim signal, two scenarios and a README section.
- **Routing:** one decision order, four new routes, and a route eval. Requests are routed to the owning agent.
- **Lite lane** for internal work with a known shape.
- **Presenter agent** for client and end-user decks (`/muffy present`). Present mode now sits with the product-manager; the designer builds the deck.
- **Diagrammer agent** owns drawing, validation, the render check and readability (plain words, sequence) of every diagram. Split out of the designer; facts stay with their owners.
- **Diagram kinds:** state, deployment, gantt and story-map (product-manager). Optional patterns: queue-bottleneck, lifecycle, trust-boundary, delta, db-schema.
- **Diagram import/export:** import Mermaid, draw.io and Excalidraw as a muffy draft (reads gantt and journey); export any kind as PNG or native SVG.
- **Diagram checks:** readability checks, either/or branches in flow, render check at every delivery gate, standalone diagram mode.
- **Platforms and infra:** non-web platforms, providers, infra and stack learning.
- **Brain:** falls back to `.team/brain` when no vault is set; closing can append an optional daily-note link to the vault.
- **Agents:** `display_name` in agent frontmatter (devops is "Cay"); source file size cap for FE/BE agents with a language-neutral split rule.
- **Guards:**
  - `guard-git` blocks subagents from changing git setup.
  - `guard-env` blocks inline interpreter code that loads `.env`.
  - `check-checkpoint` requires `tok:` on every spawn line, and flags a `tok` that drops for the same step and agent.
  - `check-ownership` catches FE/BE conflicts before the step-5 merge.
  - Agents learn their write scope before acting. The `guard-write-scope` rules moved to `scripts/write-scope.mjs`, shared with `make-envelope.mjs`. The envelope refuses a `Write:` path the role may not write.
- **Scripts:** `run-quiet.mjs` (digest instead of full output), `make-envelope.mjs` (validated prompt from flags), `baseline-delta.mjs` (changed folders since the baseline commit).

### Changed

- **Token use:** hard cap on subagent final messages, turn budget, schema `summary` max 300 chars, quiet Bash, section reads, compaction at gates. Based on real runs where hand-backs averaged 4.4 KB against a 10-line rule.
- `SKILL.md` is a slimmer index; the artifact list moved to `memory-model.md`.
- Mode commands skip `route.md`; worked examples moved to `route-examples.md` (19 KB → 14.5 KB).
- Onboard refresh edits the baseline in place from a delta instead of re-exploring; `baseline.md` is an index with per-section files written by the researcher.
- `spawns.tsv` `tok:` is documented as cumulative per agent; the Lessons tally counts spawns per agent; docs-writer stays on sonnet for number/policy-list docs.
- Designer takes its aesthetic direction from the frontend-design skill (distinctive look, two-pass plan), and waits for the contract before building the design system when the stack is unsettled.
- Architect and PM only spec facts; the diagram drawing moved out of them.
- Dev roles run env-loading code through project scripts.
- Diagram caption removed.

### Fixed

- Feature worktree holds the team folder; guard markers are scoped to the task.
- Closing records real token counts; `spawns.tsv` written in the fix lane; no abbreviated close.
- Designer intake never stops the run; screen map wiring.
- Diagram: ERD requests route by whether the subject exists or has an open task; every kind is covered, not only ERD; caption wrapping; import/export bugs; lint crash.
- Presentation checker loopholes (features units, numeric entities, slide class match).
- Researcher docs cover the no-vault brain at `.team/brain`.
- Stale evals updated.

### Docs

- README: commands table, diagram mode, corrected agent count, `/muffy feature` in feature examples.
- Research note on diagram kinds muffy lacks for non-engineer readers.
- Removed unused `docs/diagram-design-examples`.
