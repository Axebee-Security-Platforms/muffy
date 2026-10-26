# Workflow

**Onboard mode** (prompt says `mode: onboard`): skip these steps. Follow [onboard.md](../../../skills/muffy/references/onboard.md) 0c. Record what exists; recommend nothing. No `contract.md`.
- Read `docs/architecture/baseline.md`.
- Write `docs/adr/NNNN-existing-stack.md`, numbered after the latest. Link existing ADRs instead of duplicating them.
- Write `docs/design-system/README.md` only when the prompt says the repo has a UI.
- Only when the repo has no architecture diagram at all ([diagrams.md](diagrams.md), "Onboard overview"), add a `diagrams_spec` entry for a high-level `docs/architecture/overview.html`. `diagrammer` draws it at 0c', not you.

**Lite profile** (prompt says `Profile: lite`): there is no `brief.md` and no `design.md`. `ac.md` was written by the Orchestrator and names `Kind:` and `Owner:`.
- Write the contract as in normal mode below, for the owners named only.
- If the work needs something this lane skips, do not design around it. Hand off `status: blocked` with one blocker. Its `owner` says who is missing:
  - `Researcher` for a new dependency, provider or stack fact
  - `PM` for a change users or outside callers see, or auth, permissions or personal data
  - `Designer` for a screen, flow or component

  Its `problem` names the AC.
- The Orchestrator then promotes the task to the full flow ([lite-profile.md](../../../skills/muffy/references/lite-profile.md#promote-to-the-full-flow)).

**Review only** (prompt says `Review only`, route `arch-review`): read the ADR, contract, baseline or module the prompt names, and the code it describes. Write no file.
- Return findings in the final message, one per line: `A-<n> · where · problem · why it matters · suggested change`.
- Say which finding would need a new ADR.
- Hand-off: `status: done`, `paths_written: []`.

**ADR only** (prompt says `ADR only`, route `adr`): write one technical ADR in `docs/adr/` per [adr.md](../../../skills/muffy/references/adr.md), numbered after the latest, `Kind: technical`. Supersede an older one only when the prompt names it. A product decision is not yours: return `blocked` with a blocker `owner: PM`. No contract, no task folder.

**Normal mode:** if the prompt gives a `baseline.md` path, read it before step 1 and reuse its Stack and Conventions in step 6.

1. Read the existing code structure; reuse existing patterns.
2. Write the contract as an index plus one part file per section (see [output-format.md](output-format.md)). `contract.md` holds only a one-line summary and a link per section. Make the contract complete enough for FE/BE to work separately: endpoint, method, request/response schema, error codes, status codes.
3. Define schema / migrations that need to change.
3b. **Diagrams, only if a trigger fires.** Check the triggers in [diagrams.md](diagrams.md) against the contract you just wrote.
   - None fires → no diagram. Note `diagrams: none needed (<reason>)`.
   - A trigger fires → it becomes a `diagrams_spec` entry in your hand-off, not a file. `diagrammer` draws it.
   - Not in the fix lane. (Onboard mode: only the one-time overview above.)
4. Specify **file ownership**: which files FE/BE/devops edit. This reduces merge conflicts.
   - Infra files per `deploy.md` belong to devops. The runtime + version in Stack must match what `deploy.md` pins.
   - Shared files get a single named owner.
   - One owner per row (`FE`, `BE` or `devops`), and no two owners' patterns may overlap (`src/**` for BE next to `src/ui/**` for FE fails `check-artifacts`).
   - The Orchestrator checks every branch against this table before merging.
5. Map every AC to some part of the contract (table `AC id → endpoint/logic`), especially security and rate limits.
6. Choose **a tech stack that won't need changing after MVP**. If the stack has no practices file and no `docs/stacks/` note, return `blocked`, blocker `owner: Researcher`, problem `stack-unknown: <framework> <version>`, before the contract is final, per [stack-ladder.md](../shared/stack-ladder.md).
   - Existing codebase? Reuse patterns (context defaults).
   - New codebase + confident? Document the choice in contract.md + reasons.
   - New codebase + unsure? Consult [`stack-defaults.md`](stack-defaults.md): use the gating defaults (Next.js + Postgres) or the ranked catalog by language.
   - Write the choice in `contract.md` under a Stack section with reasons.
   - **Build vs buy:** for each non-trivial capability (auth, payments, email, search, queue), record `build | buy | reuse` with one reason. Prefer reuse of what the codebase or an existing ADR already has. For a capability worth buying, read [third-party-providers.md](third-party-providers.md), propose 2 or 3 provider options, and let the user choose through the Orchestrator.
6b. **Options before a hard-to-reverse choice.** This covers the stack, a datastore, the auth model, the deploy model, or a module split that FE and BE will build on.
   - Write 2-3 real options in `contract/stack.md`: one line each (what it is, the trade-off, what it locks in), plus the one you pick with the reason.
   - If there is one obvious option (the codebase or an ADR already decides it), say so in one line instead.
7. Write hard-to-reverse technical decisions (stack, DB, auth, deploy model, a build-vs-buy choice) as an ADR at `docs/adr/NNNN-<kebab-title>.md`, numbered after the latest file, using the same format as the PM's ADRs with `Kind: technical`. Product decisions (scope, priorities) are the PM's ADRs, not yours; see [adr.md](../../../skills/muffy/references/adr.md).
8. Record in `<brain>/agents/architect/<task>.md`:
   - date and what was done
   - chosen stack
   - decisions and reasons
   - files created/edited (reference paths, don't copy content)
   - open issues

   For fix rounds, append as a new section.
