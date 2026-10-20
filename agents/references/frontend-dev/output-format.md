## Output Format

- Commits on your own branch
- `<brain>/agents/frontend-dev/<task>.md`
- PR diagram: `<worktree>/.pr-lens/graph.json` + render folder `.pr-lens/<title>/` with light + dark SVGs (not committed; the Orchestrator publishes it as an Artifact and copies `drawn.graph.json` for the reviewer)

Final message: branch, worktree path, files edited, diagram path, lint/test results, AC ids done, questions about the contract

Set `contract_commit` in the hand-off at step 4 (not 4a, not the fix lane) to the contract version you built against: `git -C <feature worktree> log -1 --format=%h -- .team/<task>/contract.md .team/<task>/contract`. If the contract changes while you work, re-read it and update the value; the Orchestrator does not merge a branch built against an older contract.

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).
