# Cloudflare security-audit skill: how it works and what muffy can borrow

Research for muffy's reviewer and fix lanes. Question: how does Cloudflare's `security-audit` Claude skill orchestrate an audit, verify findings and control false positives, and which of its techniques fit muffy?

Sources, all primary. **[S]** = `SKILL.md`, **[H]** = `HUNTING.md`, **[V]** = `VALIDATION-AND-REPORTING.md`, **[R]** = `RECONNAISSANCE.md`, **[A]** = `ATTACK-CLASSES.md`, **[AI]** = `AI-AND-LLM.md`, **[README]**, **[Blog]**. File paths are under `skills/security-audit/` in the repo https://github.com/cloudflare/security-audit-skill (cloned shallow from `main`; nothing executed). The blog is https://blog.cloudflare.com/build-your-own-vulnerability-harness. **[J]** = my judgment, not from a source.

Read in full: [S], [H], [V], [README], the blog. Read in part: [R] (phase 1 prompts and ledger schema), [A] (header), [AI] (core discipline headings). Only skimmed: the other ten companion files and the `.cjs` validators (checked for statuses and limits, not logic).

## 1. Purpose and triggers

- A defensive, source-first audit workflow: find vulnerabilities that cross a real trust boundary, then give owners source evidence, a safe reproduction, priority and the smallest fix ([S] intro).
- Skill description triggers on security questions, focused reviews, vulnerability research, audits and pen tests ([S] frontmatter).
- Two modes ([S] "Operating modes"):
  - **Guidance mode** (default): security questions or focused reviews. Uses only the relevant parts; no output directory, no six-phase run. If the request is ambiguous, ask one question first.
  - **Full audit mode**: only for an explicit audit or pen-test, a "full/comprehensive/end-to-end" review, or a request for report artifacts. Runs all six phases and writes files.
- It is the single-repo seed of Cloudflare's fleet-wide "vulnerability discovery harness" ([README] intro; [Blog] "It all starts with a skill").
- Install: `npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit` ([README] Installation). Trigger phrases like "security audit this codebase" ([README] Usage).

## 2. File structure

[README] "Files" table lists all 21 files:

| Group | Files | Role |
|---|---|---|
| Entry | `SKILL.md` (22 KB) | Modes, safety rules, setup, principles, workflow overview, anti-patterns |
| Phase prompts | `RECONNAISSANCE.md`, `HUNTING.md`, `VALIDATION-AND-REPORTING.md` | Copy-ready sub-agent prompts and the rules the parent applies per phase |
| Attack-class library | `ATTACK-CLASSES.md` plus 10 domain companions (`MEMORY-SAFETY-AND-BINARY`, `AI-AND-LLM`, `WEB-PROTOCOL-AND-AUTH`, `CLIENT-SIDE`, `SUPPLY-CHAIN-AND-RELEASE`, `CLOUD-AND-DEPLOYMENT`, `PROTOCOLS-RPC-AND-MESSAGING`, `RESOURCE-EXHAUSTION-AND-AVAILABILITY`, `DATA-ISOLATION-AND-LIFECYCLE`, `DESKTOP-MOBILE-AND-LOCAL-IPC`) | Selected per target type; [A] routes to a companion by target kind |
| Machine contracts | `report-schema.json`, `validate-findings.cjs`, `validate-coverage-ledger.cjs`, two `*.test.cjs` | Zero-dependency Node validators ([README] Requirements) |

Progressive disclosure: `SKILL.md` links companions; hunters get only the selected blocks pasted verbatim ([H] "Required hunter prompt" item 4), never block names alone.

## 3. Methodology: six phases

Order and gates ([S] "Full audit workflow"; [README] "What it does"):

