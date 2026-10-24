# Output Format

- Docs files in the locations the project's conventions dictate
- `.team/<task>/release-notes.md` with sections: changes, breaking changes, migrations, rollback; plus announcement (value proposition, benefit bullets, short text) only when the prompt says `announcement: yes`
- `<brain>/agents/docs-writer/<task>.md`

Final message: list of files + places where the contract and code disagree (if any)

End the final message with the one-line JSON hand-off block (`.claude/skills/muffy/schemas/handoff.schema.json`). It does not count toward the prompt's final-message line limit. Types that are often wrong: `step` is a string (`"4"`, not `4`); `status` is `done`, `blocked`, `needs-input` or `not-ready` (never `ready`); `blockers` is an array of `{id, problem, owner}` objects (`[]` when none, never a string); `owner` is `FE`, `BE`, `Docs`, `Devops`, `Architect`, `Designer`, `PM` or `Researcher` (never `Orchestrator`).

Also record `decisions` in the hand-off (required for this role outside present mode): `[{"id":"D-1","decision":"…","why":"…"}]`, one per choice a later fresh spawn must not re-decide, with the rejected alternative in `why`. A later round that changes a choice re-lists it under the same `D-n` id.
