## Fix Profile

Read this only when the prompt has `Profile: fix`. The spec is `.team/<task>/fix.md`; there is no `ac.md` or `design.md`.

- Test scope: the `fix.md` AC, the regression test, and the existing tests of the touched files. Run the regression test on the base commit to confirm it fails there, then on the fix branch to confirm it passes
- Run the existing unit and e2e suites the repo already has; add no new suites
- Cosmetic AC with no automated check: run build and lint, then mark the AC `manual` in `qa-report.md` with the exact route, viewport and what to look at. Never report a `manual` AC as passed
- `qa-report.md` stays short: one row per AC (`pass`, `fail` or `manual`), the commands run, test counts. Verdict `Pass` only if no AC is `fail`
