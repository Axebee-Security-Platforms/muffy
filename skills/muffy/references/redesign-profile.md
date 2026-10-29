# Redesign profile → the change lane, visible scopes

The redesign lane is now the **change lane** with a visible scope (`ui-only`, `ui+logic` or `logic-only`): [change-profile.md](change-profile.md). `/muffy redesign <request>` still starts it and asks the scope, and a checkpoint whose lane line says `lane: redesign (<scope>)` or `redesign lane (<scope>): …` reads as `lane: change (<scope>)`, so an older task resumes unchanged. A redesign line with no scope reads as a visible change and keeps its gates.

- Triage and the scope question: [change-profile.md](change-profile.md#scope-question-pausescope-always-asked-for-a-visible-change-never-defaulted)
- Steps by scope, `## Unchanged`, QA by path: [change-profile.md → Steps by scope](change-profile.md#steps-by-scope)
- A UI-only run that needs logic: [change-profile.md](change-profile.md#when-a-ui-only-run-needs-logic)
