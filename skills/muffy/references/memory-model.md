# Memory model

The repo wins over the vault: an ADR overrides a vault note.

| Layer | Location | Holds |
|---|---|---|
| Source of truth | `docs/adr/`, `docs/plan/`, `docs/design-system/`, code | Decisions in force |
| Working files | `.team/<task>/` inside the feature worktree `.worktrees/feature-<task>/` (committed audit trail on `feature/<task>`, setup.md step 7; the main checkout has none) | Hand-offs between agents, `handoff/*.json`, `checkpoint.md`, `requirements.md` (user's answers to agent questions, Orchestrator-written) |
| Second brain | `<brain>` = `<vault>/Projects/<repo-name>/`, or `.team/brain/` when `SECOND_BRAIN_VAULT` is unset | Notes, lessons, open issues |

```
<brain>/project.md               Orchestrator only: Tasks, Lessons, Open issues, Retired lessons, Diagrams (repo path → Artifact URL)
<brain>/tasks/<task>.md          Orchestrator only: status, step, links, `## Diagrams` (published diagram URLs), task Lessons + Open issues
<brain>/agents/<role>/<task>.md  one folder per agent; written only by that agent, append-only
```

- **No vault**: `<brain>` lives in `.team/brain/`, same layout and same rules, and is committed, so every teammate who pulls sees the same `project.md` Lessons and Open issues. `project.md` is the one file several people's Orchestrators edit: pull before a run and commit it with the task, one runner per task at a time. The daily-note line in [closing.md](closing.md) is skipped
- The Orchestrator also writes `agents/code-reviewer/<task>.md` from code-reviewer's `### Second brain` section
- No one edits another agent's folder or another task's note; corrections go in the current note, citing the old one
- Readers: Orchestrator → `project.md` + current task note; researcher → `project.md` first, older notes only when `project.md` points to them; other agents → never the vault, only `brief.md`

## Files in `.team/<task>/`

`brief.md`, `ac.md`, `design.md`, `contract.md`, `deploy.md`, `design-review-<n>.md` (UX/UI review at 3c), `review-<n>.md`, `qa-report.md`, `release-notes.md`, `checkpoint.md`, `rounds/<step>-r<n>.md`, part files `ac/`, `brief/` (only when a main file passes 60 lines), `contract/` (always: `contract.md` is an index), `handoff/<step>-<role>-r<round>.json`, `spawns.tsv` (one line per fresh spawn), `fix.md` (fix lane, instead of `ac.md`/`contract.md`/`design.md`), `test-level` (L0-L4, Orchestrator-written), `full-regression.approved` (only while a user-approved full run is in progress), `canvas/`, `diagrams/`, `escalation-<n>.json` (only if a loop was cut off)

## Checkpoint

`.team/<task>/checkpoint.md` is the Orchestrator's compressed memory of the run. It is **rewritten, never appended**, and stays ≤ 40 lines. Rewrite it after: setup, steps 3d / 6 (Approve) / 9, every fix round, every escalation answer, every named pause ([run-profile.md](run-profile.md#named-pauses)), and whenever the conversation has grown long (also before `/compact` and when resuming). Each named pause also updates the vault task note's status before the run waits, so the vault never lags a stop.

```
# Checkpoint: <task>
Updated: step <n> · round <n>

## Goal                      pinned — copy verbatim from the request / brief.md, never summarize
## Run profile               first line: the lane (`checkpoint.mjs profile`, lanes.mjs); then skipped steps + reasons
## Status                    step reached; gates 2b (user-approved AC + plan)/3c (user-approved design)/3d passed|skipped; `paused at pause:plan-review` or `paused at pause:design-review` while waiting; canvas: <Claude Design Artifact URL> (set at 3b, updated on every republish); `diagrams: <n> published` (set at 3e; URLs live in the task note); `route: <name> · intake: <n> asked` (set at setup, from [route.md](route.md))
## Decisions in force        ADR ids, stack, runtime pin (from deploy.md)
## Loop counters             <step>:<owner> n/3, one line per point used
## Open blockers             id · file:line · owner · rounds open (latest round only, in full)
## History                   one line per closed round or escalation, with a [label] link
```

Link definitions go at the very end of the file, after the sections above.

- **Spawn log**: `.team/<task>/spawns.tsv`, Orchestrator-written, append-only, one tab-separated line per fresh spawn (not `SendMessage`), 8 columns: `step · agent · model · effort · round · verdict · reruns · note`. `verdict` is `pass`, `fail` or `blocked`, read from the hand-off the Orchestrator already opens; `reruns` is how many extra rounds the agent needed; `note` is ≤ 8 words (e.g. `re-run only`) and ends with `tok:<n>` copied from the token count the runtime reports when the agent finishes. That count is **cumulative per agent**: an agent continued with `SendMessage` reports its running total, so a later line for the same agent (log it too, with its round) replaces the earlier one and the lines of one agent are never added together. A count that is lower than the agent's earlier line is a copy error (`check-checkpoint.mjs` flags it) (`tok:n/a` only if none was reported; a closed task with `n/a` on more than half its spawns fails the check). Write the line when the agent finishes, not at closing, with `node .claude/skills/muffy/scripts/checkpoint.mjs spawn .team/<task> --step <s> --role <r> --model <m> --effort <e> --round <n> --handoff <file> [--reruns n] [--note "…"] [--tok <n>]` (verdict from the hand-off, note capped, check run). No header row. Closing turns it into Lessons ([closing.md](closing.md)); checked by [scripts/check-checkpoint.mjs](../scripts/check-checkpoint.mjs)
- **Round details live in `.team/<task>/rounds/<step>-r<n>.md`**, one file per closed round, written once and never edited again. Each is ≤ 100 lines with a fixed shape: `Owner`, `Hand-off` (path), `Verdict` (status, blocker ids), `Artifacts` (paths), `Notes` (≤ 5 lines). No narrative
- **Link references, not inline detail.** `## History` and `## Open blockers` hold one line per item and end with a reference-style link. Every label is defined once, at the bottom of `checkpoint.md`, in one block:

  ```markdown
  ## History
  - step 3d r1: gate FAIL, Node pin mismatch [3d-r1]
  - step 4 r2: fe + be merged, 187/187 tests [4-r2]

  [3d-r1]: rounds/3d-r1.md
  [4-r2]: rounds/4-r2.md
  ```

  Labels use `<step>-r<n>` (`3d-r1`, `4-r2`). A label used in the text must have a definition, and a definition with no use is removed
- **Summarize on a schedule**, not when memory happens to fail: after any loop round ≥ 2, the round's details go to `rounds/` and `## History` keeps only its one-liner; drop details already captured in `review-<n>.md` / `qa-report.md`
- **Size limits** (checked by [scripts/check-checkpoint.mjs](../scripts/check-checkpoint.mjs)): `checkpoint.md` ≤ 40 lines, not counting `## Goal` (it is copied verbatim, so a long request must not squeeze the other sections); every `rounds/*.md` ≤ 100 lines; every `[label]` (text inside code fences and backticks, such as `[u8]`, is not a label) has a matching definition and the target file exists
- **`## Goal` is never summarized.** It is what a looping agent forgets first
- **Resume or `/compact`**: read `checkpoint.md` + `<brain>/tasks/<task>.md` instead of replaying the conversation or re-reading finished artifacts. New session: [resume.md](resume.md). `## Status` always ends with `next: <step> · <owner> · <action>`
- Agents see it only from round 2 (`Checkpoint:` line in the prompt) and read only `## Goal` and `## Open blockers`
- The checkpoint is a cache of facts that live elsewhere: if it disagrees with an ADR, `contract.md` or a hand-off file, the other file wins and the checkpoint is corrected

## Splitting large artifacts

`ac.md`, `brief.md` and `contract.md` are read by many agents on every round, so they stay small. The main file is an **index plus the facts that cut across parts**; detail moves to a part file the reader opens only when needed. `ac.md` and `brief.md` split a section out only when it passes ~15 lines or the main file passes 60 lines, so small tasks keep one file each. `contract.md` is **always an index**: every section lives in a part file from the start, so no reader opens more than it needs.

```
ac.md        stories · AC table (id | one-line | [link]) · traceability · out of scope
ac/AC-<n>.md                 full Given/When/Then, edge cases, notes
brief.md     Context (≤10 lines) · second brain · options (title + recommendation) · must-not-miss · level reached
brief/options-<topic>.md     full options, trade-offs, evidence per decision
brief/context.md             long codebase findings with `path:line`
brief/references.md          URLs and sources
contract.md  index only: one summary line + [link] per section; runtime pin on the Stack line
contract/stack.md            stack, reasons, build/buy/reuse
contract/schemas.md          tables and migrations
contract/ownership.md        file ownership table
contract/ac-map.md           AC id → endpoint/logic
contract/endpoints/<slug>.md request, responses, errors per endpoint
```

- **Stays in the main file**, because agents or scripts read it everywhere: the AC table and traceability, Must-not-miss, `Level reached`, and the runtime pin (on the Stack line of `contract.md`)
- **Link references, not inline detail**, same as the checkpoint: one-line rows end with `[label]`, and every label is defined once at the bottom of the file (`[AC-2]: ac/AC-2.md`). Use the item's own id as the label (`AC-2`, `post-login`, `options-session`)
- **Ids are stable.** Never renumber or reuse an AC id or endpoint slug; a dropped AC is marked `dropped` in the table, not deleted
- **Part files are edited in place** (unlike `rounds/`). Whoever changes a part file updates its one-line summary in the main file in the same step; the main file wins if they disagree
- **Readers open the main file first**, then only the parts their work touches: an AC the diff covers, an endpoint a screen calls, the option behind a decision
- **Size limits** (checked by [scripts/check-artifacts.mjs](../scripts/check-artifacts.mjs)): main file ≤ 60 lines; every part file ≤ 120 lines (split again by topic); every `[label]` has a matching definition and the target exists; every AC id in `ac.md` appears in `contract.md` or a file under `contract/`
