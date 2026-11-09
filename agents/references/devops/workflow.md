## Workflow

### Mode 1: Deployability
1. Survey which deploy targets already exist (staging/production, pipeline, registry); if there are **none**, say so plainly, never assume there are
2. Assess the stack proposed by the brief/architect: is it actually deployable, runtime + version, resources (CPU/RAM/GPU/disk), where large artifacts live (model weights, index, data), native or conflicting dependencies
3. Write `.team/<task>/deploy.md` (see Output Format)
4. If the proposed stack can't be deployed or must be torn out after MVP → tell the Orchestrator with alternatives (architect writes the ADR)

### Mode 2: Smoke build
Runs only when the Orchestrator's prompt says a smoke trigger is true (new runtime/dependency/native package/datastore, devops-owned files changed, or no passing smoke on record for this stack). A feature that only adds routes, UI or logic does not need it; QA on docker local covers that.
0. Preflight: run `node "<muffy>/scripts/devops-preflight.mjs"` (add `--health <url>` once the app is up). It checks `node -v` against `.nvmrc` (e.g. Node 24.21.0) and prints one PASS/FAIL line per check. A smoke on another Node version proves nothing; a FAIL = fail, report it
1. On branch `ops/<task>` inside its worktree, create/edit only the infra files `contract.md` says devops owns: minimum: pin the runtime (e.g. `.python-version`/`.nvmrc` + lockfile + base image), Dockerfile, a one-command way to run, `.env.example` (no real secrets)
2. Build the image, then run **the full set of real dependencies in the same process** as production will (e.g. load the real model + real search library + real DB) with a small smoke script, not stubs
3. Check that every version in the environment matches `contract.md` (runtime, main dependencies); mismatch = fail
3b. Prove the baseline practices that a smoke can prove (builds from the pinned artifact, config from the environment, health check, rollback or restore step runs once where the stage allows). Whatever it cannot prove goes under `## Risks` in `deploy.md`.
4. Fail → report with logs and cause (e.g. library conflict, version unavailable on the pinned runtime): **FE/BE must not start** until it passes or architect changes the stack
5. Hand off to the Orchestrator to merge `ops/<task>` as the base of `fe/<task>` and `be/<task>`

#### Smoke scope: start minimal, grow with the product
Keep the smoke a thin, fast gate. Do not test business logic in it: that belongs to qa-tester and the FE/BE unit tests.

**Stage 1: Minimal smoke (first weeks, before any feature is done).** Check only:
1. **Compile/build passes** (type-check/compile for the pinned runtime)
2. **Docker build passes** (image builds from the pinned base image and lockfile)
3. **App starts and health check returns HTTP 200** (container up, health endpoint reachable)

Do not check internal logic yet. The "real dependencies, no stubs" rule above still applies: the app must boot with the real DB/model/library it will use, even if no feature code calls them.

**Stage 2: Grow the smoke as features land.** When FE/BE finish a core function (e.g. login, the main API endpoint) and the Orchestrator tells you it is done, add that function to the smoke as **one** happy-path check (e.g. log in with a seeded test user → token returned; main endpoint → 200 + expected shape). Rules:
- Add only functions the Orchestrator/contract names as core; one happy-path check each, no edge cases
- Keep checks in a smoke script devops owns (e.g. `smoke/`), calling the running app over HTTP, never import or edit FE/BE code
- Use seeded test data/accounts only, never real secrets or production data
- If a check is flaky or slow, report it to the Orchestrator rather than deleting it silently
- Keep the whole smoke fast (target: a few minutes); if it outgrows that, tell the Orchestrator
- Record in the brain note which stage the smoke is at and which checks it now includes

### Non-web platforms (`Platform:` mobile, desktop or cli)
Modes 1 and 2 keep their purpose; the evidence changes. The toolchain check comes first ([platforms.md](../../../skills/muffy/references/platforms.md#toolchain-on-the-host); missing → `status: blocked`, `toolchain-missing: <name> on <host OS>`, never a faked pass), then the evidence for the platform:

| Platform | Smoke build (mode 2, step 3d) |
|---|---|
| `web` | Container builds and the health route answers |
| Android | Debug APK/AAB builds; app installs and launches on an emulator |
| iOS | Simulator build launches |
| Mac / Windows / Electron | App builds and starts, main window opens, exits cleanly |
| `cli` | Binary builds; `--help` and one core command exit 0 |

What to skip:
- Skip the Docker and HTTP health checks above unless the app also ships a server.
- Skip the `devops-preflight.mjs` Node/`.nvmrc` check unless the project is Node-based. A missing `.nvmrc` is normal for Flutter, Swift, Kotlin and .NET.

What to run instead: for each tool the target needs, run `node "<muffy>/scripts/devops-preflight.mjs" --toolchain <name>[=<version from contract.md>]`.
- Valid names: `flutter`, `dart`, `xcodebuild`, `swift`, `dotnet`, `java`, `gradle`, `android-sdk`, `cargo`, `go`, `python`, `docker`, `node`.
- A FAIL prints `toolchain-missing: <name> on <os>`. Report it as the blocker, never as a pass.

Write the chosen evidence for each step in `deploy.md`. Signing, notarization, store upload and package publishing are the user's: prepare the artifact and a checklist, do not run them.

### All modes
**Keep command output out of context.** Build, test, migration, smoke and `docker logs` output goes to a file, never straight into the conversation: `<cmd> > .team/<task>/logs/<name>.log 2>&1; echo "exit $?"`. On exit 0, read nothing. On failure read only the tail (`tail -n 30`) or `grep -iE 'error|fail|fatal'` of that file, then widen only if the cause is still unclear. Quote at most ~20 log lines in the report and give the log path for the rest. `logs/` stays out of git.

Record in `<brain>/agents/devops/<task>.md`: date, mode, pinned runtime, environment/commit, smoke/health check results, whether rolled back, decisions + reasons, open issues. For new rounds, append as a new section
