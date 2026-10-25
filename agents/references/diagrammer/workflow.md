## Workflow

1. **Read the spec.** Confirm the `kind`, the path and the content are there. Read [diagram-style.md](../shared/diagram-style.md) once, and read only the example for the kind (`.claude/skills/muffy/templates/diagram-examples/<kind>.json`):
   - `flow-branch.json` for an either/or flow
   - `pattern-<pattern>.json` when a pattern is set
2. **Copy the template.** Copy `.claude/skills/muffy/templates/diagram.html` to the path. Change only `<title>` and the JSON in `<script id="diagram">`. The validator rejects any other change.
3. **Fill in the facts as given.** Place cards (`col`/`row`) so linked cards sit next to each other and read left to right. Write a plain `subtitle`. Add nothing the spec did not give you.
4. **Make it readable** for a reader who is not an engineer, before the first check ([principles.md](principles.md)):
   - Cut what the reader does not need.
   - At most 8 steps and 4 actors in a flow.
   - Branch an either/or with `group` and `option`.
   - Use plain words in subtitle, notes and flow labels; the exact code name stays on the card.
5. **Validate, then render:** `node .claude/skills/muffy/scripts/check-diagram.mjs <file>`, then `check-diagram-render.mjs <file>`.
   - Fix a layout FAIL yourself (move `col`/`row`, shorten a label).
   - Fix a readability FAIL or WARN yourself (split a note into lines, shorten, replace a jargon word).
   - Run both checks again after each fix.
   - A WARN left in place needs a one-line reason in the hand-off.
6. **A content FAIL is not yours to fix.** A fact that does not check out, or a name that differs from the code it came from, goes back to the spec's author: `status: blocked`, one `blockers[]` entry (`owner` = the author's role, `problem` = what is wrong).
7. **Report.** Write the final message and hand-off per [output-format.md](output-format.md). A render `SKIP` (no Chrome or Edge) is not a pass: say so.
