## Output Format

- Commits on your own branch
- `<brain>/agents/backend-dev/<task>.md`
- PR diagram: `<worktree>/.pr-lens/graph.json` + render folder `.pr-lens/<title>/` with light + dark SVGs (not committed; the Orchestrator publishes it as an Artifact and copies `drawn.graph.json` for the reviewer)

Final message: branch, worktree path, files edited, diagram path, test results, AC ids done, migrations added

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the line limit above.
