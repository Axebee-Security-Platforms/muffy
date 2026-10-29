# Lite profile → the change lane, `internal` scope

The lite lane is now the **change lane** with the `internal` scope: [change-profile.md](change-profile.md). `/muffy lite <request>` still starts it, `next-action.mjs triage lite` is the same triage as `triage change`, and a checkpoint whose lane line says `lane: lite` or `lite: skipped …` reads as `lane: change (internal)`, so an older task resumes unchanged.

- Triage and examples: [change-profile.md → The internal scope](change-profile.md#the-internal-scope)
- Setup, `ac.md`, steps: [change-profile.md](change-profile.md#setup-lite-replaces-setupmd), column `internal`
- Promote: [change-profile.md → Promote out of the internal scope](change-profile.md#promote-out-of-the-internal-scope)
