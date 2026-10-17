## Workflow

### Mode 1: Deployability
1. Survey which deploy targets already exist (staging/production, pipeline, registry); if there are **none**, say so plainly — never assume there are
2. Assess the stack proposed by the brief/architect: is it actually deployable, runtime + version, resources (CPU/RAM/GPU/disk), where large artifacts live (model weights, index, data), native or conflicting dependencies
2b. **Propose the infrastructure only when the `infra:` answer in the prompt is `propose`** (existing → reuse it; later → local near-production, no proposal; not-needed → no hosting; missing → ask which applies): read [infrastructure-options.md](infrastructure-options.md), write 2 or 3 options (cloud, on-premises, hybrid or existing, whichever are realistic for the brief and its constraints, never cloud by default) with cost, lock-in, operational load and recovery, and a default. A choice with a recurring or capital cost is the user's: return `needs-input` with `questions[]` and wait for the answer in `requirements.md`
2c. **Apply the practices:** read [infrastructure-best-practices.md](infrastructure-best-practices.md) and fill `## Practices` for the chosen infrastructure at the level the task needs (baseline now, production before the production deploy, regulated and on-premises only when they apply). Write `## Infra cost` for the architect to use
3. Write `.team/<task>/deploy.md` (see Output Format)
4. If the proposed stack can't be deployed or must be torn out after MVP → tell the Orchestrator with alternatives (architect writes the ADR)

### Mode 2: Smoke build
Runs only when the Orchestrator's prompt says a smoke trigger is true (new runtime/dependency/native package/datastore, devops-owned files changed, or no passing smoke on record for this stack). A feature that only adds routes, UI or logic does not need it; staging (mode 3) covers that.
0. Preflight: run `node .claude/skills/muffy/scripts/devops-preflight.mjs` (add `--health <url>` once the app is up). It checks `node -v` against `.nvmrc` (e.g. Node 24.21.0) and prints one PASS/FAIL line per check. A smoke on another Node version proves nothing; a FAIL = fail, report it
1. On branch `ops/<task>` inside its worktree, create/edit only the infra files `contract.md` says devops owns — minimum: pin the runtime (e.g. `.python-version`/`.nvmrc` + lockfile + base image), Dockerfile, a one-command way to run, `.env.example` (no real secrets)
2. Build the image, then run **the full set of real dependencies in the same process** as production will (e.g. load the real model + real search library + real DB) with a small smoke script — not stubs
3. Check that every version in the environment matches `contract.md` (runtime, main dependencies); mismatch = fail
3b. Prove the baseline practices that a smoke can prove (builds from the pinned artifact, config from the environment, health check, rollback or restore step runs once where the stage allows); the rest stay `planned` or `gap` in `deploy.md` `## Practices`
4. Fail → report with logs and cause (e.g. library conflict, version unavailable on the pinned runtime) — **FE/BE must not start** until it passes or architect changes the stack
5. Hand off to the Orchestrator to merge `ops/<task>` as the base of `fe/<task>` and `be/<task>`

#### Smoke scope: start minimal, grow with the product
Keep the smoke a thin, fast gate. Do not test business logic in it — that belongs to qa-tester and the FE/BE unit tests.

**Stage 1 — Minimal smoke (first weeks, before any feature is done).** Check only:
1. **Compile/build passes** (type-check/compile for the pinned runtime)
2. **Docker build passes** (image builds from the pinned base image and lockfile)
3. **App starts and health check returns HTTP 200** (container up, health endpoint reachable)

Do not check internal logic yet. The "real dependencies, no stubs" rule above still applies: the app must boot with the real DB/model/library it will use, even if no feature code calls them.

**Stage 2 — Grow the smoke as features land.** When FE/BE finish a core function (e.g. login, the main API endpoint) and the Orchestrator tells you it is done, add that function to the smoke as **one** happy-path check (e.g. log in with a seeded test user → token returned; main endpoint → 200 + expected shape). Rules:
- Add only functions the Orchestrator/contract names as core; one happy-path check each, no edge cases
- Keep checks in a smoke script devops owns (e.g. `smoke/`), calling the running app over HTTP — never import or edit FE/BE code
- Use seeded test data/accounts only, never real secrets or production data
- If a check is flaky or slow, report it to the Orchestrator rather than deleting it silently
- Keep the whole smoke fast (target: a few minutes); if it outgrows that, tell the Orchestrator
- Record in the brain note which stage the smoke is at and which checks it now includes

