# Hooks Enforcement for Team Flow

Rules 1–4 are **Orchestrator rules**, not hooks: Claude Code has no merge, commit or push hook event, so the Orchestrator checks them itself before each merge, commit and push. Rules 6–13 are real `PreToolUse` / `PostToolUse` hooks in `.claude/settings.local.json`. There is no rule 5.

## 1. Merge — only the Orchestrator
Only the Orchestrator merges branches and saves reviews as `review-<n>.md`. A subagent hand-off that reports a merge is reverted, and the agent gets its rule again.

## 2. Commit — code needs a review record
Merging FE/BE branches into `feature/<task>` at step 5 is fine (step 6 reviews that merge). Nothing goes from `feature/<task>` into `<base>`, and nothing is pushed or opened as a PR for the Human gate, until `review-<n>.md` approves the latest diff and `qa-report.md` passes.

## 3. Push — feature branches only
Never push to `main`, `master`, `production` or `prod`, and never force-push them. Changes reach those branches through the Human gate (step 10) and the user's own merge or PR.

## 4. Merge — no temporary stack
Before merging, check `contract.md` and `contract/stack.md` for a stack marked temporary or prototype (for example an in-memory store standing in for the real datastore). Found → stop and send it to `architect` (+ ADR) first. A word match is a prompt to look, not a verdict: an in-memory cache the architect chose on purpose is fine.

**No bypass.** Hooks are never skipped (`--no-verify`) and protected branches are never force-pushed; a rule that blocks real work goes to the user as a question.

## 6. Secrets — never read `.env*` in full
**Rule:** no agent Reads, greps or prints a `.env*` file's contents. Checks use names and prefixes only, e.g. `grep -q '^ANTHROPIC_API_KEY=sk-ant-' .env.local && echo present` (prints nothing secret). A value that appears in a transcript is treated as leaked: rotate it, and record the rotation in checkpoint `## Open blockers`.

Enforced by a PreToolUse hook. The guard is [scripts/guard-env.mjs](../scripts/guard-env.mjs) (exit 2 = block). It blocks:
- `Read` on an `.env*` file (`.env.example`, `.template`, `.sample` are allowed)
- `Grep` on `.env*` in `content` mode (`files_with_matches` and `count` are allowed)
- `Bash` / `PowerShell` that print an `.env*` file (`cat`, `Get-Content`, `type`, `<`, …), `findstr` over it, `grep`/`rg` over it without `-q`/`-c`/`-l`, `Select-String` over it without `-Quiet`/`-List`/`-Count`, or a search with no `NAME=` pattern
- `echo`/`printf` of a secret-named variable (`$…KEY`, `TOKEN`, `SECRET`, `PASSWORD`)
- Inline interpreter code that names `.env` or loads dotenv: `node -e|-p|--eval`, `bun`/`deno eval`, `python -c`, `perl`/`ruby -e`, `php -r`, `pwsh -Command`, or code fed on stdin (`python - <<EOF`, `node < x`). Running the project's own script (`node --env-file=.env server.js`, `npm run migrate`) is allowed

Known limits: a script file that reads `.env`, inline code that builds the path (`'.e'+'nv'`), and .NET calls are not caught. A hook is a tripwire for mistakes, not a sandbox; the rule in §6 still applies.

Install (persistent config — the user approves it; never add it silently):
```json
"PreToolUse": [
  { "matcher": "Read|Grep|Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-env.mjs" } ] }
]
```

## 7. Checkpoint size — optional, needs user approval
**Rule:** `checkpoint.md` ≤ 40 lines (excluding `## Goal`), every `rounds/*.md` ≤ 100 lines, links resolve, and the `baseline:`, `infra:` and `diagrams:` items in `## Status` hold a recognised value. Enforced after each write to a checkpoint or round file by [scripts/check-checkpoint.mjs](../scripts/check-checkpoint.mjs) (exit 2 = block). Not installed by default: add it to `.claude/settings.local.json` only after the user approves.
```json
"PostToolUse": [
  { "matcher": "Write|Edit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/check-checkpoint.mjs --hook" } ] }
]
```

## 8. Artifact size — optional, needs user approval
**Rule:** `ac.md`, `brief.md`, `contract.md`, `fix.md` ≤ 60 lines, their part files (`ac/`, `brief/`, `contract/`) ≤ 120 lines, links resolve, every AC id appears in `contract.md` or under `contract/`, `Platform:` is `web|mobile|desktop|cli` (`cli` needs `contract/cli.md`), and `deploy.md` has `## Chosen infra`, `## Practices` and `## Risks`, has `## Infra options` only when the checkpoint says `infra: propose`, and lists every practice `gap` under Risks. Enforced after each write to one of those files by [scripts/check-artifacts.mjs](../scripts/check-artifacts.mjs) (exit 2 = block). Opt-in like rule 7.
```json
"PostToolUse": [
  { "matcher": "Write|Edit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/check-artifacts.mjs --hook" } ] }
]
```

