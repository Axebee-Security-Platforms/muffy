# 🎯 Skill Lifecycle & Muffy Agent Workflow

How skills power the team flow in muffy.

> Source: [skills/muffy/how-skill-work.html](skills/muffy/how-skill-work.html)

---

## How Muffy Agents Invoke Skills

### Example 1: Designer → `impeccable`

- **Orchestrator:** `"Design the login flow"`
- **Agent definition includes:** `skills: [impeccable]`
- **Workflow:** Designer creates canvas → uses `impeccable` skill to review visual hierarchy, accessibility, consistency with design system → polishes & reports

> 💡 Skill is declared in agent definition; activates during workflow

### Example 2: Frontend-dev → `impeccable`

- **Orchestrator:** `"Build the login UI per design.md"`
- **Agent definition includes:** `skills: [impeccable]`
- **Workflow:** Frontend-dev builds components using shadcn/ui → uses `impeccable` skill to review responsive design, contrast, accessibility → refines & commits

> 💡 FE developer can invoke skill to polish UI before code review

### Example 3: QA-tester → blocker triage

- **Orchestrator:** `"Test login feature on fe/login branch"`
- **QA workflow (no explicit skill call):** Write tests → Run tests → Separate blockers (breaks AC) from non-blockers (polish)
- **Result:** QA reports blockers to Orchestrator → Orchestrator routes blockers to FE/BE → QA retests when fixed

> 💡 QA's methodology is built into the agent's workflow; prioritization rules replace an external skill

### 🎯 Key Pattern: Skills in Muffy

- **Each agent has a defined set of skills** in its agent definition (e.g., `.claude/agents/designer.md`)
- **Skills activate at specific workflow steps** (e.g., Designer loads `impeccable` before handing off to Frontend)
- **When FE/BE need a skill**, it's listed in their agent definition or invoked during workflow based on task needs

---

## With Skill vs Without Skill

| ✓ With Skill | ✗ Without Skill |
|---|---|
| Pre-written workflow loaded | Agent reinvents workflow |
| Context stays focused | Context diluted with instructions |
| Consistent methodology | Inconsistent approach |
| Faster execution | Slower execution |
| Reduced token usage | Higher token usage |
| Reusable knowledge | Knowledge not captured |
| Team alignment | Team misalignment |

---

## Muffy Agent Team Flow with Skills

| Step | Agent | Skills |
|---|---|---|
| 1 | 🔍 Researcher | `research`, `deep-research` |
| 2 | 📋 Product | `to-prd`, `grilling` |
| 3 | 🏗️ Architect | `codebase-design`, `anthropic-skills:arch-review` |
| 4 | 🎨 Designer | `impeccable` |
| 5 | ⚙️ DevOps | `devops` (modes 1-3) |
| 6a | 💻 Frontend | `impeccable` |
| 6b | 🔧 Backend | `tdd` |
| 7 | 👀 Reviewer | `scrutinize`, `code-review` |
| 8 | ✅ QA | `tdd` |
| 9 | 📝 Docs | `anthropic-skills:write-runbook` |

> 🔄 **Skill-Powered Workflow Benefits**
>
> - ✓ Each agent loads the right skill for their role
> - ✓ Skills are reusable across projects
> - ✓ Consistent quality across the team
> - ✓ Knowledge stays in skills, not context
> - ✓ Faster onboarding of new agents

---

## Key Concepts

### 💡 What is a Skill?

A packaged set of instructions, workflows, and best practices for a specific task. Skills are invoked when an agent needs them, keeping context focused and token usage efficient.

### 🎯 When to Use Skills?

Use skills when a task has a standard methodology (testing, design review, code review, writing docs, debugging, etc.). Skills transform ad-hoc approaches into repeatable patterns.

---

## Development & Quality Gates

```bash
npm test            # prompt/link lint + offline evals (also runs in CI)
npm run package     # stage a clean copy in dist/muffy (no .git, no personal config)
```

- **Personal config**: copy `settings.local.json.template` → `.claude/settings.local.json` (gitignored)
- **Structured hand-offs**: every agent ends with a JSON block validated by `skills/muffy/schemas/handoff.schema.json`
- **Loops & fallbacks**: 3 fix loops per point, repeated-blocker early stop, user escalation — see `skills/muffy/references/loops.md`
- **Evals & mock scenarios**: see [evals/README.md](evals/README.md)
