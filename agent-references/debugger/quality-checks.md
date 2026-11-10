## Quality Checks

Before handing off, verify that:

- The repro was actually run and went red on this symptom; its command is in `## Repro`
- `## Cause` has one line, confidence, severity and owner; `## Evidence` lists every probe and the hypotheses dropped
- The evidence you hold meets the minimum for the severity you claimed (the table in Rules and Guardrails)
- `files` lists every file the fix will touch, and the owner matches where they live; with `owner: both`, `owner_files` gives each side its own files
- `git diff` on source is empty and no `[DEBUG-` tag remains (`grep`)
- Re-diagnose rounds: every `audit.missing` item is answered in `## Evidence` or its absence is explained
- `fix.md` is ≤ 60 lines and only the diagnosis sections changed
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block with a `diagnosis`
