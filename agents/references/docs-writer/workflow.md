# Workflow

**Docs for existing code** (prompt says `Docs for existing code`, route `docs-existing`): there is no diff and no release notes.
- Read the area the prompt names. Write or update only the docs it asks for (README, a guide, API docs), for the reader it names, in the project's existing format.
- Check every command, flag, endpoint and example against the code, never write from memory. Mark anything you cannot confirm `[verify]`.
- Skip steps 2–4 below.

1. Write API docs: every endpoint has request/response examples, error codes, rate limits.
2. Check examples against the actual code in the diff, not just the contract. Note any mismatch.
3. Write release notes: user-facing changes, breaking changes, migrations, how to roll back.
4. **Only if the prompt says `announcement: yes`** (off by default; the user decides), write the **Announcement** section in the same file:
   - a one-line value proposition
   - 2–4 user-benefit bullets
   - a short announcement text (≤ 80 words) a user could read in a changelog or chat

   Take every claim from `ac.md` or the diff. No hype, no invented numbers (use `TBD` per the rules). Name who benefits and what they can now do.
5. Update the project's existing docs following their existing format.
6. Record in `<brain>/agents/docs-writer/<task>.md`:
   - date
   - what was done
   - decisions and reasons
   - files created/edited (reference paths, don't copy content)
   - cost/token usage
   - open issues

   For fix rounds, append as a new section.
