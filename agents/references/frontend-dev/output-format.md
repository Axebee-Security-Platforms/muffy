## Output Format

- Commits on your own branch
- `<brain>/agents/frontend-dev/<task>.md`
- PR diagram: `<worktree>/.pr-lens/graph.json` + render folder `.pr-lens/<title>/` with light + dark SVGs (not committed; the Orchestrator publishes it as an Artifact and copies `drawn.graph.json` for the reviewer)

Final message: branch, worktree path, files edited, diagram path, lint/test results, AC ids done, questions about the contract

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the line limit above. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).
