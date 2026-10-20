# Test levels

Which tests run for which kind of change. The Orchestrator copies the row into the `Read:`/`Goal:` of the qa-tester prompt; qa-tester follows the row and never widens it. Test scope is always **selected by path, name or filter**, never "the whole suite".

| Level | Typical change | Who writes | Who runs | Tests |
|---|---|---|---|---|
| **L0 cosmetic** | Copy, spacing, colour from existing tokens; no logic | nobody | `qa-tester` (fix lane) | Build + lint, and the visual check in `fix.md`. No test files. The AC is marked `manual` when it has no automated check |
| **L1 bug fix, local logic** | Fix lane, the cause sits in one function or component | the dev, at step 4 | `qa-tester` (fix lane) | **One regression test** that fails before the fix and passes after (unit level), plus the existing unit tests of the touched files. Nothing else |
| **L2 bug fix across a boundary** | The fix crosses an API, DB or module boundary, still within the fix lane | the dev (unit) and `qa-tester` (integration, only for the crossed boundary) | `qa-tester` | L1 + one integration test of that boundary, by path. E2e only if the bug is only visible end to end |
| **L3 feature** | Full flow, new or changed AC | the dev (unit), `qa-tester` (integration and e2e for gaps in the coverage table) | `qa-tester` | Every AC covered once at the lowest level that asserts it: unit (dev), integration per endpoint, e2e per user flow in the AC. Scope = this task's files and AC. Fix rounds retest only the AC with blockers |
| **L4 whole-system regression** | Release, or a change with wide blast radius | existing suites | `qa-tester`, only after approval | The repo's full unit + integration + e2e. Needs `pause:full-regression` ([run-profile.md](run-profile.md#named-pauses)); never part of L0–L3 |

## Enforcement

The Orchestrator writes the picked level to `.team/<task>/test-level` (for example `L1`) before it spawns `qa-tester`, and rewrites it when the level changes. `guard-test-level.mjs` then blocks, for `qa-tester` only, a test run or a new test file above the ceiling: L0 any test run or test file, L1 any integration or e2e run or new e2e/integration suite. L2–L3 scoping and L4 approval are enforced by `guard-full-regression.mjs`. See [hooks-enforcement.md](hooks-enforcement.md) §10–11. Without the hooks the table is a rule agents follow, not one that is checked.

## Picking the level

The Orchestrator picks it, in this order, and records it in `checkpoint.md` `## Run profile`:

1. Fix lane and no behaviour change → **L0**. Fix lane with a logic fix in one function or component → **L1**. The fix reaches across an API, DB or module boundary → **L2**
2. Full flow → **L3**. Lite lane ([lite-profile.md](lite-profile.md)): refactor, perf and db → **L2**, internal-api with new AC → **L3**
3. Offer **L4** at `pause:full-regression` (the user decides, default no) only when one of these holds: the contract changes auth, payments, a migration, a runtime or a dependency; a shared module used by many features changed; a release the user calls out as high risk; the user asks for it. Say which trigger fired in the question
4. Unsure between two levels → the lower one; a hand-off blocker can ask for more, and the Orchestrator decides

Rules that apply at every level:
- A test that already asserts the behaviour is cited, not rewritten (no duplicate tests)
- A level is a ceiling for `qa-tester`. It may report a gap or recommend a higher level in `qa-report.md`, but it runs only its own level
- Cosmetic and L1 work never adds a new suite, a new e2e spec or a new test file outside the touched module
