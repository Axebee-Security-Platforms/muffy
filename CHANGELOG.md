# Changelog

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
