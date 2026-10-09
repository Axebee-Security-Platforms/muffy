# 🎯 Muffy — Feature Development Agent Team

muffy is a hub-and-spoke subagent team plus one skill (`muffy`). The main Claude Code session is the **Orchestrator**; it runs one feature from research to production through 10 specialist agents. Subagents never talk to each other: work moves between them as files in `.team/<task>/`.

> Source: [skills/muffy/SKILL.md](skills/muffy/SKILL.md) · flow details: [skills/muffy/references/steps.md](skills/muffy/references/steps.md) · how skills work: [skills/muffy/how-skill-work.html](skills/muffy/how-skill-work.html)

---

## Install

```bash
node install.mjs /path/to/your-repo --vault "/absolute/path/to/Obsidian Vault"
node install.mjs /path/to/your-repo --clean     # update an existing install
```

Full steps (dry-run, `--force`, `--clean` caveats, hooks to add by hand) are in [INSTALL.md](INSTALL.md).

---

## Agents

| Agent | Model | Tools | Role |
|---|---|---|---|
| `researcher` | sonnet | Read, Grep, Glob, WebSearch, WebFetch, Write | Research the request → `brief.md` |
| `product-manager` | sonnet | Read, Grep, Glob, Write | Acceptance criteria (`ac.md`) and plan |
| `architect` | sonnet | Read, Grep, Glob, Write | API/data contract, aligned with deploy |
| `designer` | sonnet | Read, Grep, Glob, Edit, Write | UX/UI from AC → design canvas (`design.md`) |
| `devops` | sonnet | Read, Grep, Glob, Edit, Write, Bash | Deployability check, smoke build, staging, production |
| `frontend-dev` | sonnet | Read, Grep, Glob, Edit, Write, Bash | FE implementation on `fe/<task>` |
| `backend-dev` | sonnet | Read, Grep, Glob, Edit, Write, Bash | BE implementation on `be/<task>` |
| `code-reviewer` | sonnet | Read, Grep, Glob | Approve / Reject diffs (cannot write files) |
| `qa-tester` | sonnet | Read, Grep, Glob, Edit, Write, Bash | Tests and `qa-report.md` |
| `docs-writer` | haiku | Read, Grep, Glob, Edit, Write | Docs and `release-notes.md` |

Agent definitions live in `agents/<role>.md`; their per-role references (principles, workflow, quality checks) live in `agents/references/<role>/`.

### Skills

Skills are declared in an agent's frontmatter `skills:` list and load when that agent runs. Right now only one is declared:

| Agent | Declared skills |
|---|---|
| `designer` | `impeccable` |

Everything else is plain agent workflow, with no extra skill.

---

## Workflow (Steps 1–12)

Full input/output per step: [skills/muffy/references/steps.md](skills/muffy/references/steps.md).

| # | Agent | Output |
|---|---|---|
| 1 | `researcher` | `brief.md` |
| 2 | `product-manager` | `ac.md`, `docs/plan/<task>.md`, `docs/adr/NNNN-*.md` |
| 3 | `designer` ∥ `architect` ∥ `devops` (mode 1) | `design.md`, `contract.md`, `deploy.md` |
| 3c | **Design gate** | blocks step 4 until `design.md` is complete |
| 3d | `devops` (mode 2) on `ops/<task>` | Pass/Fail smoke build; blocks step 4 |
| 4 | `frontend-dev` ∥ `backend-dev` | branches `fe/<task>`, `be/<task>` |
| 5 | Orchestrator | merge into `feature/<task>` (`--no-ff`) |
| 6 | `code-reviewer` | Approve / Reject |
| 7 | `qa-tester` ∥ `docs-writer` | `qa-report.md`, docs, `release-notes.md` |
| 8 | `code-reviewer` | Approve / Reject on docs and fix diff |
| 9 | `devops` (staging) | staging health and smoke result |
| 10 | **Human gate** | approve / reject via `AskUserQuestion` |
| 11 | `devops` (production) | canary → 100%, or rollback |
| 12 | Orchestrator | closing checks and final message |

Run profiles can skip some steps, but review, QA, staging and the Human gate are never skipped.

---

## Key Concepts

- **Hand-off JSON:** every agent ends with a JSON block validated by [skills/muffy/schemas/handoff.schema.json](skills/muffy/schemas/handoff.schema.json).
- **Loops & fallbacks:** max 3 fix loops per point, early stop on a repeated blocker, then escalation to the user. See [skills/muffy/references/loops.md](skills/muffy/references/loops.md).
- **Memory:** repo (`docs/`), task folder (`.team/<task>/`), and Obsidian vault (`SECOND_BRAIN_VAULT`). See [skills/muffy/references/memory-model.md](skills/muffy/references/memory-model.md).
- **Hooks:** the installer does not add them. The env guard and team-flow rules are in `team-flow-settings-template.json` and must be merged by hand.

---

## Development & Quality Gates

```bash
npm test             # lint + offline evals (also runs in CI)
npm run lint         # prompt/link lint only
npm run eval         # offline evals only
npm run eval:sync    # re-copy each agent's rubric from its quality-checks.md
npm run package      # stage a clean copy in dist/muffy (no .git, no personal config)
```

- **Personal config:** copy `settings.local.json.template` → `.claude/settings.local.json` (gitignored).
- **CI:** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs lint, evals and the package check on every push and PR.
- **Evals:** see [evals/README.md](evals/README.md).
