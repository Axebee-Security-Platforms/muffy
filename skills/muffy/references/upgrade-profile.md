# Upgrade profile: bump a dependency or runtime the project already uses

For "อัปเกรด React เป็น 19", "bump Node to 22", "update Prisma to 6 and fix what breaks": a version change of something **already in the manifest** (a package, the runtime pin, a base image). A dependency the project does not have yet is the full flow: `researcher` checks its licence and maintenance there. No product question is asked, nothing new is built, so product and design are skipped; the risk is breakage, so research, the ADR, its approval and the stack smoke always run.

## Triage (Orchestrator, no agent)

It is an **upgrade** only if all hold; otherwise say which fails in one line and take the route that fits:

1. The package, runtime or image is already in the manifest, lockfile, `.nvmrc` or Dockerfile (check with Grep/Read)
2. The request is the version change and whatever breaks because of it, not a new capability on top ("upgrade Next and add a new page" is two tasks; cut the page out at `pause:scope`)
3. A target version is named, or "latest" is acceptable to the requester (ask once if neither)

## Setup-lite (replaces [setup.md](setup.md))

1. Name the task `upgrade-<slug>` and run the common setup, [setup.md](setup.md) steps 1-4, with `next-action.mjs baseline --lane upgrade` (a quick baseline is enough; the upgrade will move its Stack section anyway)
2. `pause:scope`, one `AskUserQuestion` call: **Plan** (the card from `next-action.mjs plan-card upgrade`, go / bigger), **Target** (package or runtime, from and to versions; Confirm / Change it), **Base** (only when `main` and the current branch differ)
3. Create the feature worktree from `<base>` (a baseline committed at the common setup on another branch is cherry-picked onto it first, [setup.md](setup.md) step 7), then `.team/<task>/`, `handoff/` and `rounds/`. Write `.team/<task>/ac.md` (the internal-scope format of [change-profile.md](change-profile.md#acmd), with `Lane: upgrade`): `AC-1` the app builds and boots on the new version, `AC-2` the existing tests pass, one `AC-<n>` per breaking change the changelog names once step 1 has read it, and a `## Traceability` table that maps each of the brief's must-not-miss items to its AC (`check-artifacts.mjs` holds the two together). Commit it to `feature/<task>`
4. Write `checkpoint.md`, then its lane line with `node .claude/skills/muffy/scripts/checkpoint.mjs profile .team/<task> upgrade`, and record `checkpoint.mjs gate .team/<task> 2b skip --reason "no plan in an upgrade; the ADR is approved at 3c"`

## Steps

| # | Agent | Notes |
|---|---|---|
| 1 | `researcher` | The changelog and migration guide between the two versions: breaking changes, deprecations, the new minimum runtime, known issues. Level L1, L2 for a major version. The brief lists each breaking change with where this repo is hit (Grep), under `## Must-not-miss requirements`; the Orchestrator adds an `AC-<n>` and a `## Traceability` row for each |
| 2, 2b | skipped | No product question. 2b is recorded as skipped at setup |
| 3 | `architect` ∥ `devops` mode 1 | The architect writes the **upgrade ADR** (supersedes the stack ADR for this package or runtime, if one exists; what changes in the code, the order, the rollback) and the contract changes it implies; devops updates the pins (`.nvmrc`, Dockerfile, compose, CI) in `deploy.md` |
| 3c | **Human gate** `pause:design-review` | The user approves the ADR and the contract (`gate-summary.mjs` shows the contract gate when there is no `design.md`). Never skipped |
| 3d | `devops` mode 2 | **Always runs**: the version change is a smoke trigger by definition. The stack boots on the new version before any dev starts |
| 4, 5 | `frontend-dev` ∥ `backend-dev`, merge | The code changes the ADR lists, one AC at a time |
| 6 | `code-reviewer` | Never downgraded |
| 7 | `qa-tester` | L3 on what the breaking changes touch; offer `pause:full-regression` before QA, since an upgrade can break anything ([test-levels.md](test-levels.md)) |
| 10 | Human gate | Accept the branch |
| 11 | `docs-writer`, after the gate approves | Release notes and a **Deploy hand-off**: the new version, the pins to deploy with it, the rollback from the ADR |
| 12 | Orchestrator | [closing.md](closing.md) in full. The Stack moved, so run onboard's silent refresh of the baseline ([onboard.md](onboard.md#refresh)) after the merge, or note that the upgrade ADR supersedes the baseline's Stack until then |

Never skipped: 1, 3, 3c, 3d, 6, 7, 10.

## Promote

A blocker `owner: PM` or `owner: Designer` (a user-visible change the upgrade forces, such as a removed component) stops the lane: ask whether to cut it out or run the full flow (`checkpoint.mjs profile .team/<task> feature`, start at step 2 with the brief and the ADR).

## Prompt differences

No `Profile:` or `Scope:` header. `Read:` lists `brief.md` (the changelog summary), `ac.md`, and from step 4 `contract.md` and the upgrade ADR; there is no `design.md`.
