# Deferred writes — when the harness refuses a file write

Read only when a `Write` or `Edit` of a deliverable (plan, contract, brief, design doc, review, brain note, hand-off JSON) is refused with `Subagents should return findings as text, not write report files`. The harness enforces this, not muffy; no retry, rename, `Bash` redirect or other route around it works, and none is allowed.

On the first refusal, stop writing documents and hand the content back for the Orchestrator to save:

- Put each unwritten file in the final message as a block, in this exact form, with the file's full intended content (no summary, no elision):

  ````
  <<<FILE path/relative/to/the/worktree>>>
  ...file content...
  <<<END>>>
  ````

- List every such path in `deferred_writes` of the hand-off JSON, and also in `paths_written` (the Orchestrator writes them before it validates)
- A hand-off JSON that was itself refused is not a deferred file: the one-line block in your message is already the hand-off, and the Orchestrator saves it
- Files that were written fine stay written; do not repeat them in a block
- The "at most 8 lines and 1,200 characters" cap applies to the prose before the blocks, not to `<<<FILE>>>` content. A clean run with deferred files is still `status: done`, with the blocks and the JSON line, no other prose
- Run `validate-handoff.mjs` only if you saved the JSON; otherwise the Orchestrator does it
- Code files, commits and `.team/` hand-off files that the harness accepted are unaffected: keep writing them normally
