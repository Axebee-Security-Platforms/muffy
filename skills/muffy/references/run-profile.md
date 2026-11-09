# Run profile: skip what the feature doesn't need

A small bug or cosmetic fix does not use the table below: it runs the fix lane ([fix-profile.md](fix-profile.md)), which skips 1, 2, 3, 3b, 3c and 3d, adds steps 4a (diagnose) and 4b (audit the cause; a cosmetic fix skips it), and still never skips 6, 7 and 10. If the fix grows past the lane's limits it moves up the [promotion ladder](#promotion-ladder). A version bump of something already in the manifest runs the upgrade lane ([upgrade-profile.md](upgrade-profile.md)). A branch someone already wrote, to review, test and accept, runs the verify lane ([verify-profile.md](verify-profile.md)). A change to something the product already has runs the change lane ([change-profile.md](change-profile.md)). Internal work with a known shape (internal API, refactor, measured performance, reversible DB change) runs its internal scope, which skips 1, 2, 3b and 3c and starts at the architect. A change to an existing screen, UX/UI or business-logic flow runs a visible scope, which the user picks at `pause:scope`.

| Condition | Skip |
|---|---|
| No UI change (including a CLI without screens: the request, `requirements.md` or `baseline.md` says so before any `Platform:` line exists; see [platforms.md](platforms.md)) | `designer`, 3b, 3c, `frontend-dev` |
| No backend/API change | `backend-dev`; `architect` writes only the parts FE needs |
| No public API or user-facing change, no migration and no new config | `docs-writer` (step 11; it runs after the Human gate) |
| Existing stack, no smoke trigger (below) | devops mode 1 is a short check against the existing `deploy.md`; **3d is skipped by default**. Regressions are caught by QA on docker local |
| Answer and pattern already in the repo/vault | researcher stops at L0 |

Effort follows the signals in [token-discipline.md](token-discipline.md), not the profile table: a skipped step needs no agent, and production mode never lowers `code-reviewer`, `architect` or `devops`.