## 9. Bash allowlist for doc agents — optional, needs user approval
**Rule:** `architect`, `designer`, `diagrammer`, `product-manager`, `docs-writer` and `researcher` use Bash only for `node .claude/skills/muffy/scripts/{validate-handoff,check-artifacts,check-checkpoint,check-diagram,check-diagram-render,check-stack-notes,check-presentation}.mjs`, `diagram-import.mjs` without `--html` (it only prints a digest and a draft) and read-only `git status|diff|log|show`, one command at a time (no `;`, `&&`, pipes, redirects, substitution or `..`). Enforced by [scripts/guard-bash-allowlist.mjs](../scripts/guard-bash-allowlist.mjs) (exit 2 = block). It reads `agent_type` from the hook payload: calls with no `agent_type` (the Orchestrator) and other roles pass untouched. Without the hook the same rule stands as text in each agent's guardrails. Installed together with the env guard by `install.mjs --with-guard`; add it by hand otherwise.
```json
"PreToolUse": [
  { "matcher": "Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-bash-allowlist.mjs" } ] }
]
```

## 10. Full regression needs approval
**Rule:** `qa-tester` runs no whole-system suite (a bare `npm test`, `pytest`, `playwright test`, `go test ./...`, or a script named `test:all`, `test:e2e`, `ci`, `regression`) until the user approves it at `pause:full-regression` ([run-profile.md](run-profile.md#named-pauses)). Enforced by [scripts/guard-full-regression.mjs](../scripts/guard-full-regression.mjs) (exit 2 = block); only calls whose payload has `agent_type: qa-tester` are checked.
- **Approval is a file.** After the user says yes, the Orchestrator writes `.team/<task>/full-regression.approved` (one line: the approved command and the date) and deletes it when the QA round ends. The guard looks for it from the hook's cwd upwards, so a qa worktree finds the repo's `.team/`
- **Project commands:** list extra whole-system commands as regex strings in `.team/regression-commands.json`, e.g. `["^make e2e-all$"]`. The Orchestrator adds the `Whole-suite:` command of each new stack note there ([stack-learning.md](stack-learning.md))
- **Known limits:** a runner behind a wrapper script the patterns don't know, `node -e`, and a flag's value mistaken for a test path (fails open). A run with a path, name or filter is scoped and always allowed
Installed with the other guards by `install.mjs --with-guard`.
```json
"PreToolUse": [
  { "matcher": "Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-full-regression.mjs" } ] }
]
```

## 11. Test level ceiling
**Rule:** `qa-tester` stays within the level the Orchestrator set in [test-levels.md](test-levels.md). Enforced by [scripts/guard-test-level.mjs](../scripts/guard-test-level.mjs) (exit 2 = block); only calls with `agent_type: qa-tester` are checked. The runner patterns are shared with rule 10 in [scripts/test-runners.mjs](../scripts/test-runners.mjs).
- **The level is a file.** The Orchestrator writes `.team/<task>/test-level` (one token, `L0` to `L4`) when it builds the qa-tester prompt, and updates it if the level changes. A qa worktree named `qa-<task>` reads its own task's file; otherwise the lowest level among all tasks applies. No file = no ceiling
- **L0:** no test run at all (build and lint pass), and no creating or editing test files
- **L1:** unit runs only (an integration or e2e run is blocked), and no new files under `e2e/`, `integration/`, `playwright/`, `cypress/` or their runner config
- **L2 and L3:** nothing extra here; scoping and whole-suite approval stay with rule 10. **L4** is the approval marker of rule 10
- **Known limits:** a runner behind a wrapper script, `node -e`, and a test file written through the shell are not seen; a file's level is guessed from its path and runner (`e2e`, `integration`, `playwright`, `cypress`, plus `integration_test`, `androidTest`, `*UITests`, `.maestro`, `detox` for mobile and desktop apps)
Installed with the other guards by `install.mjs --with-guard`.
```json
"PreToolUse": [
  { "matcher": "Bash|PowerShell|Write|Edit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-test-level.mjs" } ] }
]
```

## 12. Write scope for shared files
**Rule:** `docs/strategy.md` is written only by `product-manager`; `docs/architecture/baseline.md` and its section files `docs/architecture/baseline/<section>.md` only by `researcher`; `docs/architecture/overview.html`, `data-model.html`, `deployment.html`, `flows/*.html`, `states/*.html`, `changes/*.html` and `data-models/*.html` only by `diagrammer` (the facts come from `architect`'s spec); no subagent writes any other file under `docs/architecture/`; `docs/plan/<task>-gantt.html` and `docs/plan/<task>-story-map.html` only by `diagrammer` (the facts come from `product-manager`'s spec); `docs/design/screen-map.html` only by `diagrammer` (the facts come from `designer`'s spec); `docs/design-system/` only by `designer` (and `architect` in onboard mode). Every diagram muffy produces is drawn by `diagrammer`, and by no one else — `architect`, `product-manager` and `designer` only supply the content it draws from. Enforced by [scripts/guard-write-scope.mjs](../scripts/guard-write-scope.mjs) (exit 2 = block); only calls whose payload has an `agent_type` are checked, so the Orchestrator's own session is never blocked (it still follows the rule as text: it never edits `strategy.md`).
- **Known limits:** writes made through Bash are not seen (the doc agents' Bash is already limited by rule 9; `frontend-dev`, `backend-dev`, `devops` and `qa-tester` are not), and a path outside these names is allowed. The rules live in `scripts/write-scope.mjs`, shared by the guard and `make-envelope.mjs`: the envelope refuses a `Write:` path the role may not write (exit 1, before any spawn) and adds a `Shared files you may not write` line to the prompt, so the agent knows before it acts instead of learning from the block
Installed with the other guards by `install.mjs --with-guard`.
```json
"PreToolUse": [
  { "matcher": "Write|Edit|MultiEdit|NotebookEdit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-write-scope.mjs" } ] }
]
```

## 13. Git setup — only the Orchestrator
**Rule:** no subagent changes git's own setup: git config (`git config` writes, `git -c`, `--config-env`), remotes (`git remote add|set-url|remove|rename|set-head|set-branches`), `core.hooksPath`, or any file inside `.git/` (including a worktree's `.git` file). Every worktree shares the repo's `.git/config` and hooks, so one agent's change reaches every branch and the Orchestrator's own pushes. An agent that needs one reports it in its hand-off. Enforced by [scripts/guard-git.mjs](../scripts/guard-git.mjs) (exit 2 = block); only calls with an `agent_type` are checked, so the Orchestrator's session is never blocked. Reads pass: `git config --get|--list`, `git remote -v`, `git remote get-url`.
- **Known limits:** a write through `node -e`, a script file or a git alias is not seen. `git config <key>` with no flag is a read but is blocked (use `--get`), and a command that both names `.git/` and runs a writer (`tee`, `cp`, …) is blocked even when the writer targets another file
Installed with the other guards by `install.mjs --with-guard`.
```json
"PreToolUse": [
  { "matcher": "Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-git.mjs" } ] }
]
```

## 14. Human gates before a spawn
**Rule:** no subagent starts while a human gate of its step is open. In the feature lane every spawn past product-manager and researcher needs `gate 2b` (pause:plan-review). backend-dev, frontend-dev, code-reviewer, qa-tester, docs-writer and devops in mode 2 also need `gate 3c` (pause:design-review). `passed` and `skipped` both count as answered; `not passed` and `rejected` do not. The answer is recorded by `checkpoint.mjs gate` (the only writer of those lines), which refuses approval without the saved pause and a ready `gate-summary.mjs` body, and refuses a skip of 3c once `design.md` exists. A spawn is matched to its task by the `Task:` header of the prompt envelope. The guard fails closed: a gated muffy role (any `agents/*.md` role but product-manager and researcher) spawned without the header is matched to the task its prompt names (`.worktrees/feature-<task>` or `.team/<task>`), and is blocked when it names none while any checkpoint exists in the repo. `checkpoint.mjs unpause` refuses to clear pause:plan-review or pause:design-review while its gate is open: `gate` records the answer and clears the pause. Hand-offs past an open gate fail `check-all` (`gates` check).
- **Known limits:** `checkpoint.mjs gate --by` records the user's words as the Orchestrator passes them on. No hook can tell a user's reply from one the Orchestrator writes itself; the hook makes the answer an explicit, dated line in `## Status` that the user can audit. A role outside muffy, or a muffy role in a repo with no checkpoint, is not checked.
Enforced by [scripts/guard-gates.mjs](../scripts/guard-gates.mjs) (exit 2 = block); rules in [scripts/gate-rules.mjs](../scripts/gate-rules.mjs). Installed with the other guards by `install.mjs --with-guard`.
```json
"PreToolUse": [
  { "matcher": "Agent|Task", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-gates.mjs" } ] }
]
```

Every rule here is **non-negotiable**. Hooks 7 and 8 are opt-in; without a hook, its rule still applies as text.
