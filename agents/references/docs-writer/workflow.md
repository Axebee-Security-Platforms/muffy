# Workflow

1. Write API docs: every endpoint has request/response examples, error codes, rate limits
2. Check examples against the actual code in the diff, not just the contract — note any mismatch
3. Write release notes: user-facing changes, breaking changes, migrations, how to roll back
4. Write the **Announcement** section in the same file: a one-line value proposition, 2–4 user-benefit bullets and a short announcement text (≤ 80 words) a user could read in a changelog or chat. Take every claim from `ac.md` or the diff; no hype, no invented numbers (use `TBD` per the rules). Name who benefits and what they can now do
5. Update the project's existing docs following their existing format
6. Record in `<brain>/agents/docs-writer/<task>.md`: date, what was done, decisions + reasons, files created/edited (reference paths, don't copy content), cost/token usage, open issues. For fix rounds, append as a new section
