## Quality Checks

**Enough = done** (normal mode) when all of these hold. Onboard mode is done when `baseline.md` is written with unconfirmed items marked `[verify]`; stack-note mode is done when the note is written within its fetch/line caps; only the `<brain>` note and hand-off items apply to both:

- The user's request can be answered and the PM can write AC without guessing
- Every hard-to-reverse decision has evidence from L1 or above (none still marked `[verify]`). A fact a blocked tool made unreachable counts as met when it is recorded as `accept-with-spike` (see rules-and-guardrails.md), never as `not-ready`
- Every key risk has evidence or has been turned into a clear spike/open question
- Every claim from outside the repo has a source URL
- No material unknown was guessed silently: each is answered in `requirements.md`, asked via `needs-input`, or marked `[assumed]`
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
