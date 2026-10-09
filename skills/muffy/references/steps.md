# Steps

| # | Agent | Input | Output |
|---|---|---|---|
| 0 | `researcher` → `architect`, once per repo | `scan.json` | `docs/architecture/baseline.md`, `docs/adr/NNNN-existing-stack.md`; Human gate `pause:onboard-review`. Existing codebases only: [onboard.md](onboard.md) |
| 1 | `researcher` | request (+ min level) | `brief.md` + level reached; `[verify]` left on a hard-to-reverse decision → send back for the next level; spikes → devops in 3d |
| 2 | `product-manager` | `brief.md` | `ac.md`, `docs/plan/<task>.md` (phases + P0/P1/P2), `docs/adr/NNNN-*.md` |
| 3 | `designer` ∥ `architect` ∥ `devops` mode 1 — one message | `ac.md`, `brief.md`, plan | `design.md`, `contract.md`, `deploy.md`; then architect aligns the contract with `deploy.md` (pinned runtime, devops-owned files) |
| 3b | Orchestrator | `.team/<task>/canvas/` | Publish the canvas on Claude Design (Artifact type "Design", `quickstart` intent `design`), put the URL in `design.md`; after `contract.md`, designer aligns fields and you republish |
| 3c | **Design gate** | `design.md` + URL | Designer's Definition of done all checked (published, every AC has an artboard, no placeholders, values from `docs/design-system/` tokens, new components documented) — else send back. **Blocks step 4** |
| 3d | `devops` mode 2 on `ops/<task>` | `deploy.md`, `contract.md` | `node -v` vs `.nvmrc` first (mismatch = fail), then Pass / Fail with real dependencies in one process. **Blocks step 4**; on pass, Orchestrator creates `fe/<task>` and `be/<task>` worktrees from `ops/<task>` (see setup step 7) |
| 4 | `frontend-dev` ∥ `backend-dev` | `design.md`, `contract.md`, `ac.md`, branch + worktree (created after 3d) | branch + summary |
| 5 | Orchestrator | — | merge into `feature/<task>` with `git merge --no-ff` (never `--ff-only`: branches diverge by design); conflict → file owner per `contract.md` rebases |
| 5b | Orchestrator | `fe/<task>` + `be/<task>` worktrees: each `.pr-lens/<title>/` render folder (folder path in the hand-off `paths_written`) | (1) Publish the PR diagrams as one Claude Artifact (not the prlens.dev canvas): `node .claude/skills/muffy/scripts/build-diagram-page.mjs <scratchpad>/pr-diagrams.html <fe render dir> <be render dir>`, then publish that file with the Artifact tool (icon `diagram`); keep the URL for `review-<n>.md`, the Human gate and the closing report. (2) Copy each `drawn.graph.json` to `.team/<task>/diagrams/fe.graph.json` / `be.graph.json` (the reviewer is read-only and cannot open a URL; step 6 reads these files). Missing diagram → skip, never block. Details: [pr-diagram.md](../../../agents/references/frontend-dev/pr-diagram.md) |
| 6 | `code-reviewer` | `diff.patch`, `ac.md`, `contract.md`, `diagrams/*.graph.json` if present | Approve / Reject |
| 7 | `qa-tester` ∥ `docs-writer` | branch / contract + approved diff. docs-writer starts with `TBD` in every test number; when `qa-report.md` exists the Orchestrator sends its path via `SendMessage`, and docs-writer fills the numbers before handing off | `qa-report.md` / docs + `release-notes.md` |
| 8 | `code-reviewer` | docs (+ fix diff) | Approve / Reject |
| 9 | `devops` staging | feature branch | Before any gate: `node -v` vs `.nvmrc` (mismatch = fail). Credential preflight first → `pause:staging-credentials` if live keys are needed. Then health + smoke per the Mode 3 checklist in [devops/workflow.md](../../../agents/references/devops/workflow.md); no staging → near-production env per `deploy.md` |
| 10 | **Human gate** | `AskUserQuestion` with qa-report, staging result, release-notes | Before asking: update `<brain>/tasks/<task>.md` status and checkpoint. Approve / Reject |
| 11 | `devops` production | "Human approved" in the prompt | canary → 100% or rollback |
| 12 | Orchestrator | — | Read `references/closing.md` and follow it |
