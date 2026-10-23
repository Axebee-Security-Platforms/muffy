# Run profile — skip what the feature doesn't need

A small bug or cosmetic fix does not use the table below: it runs the fix lane ([fix-profile.md](fix-profile.md)), which skips 1, 2, 3, 3b, 3c, 3d and 8, adds step 4a (diagnose), and still never skips 6, 7, 9 and 10. If the fix grows past the lane's limits it is promoted to the full flow. Internal work with a known shape (internal API, refactor, measured performance, reversible DB change) runs the lite lane ([lite-profile.md](lite-profile.md)), which skips 1, 2, 3b, 3c and 8 and starts at the architect.

| Condition | Skip |
|---|---|
| No UI change (including a CLI without screens: the request, `requirements.md` or `baseline.md` says so before any `Platform:` line exists; see [platforms.md](platforms.md)) | `designer`, 3b, 3c, `frontend-dev` |
| No backend/API change | `backend-dev`; `architect` writes only the parts FE needs |
| No public API or user-facing change | `docs-writer`, step 8 |
| Existing stack, no smoke trigger (below) | devops mode 1 is a short check against the existing `deploy.md`; **3d is skipped by default**. Regressions are still caught at step 9 (staging health + smoke) |
| Answer and pattern already in the repo/vault | researcher stops at L0 |

Effort follows the signals in [token-discipline.md](token-discipline.md), not the profile table: a skipped step needs no agent, and production mode never lowers `code-reviewer`, `architect` or `devops`.

**Smoke triggers (3d runs only if one is true):** the contract adds or bumps a runtime, a dependency in the lockfile, a native/binary package or a datastore; devops-owned files change (Dockerfile, base image, `.nvmrc`, compose); or `<brain>/agents/devops/` has no passing smoke recorded for this stack (first feature, onboarding, or the last smoke failed); or `staging: none` (no safety net at step 9). Adding routes, UI or business logic alone is not a trigger. For a non-web `Platform:`, a new native module, plugin or entitlement, a minimum OS version change, or a signing/build config change is a trigger too, and what 3d and staging mean comes from [platforms.md](platforms.md#what-3d-smoke-and-9-staging-mean). Record "3d skipped: no trigger" in `tasks/<task>.md`. Decide it with `node .claude/skills/muffy/scripts/next-action.mjs smoke [--runtime-changed] [--devops-files-changed] [--no-passing-smoke] [--staging-none]` (prints `next=run-3d` or `next=skip-3d`).

**3d is a stack smoke, not a route test.** It proves the stack boots with real dependencies in one process, using only code that exists on `ops/<task>` (stubs and a health route are fine). A spike that needs a route or screen that `backend-dev` has not written yet is not a 3d item: devops marks it `spike-route` in `deploy.md`, 3d passes without it, and devops runs it once after the first `backend-dev` round, before step 6. Never loop 3d (and burn its 3 rounds) waiting for feature code; a `spike-route` that still fails after step 4 goes to the loop in [loops.md](loops.md) as a normal blocker.

3c (including `pause:design-review`) is skipped only together with the designer. Never skip: review (6), QA (7), staging (9), Human gate (10). Record skipped steps and why in `tasks/<task>.md`.

## Named pauses

A pause stops the flow on purpose. It has an id, a resume condition, and one line in checkpoint `## Status`: `paused at pause:<id> · resume when <condition>`. Only these exist:

| Pause | Where | Stop until |
|---|---|---|
| `pause:scope` | setup, after scope confirmation (fix lane: one short question with the classification and AC list) | the user confirms scope (or edits it) and answers the staging question |
| `pause:staging-credentials` | before step 9 makes any live call to an external API or OAuth provider | the user approves each live call in chat, and the keys are confirmed present by name and prefix |
| `pause:onboard-review` | onboard step 0d ([onboard.md](onboard.md)) | the user approves or edits `baseline.md` and the ADR |
| `pause:todo-review` | todo step 6 ([todo.md](todo.md)) | the user picks which unfinished task to continue; the pick hands off to resume |
| `pause:plan-review` | step 2b, after `product-manager` returns `ac.md` and the plan (not on `needs-input`, which is an interview) | the user approves the AC and plan (Approve), or asks for changes and then approves the revision. Nothing goes to step 3 before this. Skipped when step 2 is skipped (fix and lite lanes) |
| `pause:design-review` | step 3c, after the designer's Definition of done is checked and the Orchestrator's UX/UI review ([design-review.md](design-review.md)) has no open `high` finding | the user approves the design (Approve), or asks for changes and then approves the revision |
| `pause:full-regression` | before any whole-system regression run (every test or e2e flow in the repo, not just this task's). The Orchestrator asks; `qa-tester` never does | the user approves in chat after seeing the exact command, what it covers, the expected duration and any shared environment it touches. No answer or "no" = scoped tests only. On yes, write `.team/<task>/full-regression.approved` (approved command + date) so the guard lets `qa-tester` run it ([hooks-enforcement.md](hooks-enforcement.md) §10); delete it when the round ends |
| `pause:human-gate` | step 10 | Approve / Reject answer |

A pause is not a finish line: the final message says which pause the run is at and what unblocks it, and ends with the `/muffy resume <task>` line after the trail is left ([resume.md](resume.md#leaving-a-trail-every-stop)). Never make a live external call inside a pause without its approval.
