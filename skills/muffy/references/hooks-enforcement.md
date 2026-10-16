# Hooks Enforcement for Team Flow

Critical rules enforced automatically in `.claude/settings.local.json`:

## 1. Before Merge — Only Orchestrator
**Rule:** Only Orchestrator merges, saves reviews as `review-<n>.md`
```json
"before_merge": {
  "command": "echo '[team-flow] Is this the Orchestrator session? Non-Orchestrator cannot merge.' && exit 1"
}
```

## 2. Before Commit — Review/QA Artifact Required
**Rule:** Code changes must be committed with `review-N.md` or `qa-report.md`
```json
"before_commit": {
  "command": "git diff --cached --name-only | grep -E '\\.(ts|tsx|js|jsx|py)$' && (git diff --cached --name-only | grep -qE '(review-|qa-report)' || (echo '[team-flow] Code changes require review-N.md or qa-report.md' && exit 1)) || exit 0"
}
```

## 3. Before Push — Feature Branch Only
**Rule:** Cannot push directly to `main`, `production`, or `prod`
```json
"before_push": {
  "command": "BRANCH=$(git rev-parse --abbrev-ref HEAD); case \"$BRANCH\" in main|master|production|prod) echo '[team-flow] Push only to feature/<task> — Orchestrator merges.' && exit 1;; esac"
}
```

## 4. Before Merge — No Temporary Stack
**Rule:** Contract cannot contain "temporary", "prototype", "in-memory" without architect review
```json
"before_merge": {
  "command": "grep -q 'temporary\\|prototype\\|in-memory' .team/*/contract.md 2>/dev/null && (echo '[team-flow] Temporary stack in contract. Architect must update deploy.md first.' && exit 1) || exit 0"
}
```

## Setup

1. Copy template to settings: `cp team-flow-settings-template.json .claude/settings.local.json`
2. Edit `.claude/settings.local.json` and add the "hooks" block above
3. Hooks run automatically on every commit, merge, push

**Bypass only with Orchestrator approval:**
```bash
git commit --no-verify  # Skip commit check
git push --force        # Force to main (after Human gate approval)
```

## 6. Secrets — never read `.env*` in full
**Rule:** no agent Reads, greps or prints a `.env*` file's contents. Checks use names and prefixes only, e.g. `grep -q '^ANTHROPIC_API_KEY=sk-ant-' .env.local && echo present` (prints nothing secret). A value that appears in a transcript is treated as leaked: rotate it, and record the rotation in checkpoint `## Open blockers`.

Enforced by a PreToolUse hook. The guard is [scripts/guard-env.mjs](../scripts/guard-env.mjs) (exit 2 = block). It blocks:
- `Read` on an `.env*` file (`.env.example`, `.template`, `.sample` are allowed)
- `Grep` on `.env*` in `content` mode (`files_with_matches` and `count` are allowed)
- `Bash` / `PowerShell` that print an `.env*` file (`cat`, `Get-Content`, `type`, `<`, …), `findstr` over it, `grep`/`rg` over it without `-q`/`-c`/`-l`, `Select-String` over it without `-Quiet`/`-List`/`-Count`, or a search with no `NAME=` pattern
- `echo`/`printf` of a secret-named variable (`$…KEY`, `TOKEN`, `SECRET`, `PASSWORD`)

Known limits: reads through `node -e`, `python -c` or .NET calls are not caught. Keep those out of agent prompts; the rule in §6 still applies.

Install (persistent config — the user approves it; never add it silently):
```json
"PreToolUse": [
  { "matcher": "Read|Grep|Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-env.mjs" } ] }
]
```

## 7. Checkpoint size — optional, needs user approval
**Rule:** `checkpoint.md` ≤ 40 lines (excluding `## Goal`), every `rounds/*.md` ≤ 100 lines, links resolve. Enforced after each write to a checkpoint or round file by [scripts/check-checkpoint.mjs](../scripts/check-checkpoint.mjs) (exit 2 = block). Not installed by default: add it to `.claude/settings.local.json` only after the user approves.
```json
"PostToolUse": [
  { "matcher": "Write|Edit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/check-checkpoint.mjs --hook" } ] }
]
```

## 8. Artifact size — optional, needs user approval
**Rule:** `ac.md`, `brief.md`, `contract.md` ≤ 60 lines, their part files (`ac/`, `brief/`, `contract/`) ≤ 120 lines, links resolve, every AC id appears in `contract.md` or under `contract/`. Enforced after each write to one of those files by [scripts/check-artifacts.mjs](../scripts/check-artifacts.mjs) (exit 2 = block). Opt-in like rule 7.
```json
"PostToolUse": [
  { "matcher": "Write|Edit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/check-artifacts.mjs --hook" } ] }
]
```

## 9. Bash allowlist for doc agents — optional, needs user approval
**Rule:** `architect`, `designer`, `product-manager` and `docs-writer` use Bash only for `node .claude/skills/muffy/scripts/{validate-handoff,check-artifacts,check-checkpoint}.mjs` and read-only `git status|diff|log|show`, one command at a time (no `;`, `&&`, pipes, redirects, substitution or `..`). Enforced by [scripts/guard-bash-allowlist.mjs](../scripts/guard-bash-allowlist.mjs) (exit 2 = block). It reads `agent_type` from the hook payload: calls with no `agent_type` (the Orchestrator) and other roles pass untouched. Without the hook the same rule stands as text in each agent's guardrails. Installed together with the env guard by `install.mjs --with-guard`; add it by hand otherwise.
```json
"PreToolUse": [
  { "matcher": "Bash|PowerShell", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-bash-allowlist.mjs" } ] }
]
```

## 10. Full regression needs approval
**Rule:** `qa-tester` runs no whole-system suite (a bare `npm test`, `pytest`, `playwright test`, `go test ./...`, or a script named `test:all`, `test:e2e`, `ci`, `regression`) until the user approves it at `pause:full-regression` ([run-profile.md](run-profile.md#named-pauses)). Enforced by [scripts/guard-full-regression.mjs](../scripts/guard-full-regression.mjs) (exit 2 = block); only calls whose payload has `agent_type: qa-tester` are checked.
- **Approval is a file.** After the user says yes, the Orchestrator writes `.team/<task>/full-regression.approved` (one line: the approved command and the date) and deletes it when the QA round ends. The guard looks for it from the hook's cwd upwards, so a qa worktree finds the repo's `.team/`
- **Project commands:** list extra whole-system commands as regex strings in `.team/regression-commands.json`, e.g. `["^make e2e-all$"]`
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
- **Known limits:** a runner behind a wrapper script, `node -e`, and a test file written through the shell are not seen; a file's level is guessed from its path and runner (`e2e`, `integration`, `playwright`, `cypress`)
Installed with the other guards by `install.mjs --with-guard`.
```json
"PreToolUse": [
  { "matcher": "Bash|PowerShell|Write|Edit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/guard-test-level.mjs" } ] }
]
```

All six rules are **non-negotiable**. Rules 7 and 8 are opt-in.