**Smoke triggers (3d runs only if one is true):** the contract adds or bumps a runtime, a dependency in the lockfile, a native/binary package or a datastore; devops-owned files change (Dockerfile, base image, `.nvmrc`, compose); or `<brain>/agents/devops/` has no passing smoke recorded for this stack (first feature, onboarding, or the last smoke failed). Adding routes, UI or business logic alone is not a trigger. For a non-web `Platform:`, a new native module, plugin or entitlement, a minimum OS version change, or a signing/build config change is a trigger too, and what 3d means comes from [platforms.md](platforms.md#smoke-3d). Record "3d skipped: no trigger" in `tasks/<task>.md`. Decide it from the real diff, not by reading it yourself: `node "<muffy>/scripts/diff-signals.mjs" <base> <branch> --brain <brain> --team-dir .team/<task>` checks manifests and lockfiles, devops-owned files (including `contract/ownership.md` devops rows), the devops brain notes for a passing smoke, then prints `next=run-3d` or `next=skip-3d`. A runtime the contract adds before any code exists is not in a diff yet: then pass the flags to `node "<muffy>/scripts/next-action.mjs" smoke [--runtime-changed] [--devops-files-changed] [--no-passing-smoke]`.

**3d is a stack smoke, not a route test.** It proves the stack boots with real dependencies in one process, using only code that exists on `ops/<task>` (stubs and a health route are fine). A spike that needs a route or screen that `backend-dev` has not written yet is not a 3d item: devops marks it `spike-route` in `deploy.md`, 3d passes without it, and devops runs it once after the first `backend-dev` round, before step 6. Never loop 3d (and burn its 3 rounds) waiting for feature code; a `spike-route` that still fails after step 4 goes to the loop in [loops.md](loops.md) as a normal blocker.

3c (including `pause:design-review`) is skipped only together with the designer. Never skip: review (6), QA (7), Human gate (10). Record skipped steps and why in `tasks/<task>.md`.

## Promotion ladder

A run that outgrows its lane moves up one rung at a time, to the smallest lane that fits, never straight to the full flow when a smaller one will do:

| From | Signal | To |
|---|---|---|
| fix | 4a `needs-full-flow` with `promote_to` | `change-internal` → change, internal scope; `change-visible` → change, a visible scope; `full` (or missing) → full flow ([fix-profile.md](fix-profile.md#diagnose-budget-and-outcomes)) |
| fix | step 4 over 5 source files, or an `Architect` blocker | full flow (the diff says nothing about who sees the cause) |
| change, internal | a `PM` or `Designer` blocker naming a visible change | change, a visible scope ([change-profile.md](change-profile.md#promote-out-of-the-internal-scope)) |
| change, internal | a `Researcher` blocker, auth, an outside caller, over 15 files | full flow |
| change, `ui-only` | `needs-logic:` | change, `ui+logic` (`pause:scope-upgrade`) |

And one rung down, offered once: when `product-manager` in the full flow reports that nothing a user or outside caller sees changes, ask whether to run it as an internal change instead (`checkpoint.mjs profile .team/<task> change --scope internal`, keep `ac.md`, start at step 3). Every move is written with `checkpoint.mjs profile` and recorded in the checkpoint and the vault task note.

## Named pauses

A pause stops the flow on purpose. It has an id, a resume condition, and one line in checkpoint `## Status`: `paused at pause:<id> · resume when <condition>`, written by `node "<muffy>/scripts/checkpoint.mjs" pause .team/<task> <id> --until "<condition>"` (it refuses an id not in this table) and removed by `node "<muffy>/scripts/checkpoint.mjs" unpause .team/<task>` when the pause is answered (pause:plan-review and pause:design-review are cleared by `checkpoint.mjs gate`, and `unpause` refuses them while the gate is open). Only these exist:

| Pause | Where | Stop until |
|---|---|---|
| `pause:scope` | setup, after scope confirmation (fix lane: one short question with the classification and AC list) | the user confirms scope (or edits it) |
| `pause:scope-upgrade` | change lane, when a `ui-only` run reports `needs-logic` ([change-profile.md](change-profile.md)) | the user adds the logic work, or cuts that part from the design. At most once per task |
| `pause:onboard-review` | onboard step 0d ([onboard.md](onboard.md)) | the user approves or edits `baseline.md` and the ADR |
| `pause:todo-review` | todo step 6 ([todo.md](todo.md)) | the user picks which unfinished task to continue; the pick hands off to resume |
| `pause:plan-review` | step 2b, after `product-manager` returns `ac.md` and the plan (not on `needs-input`, which is an interview) | the user approves the AC and plan (Approve), or asks for changes and then approves the revision. Nothing goes to step 3 before this. Skipped when step 2 is skipped (fix and lite lanes) |
| `pause:design-review` | step 3c, after the designer's Definition of done is checked and the Orchestrator's UX/UI review ([design-review.md](design-review.md)) has no open `high` finding | the user approves the design (Approve), or asks for changes and then approves the revision |
| `pause:full-regression` | before any whole-system regression run (every test or e2e flow in the repo, not just this task's). The Orchestrator asks; `qa-tester` never does | the user approves in chat after seeing the exact command, what it covers, the expected duration and any shared environment it touches. No answer or "no" = scoped tests only. On yes, write `.team/<task>/full-regression.approved` (approved command + date) so the guard lets `qa-tester` run it ([hooks-enforcement.md](hooks-enforcement.md) §10); delete it when the round ends |
| `pause:human-gate` | step 10 | Approve / Reject answer |

A pause is not a finish line: the final message says which pause the run is at and what unblocks it, and ends with the `/muffy resume <task>` line after the trail is left ([resume.md](resume.md#leaving-a-trail-every-stop)). Never make a live external call inside a pause without its approval.
