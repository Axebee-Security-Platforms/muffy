# Token discipline

- **Prompt template** — every subagent prompt is only this, no pasted file contents (parsed shape: [prompt-envelope.schema.json](../schemas/prompt-envelope.schema.json)):
  ```
  Goal: <one line>
  Task: <task>  Brain: <brain>  [Vault: <vault> — researcher only]  [Mode: — devops only]
  Read: <paths>
  Write: <paths>
  Don't touch: <paths/scope>
  [Checkpoint: .team/<task>/checkpoint.md — from round 2 on; read only ## Goal and ## Open blockers]
  Commit trailer: <verbatim line, e.g. Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com> — passed to every agent, Sonnet-tier ones included; every commit ends with it>
  Final message: ≤ 10 lines — verdict/status, paths written, blockers (ids `B-n`, from round 1 on). Details belong in files. End with the one-line JSON hand-off block (.claude/skills/muffy/schemas/handoff.schema.json)
  ```
- **Writing JSON on Windows**: never write a hand-off or escalation file through a heredoc, `printf` or `echo` — backslashes in Windows paths break twice that way. Use the Write tool, or `JSON.stringify` in node, and then run the validator right away
- **Hand-off block**: every agent ends with one line of JSON. Save it as `.team/<task>/handoff/<step>-<role>-r<round>.json` and run `node .claude/skills/muffy/scripts/validate-handoff.mjs <file>` before acting on it. Route on the JSON (`status`, `verdict`, `blockers[].owner`), not by re-reading prose. Invalid → fallback ladder in [loops.md](loops.md)
- **Lazy loading**: read a reference only at the step that needs it — `SKILL.md` links each one to its step; `closing.md` only at step 12; `hooks-enforcement.md` only at setup; `loops.md` only when a reject/fail happens; this file and `memory-model.md` once at setup. Agents follow the "Load on demand" table in their own definition: `purpose`, `required-inputs` and `rules-and-guardrails` at start, `workflow` before acting, `output-format` before the first write, `quality-checks` before hand-off, `principles` only on judgment calls, `when-to-use` never after spawn. Don't ask an agent to "read all references"
- **Fix rounds continue the same agent** with `SendMessage` (its context is still loaded) and send only that owner's blockers/bugs as a list. Spawn fresh only if the agent is gone
- **Incremental diffs**: export each round as `diff-<n>.patch` containing only the changes since the last review
- **Read narrowly**: for gates and traceability checks, grep or read only the section needed (e.g. the `AC id →` table) instead of whole files; don't re-read a file you already checked unless it changed
- **Don't relay**: never copy one agent's output into another's prompt — give the path
- **Checkpoint instead of history**: from round 2 on, point to `checkpoint.md`; don't replay earlier rounds ([memory-model.md](memory-model.md#checkpoint))
- **Follow a link, don't load the folder**: an agent opens `rounds/<step>-r<n>.md` only when its own prompt names that label or path. Never Read or Glob all of `rounds/`
- **Model tiers**: only `haiku` and `sonnet` are allowed — never pass `opus` or `fable`. Agent frontmatter sets the default (`docs-writer` = haiku, the rest = sonnet). When spawning fresh (not `SendMessage`), pass `model: "haiku"` for:
  - `qa-tester` re-running existing tests only (no new tests to write)
  - `frontend-dev` / `backend-dev` fix rounds where every bug names a file + line and the expected fix
  - `researcher` when the run profile asks for codebase-only / minimal research
- **Never downgrade** `code-reviewer`, `architect`, or `devops` in production mode — a miss there costs more than the tokens saved
- **Effort tiers**: effort is a separate axis from model — how hard the agent thinks, not which model thinks. Allowed: `low`, `medium`, `high` — never `xhigh` or `max`. Agent frontmatter sets the default (`architect`, `code-reviewer`, `devops` = high; `backend-dev`, `frontend-dev`, `designer`, `qa-tester` = medium; `researcher`, `docs-writer`, `product-manager` = low). When spawning fresh, decide the effort from these signals — read them from files, don't judge by feel:

  | Signal | Read from | Effect |
  |---|---|---|
  | High impact: touches auth, payments, data migrations or secrets | `contract.md` (schemas, file ownership) | `high`, overrides everything below |
  | Assumed requirements: `[assumed]` items | `ac.md`, `requirements.md` | +1 level |
  | Stalled: the same blocker id open in ≥ 2 consecutive rejections | `checkpoint.md` `## Open blockers` | +1 level |
  | Exact fix: every open bug names file + line + expected fix (also re-running existing tests) | hand-off `blockers[]` | −1 level |

  Combine: start at the role default, add the effects, cap the net move at one level either way, stay within `low`–`high`. The same rules are checked offline by `npm test`
  - **Never lower** the effort of `code-reviewer`, `architect` or `devops` in production mode, same reason as model
  - A `SendMessage` fix round keeps the agent's current effort; to change it, spawn fresh and point it at `checkpoint.md`
  - Record the signals used and the resulting effort in checkpoint `## Run profile` (one line); skip the line when the default applies
