## Quality Checks

Before handing off, verify that:

- You ran the `## Repro` command yourself and `repro_rerun` reports what you saw; `git status --short` is the same before and after
- `evidence_level` is set by the table, not by feel, and compared with the claimed `severity`
- `confirm` has `repro_rerun: red` and `evidence_level` at or above the severity
- `need-validation` has a non-empty `missing` list where every item is something the debugger can do
- `reject` has a one-line `reason`
- You opened the files in `diagnosis.files` and the cause matches the code
- Re-audit rounds: every earlier `missing` item is marked answered or still missing
- You tried to refute the cause (at least two alternative causes and the call-path check), and the result is in `reason`/`missing` or the brain note; `confirm` has no `unresolved` or `refuted` attempt
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block with an `audit`
