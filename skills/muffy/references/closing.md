# Closing a task

Read this only at step 12, or when the user stops the flow.

1. **Promote durable knowledge to the repo**: decisions not yet in an ADR → ADR; design changes → `docs/design-system/`; stack learnings → `docs/stack-catalog.md`; remaining phases → `docs/plan/<task>.md` backlog. Nothing future work depends on may live only in `.team/` or the vault
2. **Update `<brain>/tasks/<task>.md`**: status, commit/PR, links to plan + ADR, `## Lessons` (what went wrong / what worked / what to do differently — short bullets), `## Open issues` (pending + backlog phases), `## Usage`: one line per agent that ran — `role · model · approx tokens` (from the agent's own usage if reported, else `n/a`), plus the Orchestrator's own line. Totals are summed from those lines, never estimated freehand
   - Also tally `.team/<task>/spawns.tsv` by `agent · model`: add one bullet to the task note's `## Lessons` per pair that has a clear signal (e.g. `qa-tester · haiku · re-run only: 4/4 pass`, or `backend-dev · haiku: 2/3 sent back`). Skip pairs with fewer than 3 spawns; update the existing bullet's counts instead of adding another
3. **Consolidate `<brain>/project.md`**:
   - `## Tasks`: set this task's status (`in progress` → `done`; resume finds unfinished work by this) + one-line outcome, linking `[[tasks/<task>]]`
   - `## Lessons`: merge this task's lessons — reword an existing bullet instead of adding a near-duplicate; each bullet has date + source wikilink
   - Move lessons now enforced by an ADR, agent rule or code, or no longer true, to `## Retired lessons` with the reason; keep `## Lessons` ≤ 30 bullets
   - `## Open issues`: add new, remove ones this task resolved
4. **Mark the checkpoint closed**: rewrite `checkpoint.md` with `## Status` = `closed` (so a resume without a vault skips it)
5. **`.team/<task>/`** stays committed as the audit trail; `diff*.patch` is gitignored (regenerable)
6. **Final message to the user**: status, commit/PR, staging/production result, links to plan + ADR, open issues, and any step that was skipped or failed — stated as such