1. **Reconnaissance** ([R]). The parent writes `run-metadata.json`, then launches parallel read-only `research` agents that return structured facts and write no files: 1a product/stack/local build, 1b principals and controls, 1c entry surfaces and sinks, 1d local-execution and deployment visibility (including whether the sandbox and artifact promotion are enforceable). Output: `architecture.md` and `coverage-ledger.json`.
2. **Coverage-led hunting waves** ([H]). `general` agents take planned ledger units; after each wave a fresh `research` "coverage critic" proposes missing units and reassignments.
3. **Candidate validation** ([V] Phase 3). Every unique candidate goes to a fresh verifier that did not hunt it and "tries to refute it".
4. **Structured output** ([V] Phase 4). `findings.json` validated against `report-schema.json` and the ledger validator.
5. **Independent record verification** ([V] Phase 5). A further fresh verifier per final `confirmed` and `needs_validation` record, run in parallel. Verdict is `verified` or `replace`; material replacements go to yet another fresh verifier.
6. **Target-neutral report** ([V] Phase 6): `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`, derived only from the final records.

Termination: exactly two allowed end states, either all artifacts written with both validators passing, or `run_status: "incomplete"` with an exact reason disclosed in the report ([S] "Full audit workflow"). Never stop mid-phase.

### Deterministic coverage ledger (the central idea)

- One unit per material combination of surface x boundary x subsystem x attack class (plus lifecycle in `deep`) ([R] "Deterministic coverage ledger").
- `coverage_id` is built from percent-encoded, NFC-normalised canonical source references joined by `::`; no wave, agent, verdict, severity or line number in the ID, so the same unit has the same ID across runs ([R]).
- Unit states seen in the validator: `planned`, `in_progress`, `covered`, `candidate`, `blocked`, `deferred`, `out_of_scope` ([R]; [H] result contract; `validate-coverage-ledger.cjs` `STATUSES`, not read in full). Prior-run status is tracked separately (`prior_confirmed_same_source`, `prior_needs_validation`, etc.) ([R]).
- Units the budget cannot reach are explicitly `deferred` with a reason; "no unit may be silently unassigned" ([H] "Phase 2").
- Priority order for assignment: unauthenticated surfaces first, most valuable resources, prior gaps and changed source, then historically productive classes; ties break lexicographically for determinism ([H]).
- The critic loop runs until a distinct final-clean critic accepts no work; "never use a silent wave or agent cap as evidence of complete coverage" ([H] "Coverage-critic waves").

### Multi-run behaviour

Prior `coverage-ledger.json` and `findings.json` are read first ([S] "Coverage and prior runs"). Rules worth noting:
- A prior `confirmed` record is carried only if its relevant source is unchanged (comparing source, not just the commit ref); it is excluded from hunters but still sent through current verification.
- Changed source creates a revalidation unit that is not excluded.
- A prior `rejected` record suppresses only the unchanged failed claim.
- Prior `quick` or scoped ledgers never imply "the rest is fine".
- [README] Design principles claim: a single run found about half of what repeated runs found. [Blog] says the same ("a single run finds only about half the bugs").

### Profiles and budget

- `quick` (one hunter wave, one critic, one verifier per candidate), `standard` (default), `deep` (per-lifecycle units, critic waves to clean pass, separate verifiers). "Profiles change breadth and redundancy, never the evidence bar" ([S] "Run profiles and scope").
- Scoped runs record everything else as `out_of_scope`, never `covered`, and must present as partial ([S]).
- Optional `budget` = maximum agent invocations. Critics and the verifier reserve (30% of balance if unsure) are reserved before hunters are assigned. If the reserve cannot be funded, launch nothing and record `incomplete` ([S] "Cost budget").

## 4. Findings: structure, severity, verification

### Three verdicts ([V] Phase 4; [README])

