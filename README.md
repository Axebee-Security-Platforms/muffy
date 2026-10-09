<h1 align="center">Muffy</h1>

<p align="center">Feature development agent team: one skill, ten subagents, one feature from research to production.</p>

<blockquote>

**Summary.** The `muffy` skill runs a 12-step team of subagents (research, product, design, architecture, devops, frontend, backend, review, QA, docs) for one feature. It replaces ad-hoc multi-agent prompts with a fixed flow, gated hand-offs, and fix-loop limits, so unreviewed code and lost hand-offs stop reaching `main`.

</blockquote>

<h2>With and without the skill</h2>

<table>
  <thead>
    <tr>
      <th align="left">Topic</th>
      <th align="left">With muffy</th>
      <th align="left">Without muffy</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Order of work</td>
      <td>Fixed 12-step flow; each step has an owner and inputs</td>
      <td>Agents run in whatever order the prompt suggests</td>
    </tr>
    <tr>
      <td>Hand-offs</td>
      <td>Files in <code>.team/&lt;task&gt;/</code> plus a validated JSON block</td>
      <td>Chat summaries that the next agent may misread</td>
    </tr>
    <tr>
      <td>Review</td>
      <td>Code review and QA gates; Human gate before production</td>
      <td>Depends on whether someone remembers to ask</td>
    </tr>
    <tr>
      <td>Failures</td>
      <td>Max 3 fix loops, early stop on a repeated blocker, then escalation</td>
      <td>Retries continue until the user intervenes</td>
    </tr>
    <tr>
      <td>Instructions</td>
      <td>Loaded per step from references</td>
      <td>Every agent gets the full brief in its prompt</td>
    </tr>
    <tr>
      <td>Reuse</td>
      <td>Same flow for every feature and repo</td>
      <td>Rebuilt for each feature</td>
    </tr>
  </tbody>
</table>

<h2>How to install</h2>

Requires Node 18+. Run from anywhere, pointing at the target repo root:

```bash
node install.mjs /path/to/your-repo --vault "/absolute/path/to/Obsidian Vault"
```

- Preview first with `--dry-run`. Update an existing install with `--clean`.
- Hooks are not installed automatically. Merge `team-flow-settings-template.json` into `.claude/settings.local.json` by hand.
- Full steps: [INSTALL.md](INSTALL.md).

<h2>Key concepts</h2>

<table>
  <thead>
    <tr>
      <th align="left">Concept</th>
      <th align="left">What it is</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Orchestrator</strong></td>
      <td>The main Claude Code session. It starts each step, routes hand-offs, runs the gates, and is the only role that merges.</td>
    </tr>
    <tr>
      <td><strong>Subagents</strong></td>
      <td>Ten specialists in <code>.claude/agents/</code>. They never talk to each other; all work goes through the Orchestrator.</td>
    </tr>
    <tr>
      <td><strong>Gates</strong></td>
      <td>Design gate (3c), smoke build (3d), code review (6, 8), QA, staging, and the Human gate (10). Only the Human gate approves production.</td>
    </tr>
    <tr>
      <td><strong>Hand-off JSON</strong></td>
      <td>Each agent ends with a JSON block validated against <code>handoff.schema.json</code>. An invalid block is sent back.</td>
    </tr>
    <tr>
      <td><strong>Loops</strong></td>
      <td>Max 3 fix rounds per point. A repeated blocker stops the loop early and escalates to the user.</td>
    </tr>
    <tr>
      <td><strong>Memory</strong></td>
      <td>Repo docs in <code>docs/</code>, working files in <code>.team/&lt;task&gt;/</code>, notes in the Obsidian vault set by <code>SECOND_BRAIN_VAULT</code>.</td>
    </tr>
  </tbody>
</table>

<h2>Example</h2>

Request in the main session: `/muffy add password reset, task name password-reset`

<details open>
<summary><strong>Walkthrough</strong></summary>

1. **Setup.** The Orchestrator confirms the scope with you and creates `.team/password-reset/`.
2. **Research and plan.** `researcher` writes `brief.md`. `product-manager` writes `ac.md` and `docs/plan/password-reset.md`.
3. **Parallel design.** `designer`, `architect`, and `devops` run together and produce `design.md`, `contract.md`, and `deploy.md`. The design gate must pass before code starts.
4. **Build.** `frontend-dev` and `backend-dev` work on `fe/password-reset` and `be/password-reset`. The Orchestrator merges them into `feature/password-reset`.
5. **Review and QA.** `code-reviewer` approves or rejects. `qa-tester` writes `qa-report.md` while `docs-writer` writes the docs and release notes.
6. **Release.** `devops` deploys to staging. You approve at the Human gate, then `devops` rolls out to production with a canary and a rollback path.

</details>

<h2>Development</h2>

```bash
npm test             # lint + offline evals (also runs in CI)
npm run lint         # prompt/link lint only
npm run eval         # offline evals only
npm run eval:sync    # re-copy each agent's rubric from its quality-checks.md
npm run package      # stage a clean copy in dist/muffy (no .git, no personal config)
```

- Personal config: copy `settings.local.json.template` to `.claude/settings.local.json` (gitignored).
- CI: [.github/workflows/ci.yml](.github/workflows/ci.yml) runs lint, evals, and the package check on every push and PR.
- Details: [SKILL.md](skills/muffy/SKILL.md) · [steps](skills/muffy/references/steps.md) · [loops](skills/muffy/references/loops.md) · [evals](evals/README.md)