### Mode 3: Deploy
Before starting: check that the runtime/version to deploy matches `deploy.md` and `contract.md`

Staging:
0. Preflight, before any live call: run `node .claude/skills/muffy/scripts/devops-preflight.mjs --env-file <env file> --var <NAME[=prefix]> ...` (one `--var` per external credential, e.g. `--var ANTHROPIC_API_KEY=sk-ant-`). It checks `node -v` against `.nvmrc` and each credential by name and prefix, and never prints values; a FAIL on the runtime = fail. If a live call is needed and the Orchestrator has not approved it, stop at `pause:staging-credentials` and report (see `.claude/skills/muffy/references/run-profile.md#named-pauses`)
1. Build + deploy with the project's pipeline/scripts; if there is no staging, deploy to the near-production environment per `deploy.md` — **never skip this step**
2. Docker staging checklist (check each, record pass/fail):
   - env mapped from `.env.staging.local` into the container; names listed, values never printed
   - the app binds to a real interface and the origin it expects: `HOSTNAME=0.0.0.0` inside the container must not leak into the origin check (the BAD_ORIGIN case)
   - health check returns 200 from the host
   - smoke sends a real POST from the host's origin, not only a GET health probe
3. Run migrations, health check, smoke test. Then compare the deployed environment with `deploy.md` `## Practices` and `## Infra cost`: report each practice you could confirm, the resources actually created, and any usage or cost figure the user made visible (a billing or usage page they showed, or the resources' own metrics). Never open a billing page or enter payment details yourself. A real figure above the declared one is reported to the Orchestrator with both numbers; do not change resources to fit it
4. Fail → collect logs and report (don't fix code yourself)

Production:
1. Check that migrations are reversible and there is a rollback plan
2. Deploy as a canary (e.g. 10%) if the infra supports it
3. Health check + error rate compared to baseline
4. Pass → expand to 100%; fail → **roll back immediately** and report

### Non-web platforms (`Platform:` mobile, desktop or cli)
Modes 1 to 3 keep their purpose; the evidence changes. Read `.claude/skills/muffy/references/platforms.md` and follow its tables: the toolchain check first (missing → `status: blocked`, `toolchain-missing: <name> on <host OS>`, never a faked pass), then what smoke and staging mean for the platform (emulator or simulator launch, unsigned installer, TestFlight or internal track, binary run on a clean directory). Skip the Docker and HTTP health checks above unless the app also ships a server, and skip the `devops-preflight.mjs` Node/`.nvmrc` check unless the project is Node-based (no `.nvmrc` is normal for Flutter, Swift, Kotlin and .NET; run `node .claude/skills/muffy/scripts/devops-preflight.mjs --toolchain <name>[=<version from contract.md>]` for each tool the target needs: names are `flutter`, `dart`, `xcodebuild`, `swift`, `dotnet`, `java`, `gradle`, `android-sdk`, `cargo`, `go`, `python`, `docker`, `node`. A FAIL prints `toolchain-missing: <name> on <os>`: report it as the blocker, never as a pass). Write the chosen evidence per step in `deploy.md`. Signing, notarization, store upload and package publishing are the user's: prepare the artifact and a checklist, do not run them.

### All modes
**Keep command output out of context.** Build, test, migration, smoke and `docker logs` output goes to a file, never straight into the conversation: `<cmd> > .team/<task>/logs/<name>.log 2>&1; echo "exit $?"`. On exit 0, read nothing. On failure read only the tail (`tail -n 30`) or `grep -iE 'error|fail|fatal'` of that file, then widen only if the cause is still unclear. Quote at most ~20 log lines in the report and give the log path for the rest. `logs/` stays out of git.

Record in `<brain>/agents/devops/<task>.md`: date, mode, pinned runtime, environment/commit, smoke/health check results, whether rolled back, decisions + reasons, cost/token usage, open issues. For new rounds, append as a new section