| Verdict | Meaning | Required fields | Forbidden |
|---|---|---|---|
| `confirmed` | Full source trace plus a bounded local observed result | `root_cause`, `intended_behavior`, ordered `trace` (entrypoint, propagation, sink), `evidence`, `conditions`, `execution` with `observed_result`, `remediation`, `severity`, `confidence` | blockers, validation plan |
| `needs_validation` | A specific source-grounded hypothesis blocked by an exact unresolved fact | `claimed_root_cause`, `trace`, `evidence`, non-empty `blockers`, `validation_plan.local` and/or `.deployment` | severity, execution, remediation |
| `rejected` | Disproved candidate, retained so future runs do not repeat it | `claimed_root_cause`, `trace`, `evidence`, `reason` | everything confirmed-only |

- `report-schema.json` uses `additionalProperties: false` ([V] Phase 4). Records carry a stable source-derived `fingerprint` (no line, wave, agent, severity or verdict) used for dedup and across runs ([H] "Core validation rules" item 6).
- "`needs_validation` is never a parking place for a speculative idea"; a candidate disproved by source must be `rejected`, not `needs_validation` ([V] Phase 3; [H] gate item 5).

### Candidate gate ([H] "Core validation rules")

1. Complete repo-relative trace plus the strongest visible control.
2. A `confirmed` needs a bounded local result, impact across a stated boundary, complete conditions, and no visible preventing layer.
3. Never upgrade a crash to code execution, ordinary work to shared availability, or a same-principal action to privilege gain.
4. Facts not visible in source or locally observable go to `needs_validation` with the exact blocker.
5. A missing best practice with no affected principal is hardening, not a finding.
6. Return an empty candidate array when nothing survives.

[S] "Require a boundary and result": name the lower-trust principal, accepted input, intended control, crossed boundary, affected resource and concrete result; self-impact and guessed deployment behaviour are excluded.

### Severity ([S] "Separate priority from certainty")

- Only `confirmed` records get severity; overall severity cannot exceed demonstrated impact.
- Five anchored levels: critical (unauthenticated code execution / full data-store / arbitrary account takeover), high (fully defeats an explicit control with real consequences), medium (real violation, limited blast radius), low, informational.
- The discriminator: "does the demonstrated result fully defeat an explicit control ... or only weaken it? If you cannot state the concrete damage, the severity is lower than it feels."
- Schema separates likelihood, impact and overall severity; `validate-findings.cjs` ranks severities (informational to critical) to enforce the ceiling ([V] Phase 5 item 5; validator header, partial read).

### False-positive handling

Layered, and mostly structural:
1. Candidate gate in the hunter prompt (above).
2. Fresh verifier (Phase 3) with an adversarial brief: "You did not write this candidate. Try to refute it" ([V] Candidate-verifier prompt). It re-reads every cited line, reconstructs the strongest preventing control, independently reproduces the minimum result, and may demote, promote or reject. It never sees another verifier's conclusion ([V] Phase 3).
3. A second fresh verifier on the final record (Phase 5), covering `needs_validation` as well, because "a misleading `needs_validation` handoff wastes owner time" ([V] Phase 5).
4. Material replacements (promotion to a stronger verdict, changed root cause, trace, result or severity) need a third independent verifier; if independence or budget is missing the record is dropped from `findings.json` and the run is marked incomplete ([V] Phase 5).
5. Malformed or prose-wrapped verifier output is discarded, not repaired, and re-run ([V] Phase 3, Phase 5).
6. `rejected` records persist across runs to stop re-reporting ([V] Phase 4).
7. Anti-pattern list: checklist deviations as vulnerabilities, defense-in-depth with no reachable violation, severity on `needs_validation`, report written before verification, prose and JSON disagreeing ([S] "Anti-patterns").
8. Principle: "Defense-in-depth gaps are not vulnerabilities. If Layer A prevents the attack, the absence of Layer B is a hardening note" ([README] Design principles).
9. Validators prove format and ledger consistency only ("Validator success proves format and ledger consistency only", [V] Phase 4); the blog adds that findings are checked mechanically for line numbers and functions, not correctness ([Blog] "It all starts with a skill" table).

## 5. Subagents and parallelism

