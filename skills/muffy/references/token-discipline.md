# Token discipline

- **Prompt template** — every subagent prompt is only this, no pasted file contents (parsed shape: [prompt-envelope.schema.json](../schemas/prompt-envelope.schema.json)):
  ```
  Goal: <one line>
  Task: <task>  Brain: <brain>  [Vault: <vault> — researcher only]  [Mode: 1 | 2 | 3 — devops; onboard | stack-note — researcher; onboard — architect]  [Profile: fix — fix lane only; Read: fix.md replaces ac/contract/brief/design]
  [Worktree: <path> · Branch: <branch> — frontend-dev, backend-dev, qa-tester, devops mode 2; created by the Orchestrator (setup.md step 7)]
  Read: <paths>
  Write: <paths>
  Don't touch: <paths/scope>
  [Announcement: yes — docs-writer only, when the user opted in at pause:scope]
  [PR diagram: yes — frontend-dev/backend-dev only, when the user asked for step 5b ("draw the PR diagram")]
  [Human approved: <date> — devops step 11 only, after the step-10 Human gate]
  [Test level: L0–L4 — qa-tester only; copy the row from test-levels.md]
  [Full regression: approved — qa-tester only, after pause:full-regression; absent means qa-tester must run scoped tests only]
  [Checkpoint: .team/<task>/checkpoint.md — from round 2 on; read only ## Goal and ## Open blockers]
  Commit trailer: <verbatim attribution line the harness gave the Orchestrator for this session — never typed from the skill, never a model name taken from a file — passed to every agent; every commit ends with it>
  Final message: ≤ 10 lines (code-reviewer exempt: its message is saved as review-<n>.md) — verdict/status, paths written, blockers (ids `B-n`, from round 1 on). Details belong in files. End with the one-line JSON hand-off block (.claude/skills/muffy/schemas/handoff.schema.json)
  ```
- **Writing JSON on Windows**: never write a hand-off or escalation file through a heredoc, `printf` or `echo` — backslashes in Windows paths break twice that way. Use the Write tool, or `JSON.stringify` in node, and then run the validator right away
- **Hand-off example** — put this in every prompt's `Final message:` line so the agent copies a valid shape (values are the allowed ones; `status` is never `ready`, `step` is a string, `blockers` is an array, `owner` is never `Orchestrator`):
  ```json
  {"role":"backend-dev","task":"<task>","step":"4","round":1,"status":"done","paths_written":["src/a.ts"],"ac_ids_done":["AC-1"],"blockers":[],"quality_checks":{"passed":true,"failed":[]},"summary":"one line"}
  ```
  A blocker looks like `{"id":"B-1","problem":"...","file":"src/a.ts:12","owner":"BE"}` with `owner` one of FE, BE, Docs, Devops, Architect, Designer, PM, Researcher
