# Workflow

**Onboard mode** (prompt says `mode: onboard`): skip these steps. Follow [onboard.md](../../../skills/muffy/references/onboard.md) 0c: read `docs/architecture/baseline.md`, write `docs/adr/NNNN-existing-stack.md` (numbered after the latest; link existing ADRs instead of duplicating them), and `docs/design-system/README.md` only when the prompt says the repo has a UI. Record what exists; recommend nothing. No `contract.md`.

**Normal mode:** if the prompt gives a `baseline.md` path, read it before step 1 and reuse its Stack and Conventions in step 6.

1. Read the existing code structure; reuse existing patterns
2. Write the contract as an index plus one part file per section (see [output-format.md](output-format.md)); `contract.md` holds only a one-line summary and a link per section. Make the contract complete enough for FE/BE to work separately: endpoint, method, request/response schema, error codes, status codes
3. Define schema / migrations that need to change
4. Specify **file ownership** — which files FE/BE/devops edit (infra files per `deploy.md` belong to devops; runtime + version in Stack must match what `deploy.md` pins) to reduce merge conflicts; shared files get a single named owner
5. Map every AC to some part of the contract (table `AC id → endpoint/logic`) — especially security and rate limits
6. Choose **a tech stack that won't need changing after MVP**:
   - Existing codebase? Reuse patterns (context defaults)
   - New codebase + confident? Document choice in contract.md + reasons
   - New codebase + unsure? Consult [`stack-defaults.md`](stack-defaults.md) — use gating defaults (Next.js + Postgres) or ranked catalog by language
   - Write choice in `contract.md` under a Stack section with reasons
   - **Build vs buy**: for each non-trivial capability (auth, payments, email, search, queue) record `build | buy | reuse` with one reason; prefer reuse of what the codebase or an existing ADR already has
   - **Cost is a delta against `docs/strategy.md`, not a fresh estimate.** `contract.md` always has a `## Cost` heading. Feature adds no new service, dependency, paid API or recurring cost → one line, `No new recurring cost`. Otherwise write the full section: monthly run cost (infra, third-party/API/token, licenses) and one-off effort (S/M/L per phase from `docs/plan/<task>.md`). Each figure is a range with its basis; no source for a number → mark `[assumed]`. Compare with the budget ceiling in `docs/strategy.md` (or `requirements.md`); over it, or none given and the estimate is material → say so in the final message and offer a cheaper option. Append each new build/buy choice and any new recurring cost to `docs/strategy.md` (`## Build vs buy log`, `## Cost baseline`)
6b. **Options before a hard-to-reverse choice.** For the stack, a datastore, the auth model, the deploy model or a module split that FE and BE will build on, write 2–3 real options in `contract/stack.md` (one line each: what it is, the trade-off, the cost delta, what it locks in) and the one you pick with the reason. One obvious option (the codebase or an ADR already decides it) → say so in one line instead
7. Write hard-to-reverse technical decisions (stack, DB, auth, deploy model, a build-vs-buy choice with a recurring cost) as an ADR at `docs/adr/NNNN-<kebab-title>.md`, numbered after the latest file, using the same format as the PM's ADRs
8. Record in `<brain>/agents/architect/<task>.md`: date, what was done, chosen stack, decisions + reasons, files created/edited (reference paths, don't copy content), cost/token usage, open issues. For fix rounds, append as a new section
