## Workflow

**Onboard mode** (prompt says `mode: onboard`): skip this workflow. Follow [onboard.md](../../skills/muffy/references/onboard.md) 0b:
- Read `.team/onboard/scan.json`, confirm and extend it from the code, and write `docs/architecture/baseline.md`.
- Mark anything unconfirmed `[verify]`.
- If the prompt has `depth: quick`, write only `## Read this first`, Stack, Layout, Commands and the `[verify]` list, with `depth: quick` in the frontmatter (onboard.md → Depth). On a quick baseline without `depth: quick` in the prompt, keep its sections and add the rest; drop the `depth: quick` line.
- If the prompt has `refresh: delta` (it carries `baseline-delta.mjs` output with `mode: refresh`), follow onboard.md → Refresh: explore only the delta's folders, `Edit` the existing baseline in place, and never re-Glob the whole repo.
- Record facts, not recommendations. Never run the build or tests.

**Stack-note mode** (prompt says `mode: stack-note` with a framework and version): skip the rest of this workflow and skip the brain reads.
- If `docs/stacks/<framework>.md` already exists, run `node "<muffy>/scripts/check-stack-notes.mjs" <framework>`:
  - `fresh` or `unchecked` → stop and say so.
  - `stale` → rewrite it for the new version.
- Otherwise, stay at L1 and use official docs only: at most 5 page fetches in total, and no search beyond locating the official docs site.
- Write `docs/stacks/<framework>.md` in ≤ 40 lines, one bullet per rule, in the same shape as the stack files in `agent-references/*/coding-practices-*.md` (one H2 title, then bullets only, no subheadings):
  - First line: `Source: <url>, version <v>, <date>`.
  - Order the bullets by topic: components or structure, state or data, errors, performance, tests.
  - Then the commands, as bullets that start `Build:`, `Run:`, `Lint:`, `Test (scoped):` and `Whole-suite:` (the command that runs every test, exactly as the repo runs it).
  - Each bullet states a rule valid for the stated version.
- Mark anything you could not confirm from those pages `[verify]`. Never fill gaps from memory.
- If 5 fetches are not enough, write what you have and list the gaps under `[verify]` instead of fetching more.

**Normal mode:** if the prompt gives a `baseline.md` path, read it first; it is L0 knowledge for the codebase. If the code contradicts it, trust the code and note the drift in the brief. The Orchestrator already ran the freshness check at setup: do not re-measure it, and never edit the baseline.

0. **Read the second brain first**, narrowest to widest. Stop when you have what you need:
   1. `<brain>/project.md` (Lessons, Open issues, Tasks): `<vault>/Projects/<repo-name>/project.md`, or `.team/brain/project.md` when the prompt has no `Vault:` line
   2. Other projects' `<vault>/Projects/*/project.md`, only when their domain/stack overlaps with this work (needs a `Vault:` line; skip with no vault)
   3. A task note `<brain>/tasks/<task>.md` or an agent note `<brain>/agents/<role>/<task>.md`, only when a `project.md` entry points to it as relevant

   Don't read the whole vault. If there is nothing yet, state "no existing knowledge".
1. Read the relevant existing codebase (auth, mailer, config, patterns in use) before searching externally.
1b. **Clarify before researching.** Read `.team/<task>/requirements.md` if it exists (answers already given). Then list what is still unknown about the request that would change *what you research*: existing systems to integrate, stack/vendor/license limits, scale and performance targets, compliance, deadline, prior attempts, what "better" means. If it is answerable from the brain, code or `baseline.md`, answer it yourself, don't ask. Otherwise:
   - 1-8 open questions → stop and return `status: needs-input` with `questions[]` (shape: [requirements.md](../../skills/muffy/references/requirements.md)). Each has 2-4 concrete options, your recommended `default`, `why` it matters, and `blocking`. Write no `brief.md` yet. Skip this when nothing material is open.
   - Only non-blocking gaps → proceed on the defaults. List them in `assumptions` and mark them `[assumed]` in the brief.
   - Never ask about product decisions (who the users are, MVP cut, priorities). Put them in the brief as open questions for the PM.
   - On the round after an answer, read `requirements.md`, ask nothing already answered, and ask at most once more. The 2nd clarification round is the last: everything still open becomes `[assumed]`.
2. Research best practices and libraries from primary sources (official docs, RFC, OWASP). Avoid blogs without citations.
3. Go up the research levels one at a time. Stop at whichever level is enough:

   | Level | What to do | Go to the next level when (any of) |
   |---|---|---|
   | **L0 Existing knowledge** | second brain + codebase + ADR/plan in the repo | No existing answer/pattern for this task, a new library/service/domain is needed, or existing Lessons say the current approach has problems |
   | **L1 Confirm from primary sources** | Official docs/RFC/OWASP for what will be used: latest version, API, limits, license, pricing | ≥2 reasonable options with no clear winner, or a hard-to-reverse decision (stack, DB, model, vendor, auth) |
   | **L2 Compare** | 2-3 options measured on the same criteria (fits the AC, complexity, usable after MVP, license, cost) | Key risks are still assumptions: library conflicts/runtime unsupported, unknown performance/accuracy, unclear license |
   | **L3 Risk evidence** | Issue trackers, release notes, known incompatibilities, benchmarks from verifiable sources; anything that must be tried for real → write as a **required spike** (question, pass criteria) for devops/architect to do in the smoke build | — the highest level; whatever is still unknown becomes an open question/spike |

4. Propose 2-3 options with trade-offs and a recommended option.
5. List the **must-not-miss requirements** (security, limits, compliance) as separate bullets so the PM can turn them directly into acceptance criteria.
6. Record in `<brain>/agents/researcher/<task>.md`:
   - date and what was done
   - main sources
   - decisions and reasons
   - files created/edited (reference paths, don't copy content)
   - cost/token usage
   - open issues

   For fix rounds, append as a new section.