- **Agents with `Write` save their own hand-off**: every agent except `code-reviewer` (tools: Read, Grep, Glob) puts `.team/<task>/handoff/<step>-<role>-r<round>.json` in its `Write:` line, writes it with the Write tool using forward slashes, runs `validate-handoff.mjs` on it when it has Bash, and still ends its message with the same one-line block. The Orchestrator then only validates (or, for `code-reviewer`, saves the block from the message). `architect`, `designer`, `product-manager`, `docs-writer` and `researcher` have Bash for checks only (the muffy `scripts/*.mjs` checks listed in [hooks-enforcement.md](hooks-enforcement.md) §9 and read-only git, stated in their guardrails), so they validate their own hand-off and artifacts; they never commit, and the Orchestrator commits their files. `code-reviewer` stays read-only with no Bash
- **Hand-off block**: every agent ends with one line of JSON. It is saved as `.team/<task>/handoff/<step>-<role>-r<round>.json` (by the agent, see above) and `node .claude/skills/muffy/scripts/validate-handoff.mjs <file>` runs before you act on it. Route on the JSON (`status`, `verdict`, `blockers[].owner`), not by re-reading prose. Invalid → fallback ladder in [loops.md](loops.md)
- **Lazy loading**: read a reference only at the step that needs it — `SKILL.md` links each one to its step; `closing.md` only at step 12; `hooks-enforcement.md` only at setup; `loops.md` only when a reject/fail happens; this file and `memory-model.md` once at setup. Agents follow the "Load on demand" table in their own definition: `purpose`, `required-inputs` and `rules-and-guardrails` at start, `workflow` before acting, `output-format` before the first write, `quality-checks` before hand-off, `principles` only on judgment calls, `when-to-use` never after spawn. Don't ask an agent to "read all references"
- **Fix rounds continue the same agent** with `SendMessage` (its context is still loaded) and send only that owner's blockers/bugs as a list. Spawn fresh only if the agent is gone
- **Incremental diffs**: export each round as `diff-<n>.patch` containing only the changes since the last review
- **Topic-split review diffs**: when `diff-<n>.patch` is over ~1,500 lines or touches more than ~15 files, run `node .claude/skills/muffy/scripts/split-diff.mjs .team/<task>/diff-<n>.patch` (it checks the size itself and does nothing when the diff is small). It writes one patch per topic, `diff-<n>-<topic>.patch`, plus `diff-<n>-index.md`; give `code-reviewer` the topic files in `Read:` instead of the whole `diff-<n>.patch`. A topic is one reviewable concern: a vertical slice (data/migration, API routes + their DB layer, client queries/hooks, UI components, infra/docs/smoke). The script keeps each test with the code it tests, splits by directory depth until a topic fits, and verifies that every file lands in exactly one topic with no bytes lost. Override its grouping with `--rules rules.json` (`[{"topic", "match": regex}]`) when the path layout hides the real concern. Limits: `--max-lines`, `--max-files`. Example, `manual-asset-mapping` (67 files, 8,164 lines) → 10 topics such as `db-migration`, `nms-ingest-routes`, `nms-ingest-db`, `nms-dashboard-shared`, `infra-docs-smoke`. Keep the full `diff-<n>.patch` for docs-writer; fix rounds are small and stay one file
- **Read narrowly**: for gates and traceability checks, grep or read only the section needed (e.g. the `AC id →` table) instead of whole files; don't re-read a file you already checked unless it changed
- **Don't relay**: never copy one agent's output into another's prompt — give the path
- **Checkpoint instead of history**: from round 2 on, point to `checkpoint.md`; don't replay earlier rounds ([memory-model.md](memory-model.md#checkpoint))
- **Follow a link, don't load the folder**: an agent opens `rounds/<step>-r<n>.md` only when its own prompt names that label or path. Never Read or Glob all of `rounds/`
- **Model tiers**: only `haiku` and `sonnet` are allowed — never pass `opus` or `fable`. Agent frontmatter sets the default (`docs-writer` = haiku, the rest = sonnet). When spawning fresh (not `SendMessage`), pass `model: "haiku"` for:
  - `qa-tester` re-running existing tests only (no new tests to write)
  - `frontend-dev` / `backend-dev` fix rounds where every bug names a file + line and the expected fix
  - `researcher` when the run profile asks for codebase-only / minimal research
  - `frontend-dev` / `backend-dev` step 4a (fix lane) when the symptom already names the file and line; see [fix-profile.md](fix-profile.md)
- **Learn from this project's spawn history**: before passing `model: "haiku"` for a case above, check `<brain>/project.md` `## Lessons` for a bullet on that agent + model. If it records haiku failing or needing reruns in this repo, keep the frontmatter default (sonnet). Log every fresh spawn to `.team/<task>/spawns.tsv`, including in the fix lane, with its `tok:` count when the agent finishes ([memory-model.md](memory-model.md#checkpoint)). This only ever moves an agent between `haiku` and `sonnet`, never above
- **Devops web access** is for infrastructure facts only (provider pricing, regions, SLAs, hardware specifications and support dates, software licences), official pages only, at most 6 fetches per round, recorded as `<url> · checked <date>` ([infrastructure-options.md](../../../agents/references/devops/infrastructure-options.md)).
- **Architect web access** is for provider facts only (pricing, limits, licence, data location, compliance, SDK support), official pages only, at most 6 fetches per round, sources recorded as `<url> · checked <date>` ([third-party-providers.md](../../../agents/references/architect/third-party-providers.md)). Anything broader goes to `researcher`.
- **Unknown stack** ([stack-learning.md](stack-learning.md)): `frontend-dev`, `backend-dev`, `architect`, `qa-tester` and `devops` can raise `stack-unknown`; none of them has web access for it (the architect's and devops's web access is for provider and infrastructure facts only). A `stale` note counts as missing. After the note is written, merge `check-stack-notes.mjs --guard-entries` into `.team/regression-commands.json`. `frontend-dev` / `backend-dev` have no web access. When one returns `blocked` with a `Researcher` blocker `stack-unknown: <framework> <version>`, first check that `docs/stacks/<framework>.md` doesn't already exist (then just `SendMessage` the agent to read it). Otherwise spawn `researcher` once, with `model: "haiku"`, effort `low`, prompt `Mode: stack-note`, framework and version. It is capped at L1, official docs only, 5 fetches and a ≤ 40-line note, and it is run once per framework per repo, never per task. Then `SendMessage` the blocked agent to resume. Never escalate this to L2/L3 or a normal research run
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
