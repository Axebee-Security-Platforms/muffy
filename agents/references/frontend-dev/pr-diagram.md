## PR Diagram

Draw the change you made as a PR Lens diagram so the Orchestrator and reviewers see the blast radius before reading code. Uses the `pr-lens` CLI; nothing to install (needs Node 18+ and network for `npx`). Token cost is real (a diagram is ~4k tokens of output), so draw only when it pays off.

### When
**Off by default. Do not draw a diagram** unless the Orchestrator's prompt explicitly says to draw the PR diagram. When it is not asked for, skip every step below, write `diagram: not requested` in the brain note, and do not count it as a failed quality check.

When it is asked for:
- `<base>` is the branch the feature merges into (prompt or checkpoint `base:`; never assume `main`). Run `git diff --shortstat <base>...HEAD` after lint/tests pass and everything is committed.
- **Draw** if the diff touches 6 or more files, or adds/removes/changes an endpoint, route, migration, or a call across the FE/BE boundary. Otherwise skip with `diagram skipped: small change`.
- Fix rounds: redraw only if the set of changed files or flows changed; otherwise reuse the earlier diagram and say so.

### Steps
1. Read [pr-lens-format.md](../shared/pr-lens-format.md) (the short form of the graph document). Do not load the CLI manual unless validate fails twice for a reason that page does not explain.
2. Read your diff (`git diff <base>...HEAD`) and write the graph document yourself; no model key is needed.
3. Save it to `<worktree>/.pr-lens/graph.json`. Title it `fe: <task>` so it renders to its own folder. Do not commit `.pr-lens/` (the CLI adds it to `.gitignore`).
4. Run `npx @coldtea/pr-lens-cli@latest validate .pr-lens/graph.json` and fix the named field until it passes.
5. Run `npx @coldtea/pr-lens-cli@latest render .pr-lens/graph.json --theme light`, then again with `--theme dark`. SVGs land in a folder under `.pr-lens/` named after the title; report that folder path.

### What the diagram must show
- Lanes: route/page, component, state/store, API client, and the backend endpoint each call hits.
- Each design.md screen state you added or changed (loading, error, disabled, cooldown) as a card or label on its component.
- Colors: green = new, amber = changed, red = removed. Mark every file in the diff; no file left off.
- Data flow steps in order, one arrow per call, in the order they run.
- Scope: only your side's files plus the neighbours they call. Do not draw the other side's internals.

### Rules
- If validate keeps failing after 3 attempts, or `npx` has no network, skip the diagram: list `diagram skipped: <why>` in `quality_checks.failed` and continue. Never block the hand-off on it.
- Do not publish anything yourself: no `canvas push` (it uploads to prlens.dev), no `gh pr --attach`. You have no Artifact tool; the Orchestrator publishes it as a Claude Artifact and copies `drawn.graph.json` for the reviewer.
- Do not invent components, endpoints or fields that are not in the diff or `contract.md`.
- Never edit generated SVG by hand; fix the JSON and render again.
