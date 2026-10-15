# Run profile — skip what the feature doesn't need

| Condition | Skip |
|---|---|
| No UI change | `designer`, 3b, 3c, `frontend-dev` |
| No backend/API change | `backend-dev`; `architect` writes only the parts FE needs |
| No public API or user-facing change | `docs-writer`, step 8 |
| Existing stack, no new runtime/dependency | devops mode 1 is a short check against the existing `deploy.md`; 3d is skipped if the last smoke build on this stack passed |
| Answer and pattern already in the repo/vault | researcher stops at L0 |

Effort follows the signals in [token-discipline.md](token-discipline.md), not the profile table: a skipped step needs no agent, and production mode never lowers `code-reviewer`, `architect` or `devops`.

3c (including `pause:design-review`) is skipped only together with the designer. Never skip: review (6), QA (7), staging (9), Human gate (10). Record skipped steps and why in `tasks/<task>.md`.

## Named pauses

A pause stops the flow on purpose. It has an id, a resume condition, and one line in checkpoint `## Status`: `paused at pause:<id> · resume when <condition>`. Only these exist:

| Pause | Where | Stop until |
|---|---|---|
| `pause:scope` | setup, after scope confirmation | the user confirms scope (or edits it) |
| `pause:staging-credentials` | before step 9 makes any live call to an external API or OAuth provider | the user approves each live call in chat, and the keys are confirmed present by name and prefix |
| `pause:onboard-review` | onboard step 0d ([onboard.md](onboard.md)) | the user approves or edits `baseline.md` and the ADR |
| `pause:design-review` | step 3c, after the designer's Definition of done is checked | the user approves the design (Approve), or asks for changes and then approves the revision |
| `pause:human-gate` | step 10 | Approve / Reject answer |

A pause is not a finish line: the final message says which pause the run is at and what unblocks it. Never make a live external call inside a pause without its approval.
