## Fix Profile

Read this only when the prompt has `Profile: fix`. The spec is `.team/<task>/fix.md`; there is no `ac.md` or `design.md`.

- Test scope follows the `Test level:` line in the prompt ([test-levels.md](../../skills/muffy/references/test-levels.md)) and never goes above it. L0: build + lint only, no test run. L1: the regression test + the existing unit tests of the touched files. L2: L1 + one integration test of the crossed boundary, and an e2e spec only when the bug is visible only end to end. Run the regression test on the base commit to confirm it fails there, then on the fix branch to confirm it passes
- "Regression test" here means the one test that fails before the fix and passes after, not a suite run. Select every test by path or name. Never run the whole unit or e2e suite in the fix lane, and add no new suites
- Cosmetic AC with no automated check (L0): run build and lint only, then mark the AC `manual` in `qa-report.md` with the exact route, viewport and what to look at. Never report a `manual` AC as passed
- `qa-report.md` stays short: one row per AC (`pass`, `fail` or `manual`), the commands run, test counts. Verdict `Pass` only if no AC is `fail`