- Roles: **parent** (orchestrator, sole writer of shared files), `research` agents (read-only, factual: recon, critics, Phase 5 verifiers), `general` agents (hunters, Phase 3 verifiers; bounded local execution) ([S] "Platform terminology").
- Write isolation: every hunter/verifier gets `agents/<id>/scratch/` (writable) and parent-owned `artifacts/`; agent IDs are lowercase and exclude Windows device names. Only the parent edits `findings.json`, `coverage-ledger.json`, `architecture.md`, reports ([S] "Write isolation").
- Parallelism: recon agents in parallel ([R]), hunters per ledger unit within a wave, Phase 5 verifiers in parallel ([V]). Waves are sequential with a critic between each.
- Independence rules: the verifier is never the hunter; Phase 5 and replacement verifiers are different from earlier ones; `deep` keeps validation and record verification as separate agents ([S]; [V]).
- Fresh owner on reassignment: the previous attempt is archived into `attempts`, the live unit starts empty, and the new hunter must not inherit the old checks ([H]).
- Hunters return exactly one JSON object with per-unit `disposition` (`covered|candidate|blocked`), `checks` (invariant, method `source|local`, result, artifact), `candidates`, `hardening`, `uncovered` ([H] "Structured hunter result").
- Blog rationale for going beyond subagents: agents hold one hypothesis, fill context after a sliver of the repo, and lose information on compaction; the fix is "externalizing the state entirely, treating the LLM as a stateless compute engine" ([Blog] "Two objections", "It all starts with a skill"). The skill's files (ledger, findings, metadata) are that externalised state, in embryonic form.
- Blog also recommends using different models for discovery and validation ([Blog] intro). The skill itself is "agent-neutral" and sets no model ([S] "Platform terminology").

## 6. Output format

Files in `~/security-audit-skill/<repo>/run-<N>` by default, outside the target; inside the target only if version control ignores the whole directory ([S] "Full audit setup"):
`run-metadata.json`, `architecture.md`, `coverage-ledger.json`, `findings.json`, `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`, `agents/<id>/...`.

`REPORT.md` ([V] Phase 6): run profile/scope/budget/source ref and partial-coverage disclosure first; one-paragraph posture; confirmed table; per-finding detail; separate `NEEDS VALIDATION` table (no severity); hardening and positive patterns; ledger coverage counts and the final critic result. "A clean run may have zero confirmed records ... without inventing LOW findings." Reports must be target-neutral: native interface per target (function call, fixture, CLI, IPC, rendered policy), no live probes.

Blog adds that every surfaced bug at Cloudflare came "attached to a working test case ... and a draft patch" ([Blog] "How we're handling all of this patching"). The skill's equivalent is `execution` plus `remediation` with `code_changes` in confirmed records ([V]).

## 7. Scripts and tools relied on

- Node.js only, zero dependencies: `validate-findings.cjs` (schema interpreter plus semantic checks; caps 5 MiB input, 1,000 findings, 64 nesting levels, 100 error messages) and `validate-coverage-ledger.cjs` (run after every ledger update) ([V] Phase 4; [README]).
- Both validators ship with test files ([README] Files).
- External requirement: an OS-enforced sandbox for any target-controlled execution (no external network, empty allowlisted env, read-only target and toolchain, scratch-only writes, CPU/memory/process/file/disk/wall-clock limits). Without it the skill does not run target code and reports the gap as a `needs_validation` blocker ([S] "Universal execution safety"; [README] Requirements).
- The skill supplies no sandbox implementation; the blog says Cloudflare's is built on `unshare`, and warns that inside Docker it needs `seccomp=unconfined` and `apparmor=unconfined` or it fails silently ([Blog] "Dynamic threat modeling").
- A parent-side "artifact promotion procedure" (no-follow descriptor traversal, regular-file checks, size bounds, exclusive create) copied verbatim into hunter and verifier prompts ([S]; [H]; [V]). Agents never perform it.

