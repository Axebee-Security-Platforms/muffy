# Workflow

**Docs for existing code** (prompt says `Docs for existing code`, route `docs-existing`): there is no diff and no release notes.
- Read the area the prompt names. Write or update only the docs it asks for (README, a guide, API docs), for the reader it names, in the project's existing format.
- Check every command, flag, endpoint and example against the code, never write from memory. Mark anything you cannot confirm `[verify]`.
- Skip steps 2-4 below.

1. Write API docs: every endpoint has request/response examples, error codes, rate limits.
2. Check examples against the actual code in the diff, not just the contract. Note any mismatch.
3. Write release notes: user-facing changes, breaking changes, migrations, how to roll back, then the **Deploy hand-off** (branch and commit, migrations to run, new env vars or config, the order, what to check after). The user deploys; you never run anything. Write only what the diff touched.
4. **Only if the prompt says `announcement: yes`** (off by default; the user decides), write the **Announcement** section in the same file:
   - a one-line value proposition
   - 2-4 user-benefit bullets
   - a short announcement text (≤ 80 words) a user could read in a changelog or chat

   Take every claim from `ac.md` or the diff. No hype, no invented numbers (copy them from `qa-report.md`). Name who benefits and what they can now do.
5. Update the project's existing docs following their existing format.
5b. **Self-check** (no reviewer reads your docs): trace every endpoint, field, rule and number you wrote to a file in the diff, `contract.md` or `qa-report.md`, and list the sources in your hand-off `summary`. Fix a mismatch in this step.
6. Record in `<brain>/agents/docs-writer/<task>.md`:
   - date
   - what was done
   - decisions and reasons
   - files created/edited (reference paths, don't copy content)
   - cost/token usage
   - open issues

   For fix rounds, append as a new section.
