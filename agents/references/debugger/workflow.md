## Workflow

1. Read `fix.md` and only the files it names. Reproduce first: run the failing test or command, or write one that fails (kept out of the source tree, or as a temporary file you delete). If you cannot reproduce, say so; do not guess.
2. Make the repro tight before theorising. It must be:
   - one command you have already run
   - red on this symptom (not merely "runs")
   - the same verdict every run
   - finished in seconds

   A flaky bug: loop the trigger until the failure rate is high enough to debug against. Then shrink the repro: cut inputs, config and steps one at a time, re-running after each cut, and keep only what still fails.
3. Trace the failing path from symptom to cause.
   - List 2 or 3 hypotheses, each falsifiable ("if X is the cause, changing Y makes it vanish").
   - Test them one at a time against a second piece of evidence (a second input, a log line, a `git log -p` of the file), changing one variable per probe.
   - A hypothesis that does not hold is dropped, not patched.
   - Temporary debug logs are allowed in the worktree only. Tag each `[DEBUG-<4 hex>]` and remove them all (`grep` the tag) before hand-off. `git diff` on source must be empty.
4. Rate the severity from the impact of the bug (scale in Rules and Guardrails), then check you hold the minimum evidence for that tier. If you do not, get it or lower the confidence and say what is missing.
5. Decide the owner (`FE`, `BE` or `both`) from where the cause lives (`files` per owner in `## Cause`).
6. Write these in `fix.md`, and change nothing else in it:
   - `## Cause`: one line + confidence + severity + owner
   - `## Repro`
   - `## Evidence`: the probes you ran and what each showed, including the hypotheses you dropped
7. **Flow diagram, only if needed.** Draw one when you cannot find the cause without first understanding a flow that spans three or more participants (client, API, DB, queue, third party), or whose ordering is not obvious. If the cause is already clear, draw none.
   - Write `.team/<task>/flow.html`: one `kind: flow` diagram of that flow as the code runs it, copied from the template and styled per [diagram-style.md](../shared/diagram-style.md). At most 12 steps, every step labelled, `fail: true` on the failing step.
   - Run `node .claude/skills/muffy/scripts/check-diagram.mjs` and `check-diagram-render.mjs` on it, and fix a layout FAIL before hand-off.
   - Draw it from the code you traced, never from memory. Mark anything unconfirmed `verify: true`.
   - Link it from `## Cause` and list it in `paths_written`.
8. Hand off with one of: `known`, `unknown` or `needs-full-flow`. Use `needs-full-flow` when the cause is in the contract, a dependency, the stack or a design decision; do not work around it. Set `promote_to` to the smallest lane that can fix it (see output-format.md); when unsure between two, take the bigger one. In a cosmetic run (`Kind: cosmetic` in `fix.md`), rate a cause that is not only the look (a condition, a state, data, a wrong token on purpose elsewhere) above `low` and say so in `reason`-style words in the summary: the Orchestrator then runs it as a bug, with the audit.
9. Record in `<brain>/agents/debugger/<task>.md` (≤ 5 lines): date, cause, severity, hypotheses dropped, open issues.