## 8. Prompt-engineering techniques worth noting

1. **Verbatim paste, never by reference.** Hunters get `architecture.md` plus the exact selected attack-class blocks and the schema branches copied in; "Do not send block or companion names alone" ([H] item 4, 9).
2. **Fixed prompt skeleton**, nine parts in a stated order ([H] "Required hunter prompt").
3. **Invariant-first hunting**: a six-step "concrete invariant" template (principal, accepted value, control, post-decision path, smallest effect, fix) ([H] "Core hunting method").
4. **Depth bound with escape hatch**: stop an investigation once the invariant is settled; record it as covered/candidate/blocked or push a new boundary to `uncovered` instead of chasing it ([H]).
5. **Adversarial verifier framing** ("You did not write this candidate. Try to refute it") plus information hiding (no other verifier's conclusion) ([V]).
6. **Exactly-one-JSON output** with no prose, parsed and rejected rather than repaired ([H]; [V]).
7. **Negative guidance as numbered anti-patterns** and per-domain "Core discipline" blocks, e.g. "Prompt injection alone is not a finding"; "A guardrail prompt is not a security boundary" ([S]; [AI] Core discipline).
8. **Honest unknowns as a first-class state**: an exact blocker plus a safe resolution plan, with no severity ([V]).
9. **No anchoring on prior findings**: carried records go to the hunter as exclusions limited to fingerprint, title and root cause, and are not used as exemplars ([S] anti-pattern 8; [H] item 8).
10. **Calibration anchors** for severity and a one-sentence discriminator ([S]).
11. **Variant hunting**: on a high/critical candidate, search only owned units for lexical, structural and logical variants, consolidate by root cause but establish each variant's impact independently ([H]).
12. **Disagreement testing**: compare canonicalisation and units at every parser/policy handoff ([H]).

## 9. Limitations

Stated by the sources:
- Single run covers about half of what repeated runs find, and skews to simpler bugs ([README]; [Blog]).
- Validators check shape, not truth ([V] Phase 4; [Blog] table).
- Anything outside the repo (proxy, IAM, headers, deployment) cannot be confirmed; it stays `needs_validation` ([S] "Respect source visibility").
- Needs a sandbox the user must provide; without it, no dynamic evidence ([README] Requirements).
- Skill state is files plus one orchestrating context; the blog says this breaks down at scale (persistence after a crash, dedup at O(N^2), cross-repo reasoning) and motivates the fleet harness ([Blog] "It all starts with a skill", "Deduping").
- Blog numbers are called out of date and the findings come from a ring-fenced experiment ([Blog] "How we're handling all of this patching").

My observations [J]:
- Very heavy: 22 KB `SKILL.md` plus 40+ KB of phase prompts, with a long prompt-copy protocol; one run spends many agents (budget feature exists for that reason).
- The strict "no live testing" stance trades recall for safety and leans on `needs_validation`.
- No claim in the sources of measured false-positive rate; I found none.

## 10. Ideas applicable to muffy

Grounding: muffy's `code-reviewer` already says "a blocker must be provable" and returns a `handoff.schema.json` JSON with stable blocker IDs per round (`agents/code-reviewer.md`, its principles link). It has `skills/muffy/schemas/`, validator scripts under `skills/muffy/scripts/`, a review bench under `evals/review-bench/`, and a fix lane (`skills/muffy/references/fix-profile.md`). README states work moves "as files in `.team/<task>/` plus a validated JSON hand-off" (`README.md`). Items below are suggestions [J]; none is verified against muffy's code beyond what is cited.

1. **Third verdict for reviewers: "needs-validation" distinct from Reject/Approve.** Blocker that depends on a fact the reviewer cannot see (runtime config, prod data) is recorded with the exact missing fact and a safe check, with no blocking power. Mirrors confirmed/needs_validation/rejected ([V] Phase 4). Pairs with the existing "provable blocker" rule.
2. **Reject-ledger across rounds.** Keep `rejected` claims with a stable fingerprint so a later round or a re-review does not re-raise a refuted blocker unless evidence changed ([V] Phase 4; [S] coverage rules). Muffy already has stable `B-n` IDs; a root-cause fingerprint would survive renumbering.
3. **Adversarial second-opinion verifier for blockers.** For a Reject, spawn a fresh agent told "try to refute this blocker", given only the blocker and its cited paths, not the reviewer's conclusion ([V] candidate-verifier prompt). Could be limited to the `deep`/high-severity cases because of cost. Measure with `evals/review-bench` miss-rate and false-positive rate.
4. **Severity ceiling rule.** Add the discriminator "fully defeats a control vs only weakens it; if you cannot name the concrete damage, it is lower" and "severity cannot exceed demonstrated impact" to reviewer principles ([S]).
5. **Coverage critic for the review lane.** After reviewer passes, a read-only critic checks "unmapped entry points, unchecked parallel paths, units closed without paths/checks" ([H] critic list) against the changed-files list. Cheap analogue of the ledger: a per-diff checklist of changed surfaces, each marked covered/blocked/deferred with reviewed paths, and a rule that nothing is silently skipped ([H] Phase 2).
6. **Deferred-with-reason instead of silent caps.** When muffy's budget or turn cap stops work (see `references/budget.md`, `loops.md`), record untouched items as `deferred` plus reason, and make the final message state partial coverage ([H]; [S] "Cost budget"). Fits the existing "stop after three fix loops" behaviour.
7. **Quick/standard/deep dial that scales breadth, not the evidence bar** ([S] "Run profiles"). Muffy's fix/lite/full routes could share one rule: lanes change redundancy, never the gate for "provable".
8. **Invariant-first template for the fix lane's diagnose loop**: principal/input, expected control, trace after the decision, smallest observable effect, minimal fix plus regression test ([H] "Core hunting method"). The depth-bound rule (stop once settled; log and move on) maps to the existing 80-tool-call turn budget.
9. **Block-level, verbatim prompt composition.** When the Orchestrator spawns reviewer or QA, paste the selected checklist blocks and the output schema branch into the prompt rather than naming them ([H] item 4). Muffy already ships a `prompt-envelope.schema.json`; check whether it enforces this.
10. **Strict machine contracts plus "no prose, discard and re-run".** Muffy's `validate-handoff.mjs` already returns fix instructions to the agent; consider the Cloudflare rule of re-running with a fresh agent rather than repairing an invalid block when it matters for review integrity ([V] Phase 3). `additionalProperties: false` on the findings schema is also worth copying.
11. **Sole-writer rule.** Already muffy's `check-ownership.mjs` direction; Cloudflare's parent-only-writes-shared-files plus per-agent scratch is the same idea made explicit ([S] "Write isolation").
12. **Anti-pattern list in the reviewer prompt**: checklist deviations as defects, defense-in-depth with no reachable failure, severity on unconfirmed items, report before verification, prose and JSON disagreeing ([S] "Anti-patterns").
13. **Hardening notes separated from blockers**, plus "positive patterns observed" and a rule that a clean review is allowed to have zero findings ([V] Phase 6). Reduces invented low-severity noise.
14. **A dedicated security lane or skill.** If muffy wants security review, a guidance-vs-full-audit split ([S] "Operating modes") fits: trigger the cheap mode by default and require an explicit request for the expensive one. Reusing their `AI-AND-LLM.md` core discipline ("prompt injection alone is not a finding") is relevant because muffy is itself an agent system.
15. **Different model for validation than for discovery** ([Blog] intro). Muffy could set the verifier's model to differ from the reviewer's, and bench it.

Not worth copying [J]: the descriptor-level artifact promotion procedure, the percent-encoded coverage IDs, and the budget-reservation arithmetic. They address hostile target code and multi-wave fleets that muffy's single-feature flow does not have.
