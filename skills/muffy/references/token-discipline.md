# Token discipline

- **Prompt template** — every subagent prompt is only this, no pasted file contents:
  ```
  Goal: <one line>
  Task: <task>  Brain: <brain>  [Vault: <vault> — researcher only]  [Mode: — devops only]
  Read: <paths>
  Write: <paths>
  Don't touch: <paths/scope>
  Final message: ≤ 10 lines — verdict/status, paths written, blockers. Details belong in files
  ```
- **Fix rounds continue the same agent** with `SendMessage` (its context is still loaded) and send only that owner's blockers/bugs as a list. Spawn fresh only if the agent is gone
- **Incremental diffs**: export each round as `diff-<n>.patch` containing only the changes since the last review
- **Read narrowly**: for gates and traceability checks, grep or read only the section needed (e.g. the `AC id →` table) instead of whole files; don't re-read a file you already checked unless it changed
- **Don't relay**: never copy one agent's output into another's prompt — give the path
- **Model tiers**: `haiku` and `sonnet` are the default; never pass `fable`. `opus` is allowed only for `researcher` at L3, and only after the L3 Human gate (see `agents/references/researcher/workflow.md` → Model per level). Agent frontmatter sets the default (`docs-writer` and `researcher` = haiku, the rest = sonnet). When spawning fresh (not `SendMessage`), pass `model: "haiku"` for:
  - `qa-tester` re-running existing tests only (no new tests to write)
  - `frontend-dev` / `backend-dev` fix rounds where every bug names a file + line and the expected fix
- **Researcher model per level**: L0/L1 → `haiku`, L2 → `sonnet`, L3 → `opus` (after Human gate). Escalate by spawning fresh, not `SendMessage`
- **Never downgrade** `code-reviewer`, `architect`, or `devops` in production mode — a miss there costs more than the tokens saved
