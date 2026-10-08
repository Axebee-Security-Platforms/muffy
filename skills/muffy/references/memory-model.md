# Memory model

The repo wins over the vault: an ADR overrides a vault note.

| Layer | Location | Holds |
|---|---|---|
| Source of truth | `docs/adr/`, `docs/plan/`, `docs/design-system/`, code | Decisions in force |
| Working files | `.team/<task>/` (committed audit trail) | Hand-offs between agents |
| Second brain | `<brain>` = `<vault>/Projects/<repo-name>/` | Notes, lessons, open issues |

```
<brain>/project.md               Orchestrator only: Tasks, Lessons, Open issues, Retired lessons
<brain>/tasks/<task>.md          Orchestrator only: status, step, links, task Lessons + Open issues
<brain>/agents/<role>/<task>.md  one folder per agent; written only by that agent, append-only
```

- The Orchestrator also writes `agents/code-reviewer/<task>.md` from code-reviewer's `### Second brain` section
- No one edits another agent's folder or another task's note; corrections go in the current note, citing the old one
- Readers: Orchestrator → `project.md` + current task note; researcher → `project.md` first, older notes only when `project.md` points to them; other agents → never the vault, only `brief.md`
