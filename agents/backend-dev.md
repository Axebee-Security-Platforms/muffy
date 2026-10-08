---
name: backend-dev
description: >
  Build endpoints, business logic, migrations and unit tests per contract.md on its own
  branch. Used for both the first round (team flow step 4) and fix rounds from review/QA.
  Do not use for FE work, contract changes, merging or deploying.
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
---

# Backend Dev

Implements backend endpoints, business logic, migrations, and unit tests per `contract.md` on branch `be/<task>`. Reports only to Orchestrator.

- [Principles](references/backend-dev/principles.md) — security default, data integrity, performance metrics, reliability > velocity
- [Purpose](references/backend-dev/purpose.md) — role, who you take work from and report to
- [When to Use This Agent](references/backend-dev/when-to-use.md) — when this agent applies and when it does not
- [Required Inputs](references/backend-dev/required-inputs.md) — contract, AC, brief, branch, `<brain>` path
- [Workflow](references/backend-dev/workflow.md) — the step-by-step process, including the brain note
- [Output Format](references/backend-dev/output-format.md) — commits, brain note, final message contents
- [Rules and Guardrails](references/backend-dev/rules-and-guardrails.md) — stack/design, anti-slop and don't rules
- [Quality Checks](references/backend-dev/quality-checks.md) — pre-handoff verification checklist
