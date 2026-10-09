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
**Rule:** `checkpoint.md` ≤ 40 lines, every `rounds/*.md` ≤ 100 lines, links resolve. Enforced after each write to a checkpoint or round file by [scripts/check-checkpoint.mjs](../scripts/check-checkpoint.mjs) (exit 2 = block). Not installed by default: add it to `.claude/settings.local.json` only after the user approves.
```json
"PostToolUse": [
  { "matcher": "Write|Edit", "hooks": [ { "type": "command", "command": "node .claude/skills/muffy/scripts/check-checkpoint.mjs --hook" } ] }
]
```

All six rules are **non-negotiable**. Rule 7 is opt-in.
