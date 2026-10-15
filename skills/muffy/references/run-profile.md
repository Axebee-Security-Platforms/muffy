# Run profile — skip what the feature doesn't need

A small bug or cosmetic fix does not use the table below: it runs the fix lane ([fix-profile.md](fix-profile.md)), which skips 1, 2, 3, 3b, 3c, 3d and 8, adds step 4a (diagnose), and still never skips 6, 7, 9 and 10. If the fix grows past the lane's limits it is promoted to the full flow.

| Condition | Skip |
|---|---|
| No UI change | `designer`, 3b, 3c, `frontend-dev` |
| No backend/API change | `backend-dev`; `architect` writes only the parts FE needs |
| No public API or user-facing change | `docs-writer`, step 8 |
| Existing stack, no smoke trigger (below) | devops mode 1 is a short check against the existing `deploy.md`; **3d is skipped by default**. Regressions are still caught at step 9 (staging health + smoke) |
| Answer and pattern already in the repo/vault | researcher stops at L0 |

Effort follows the signals in [token-discipline.md](token-discipline.md), not the profile table: a skipped step needs no agent, and production mode never lowers `code-reviewer`, `architect` or `devops`.

**Smoke triggers (3d runs only if one is true):** the contract adds or bumps a runtime, a dependency in the lockfile, a native/binary package or a datastore; devops-owned files change (Dockerfile, base image, `.nvmrc`, compose); or `<brain>/agents/devops/` has no passing smoke recorded for this stack (first feature, onboarding, or the last smoke failed); or `staging: none` (no safety net at step 9). Adding routes, UI or business logic alone is not a trigger. Record "3d skipped: no trigger" in `tasks/<task>.md`.

3c (including `pause:design-review`) is skipped only together with the designer. Never skip: review (6), QA (7), staging (9), Human gate (10). Record skipped steps and why in `tasks/<task>.md`.

## Named pauses

A pause stops the flow on purpose. It has an id, a resume condition, and one line in checkpoint `## Status`: `paused at pause:<id> · resume when <condition>`. Only these exist:

| Pause | Where | Stop until |
|---|---|---|
| `pause:scope` | setup, after scope confirmation (fix lane: one short question with the classification and AC list) | the user confirms scope (or edits it) and answers the staging question |
| `pause:staging-credentials` | before step 9 makes any live call to an external API or OAuth provider | the user approves each live call in chat, and the keys are confirmed present by name and prefix |
| `pause:onboard-review` | onboard step 0d ([onboard.md](onboard.md)) | the user approves or edits `baseline.md` and the ADR |
| `pause:design-review` | step 3c, after the designer's Definition of done is checked | the user approves the design (Approve), or asks for changes and then approves the revision |
| `pause:human-gate` | step 10 | Approve / Reject answer |

A pause is not a finish line: the final message says which pause the run is at and what unblocks it. Never make a live external call inside a pause without its approval.
