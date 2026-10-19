## Quality Checks

Before handing off, verify that:

- Every state in design.md is implemented and matches the canvas
- API calls match the contract; mocks live only in test files, never in runtime code
- Code follows `coding-practices.md` and the matching stack file; an unknown stack is stated in the report, and no library was added because of those files
- Lint, type check and tests were actually run and the reported results are real
- No file created or changed is over ~300 lines (tests ~500), checked with `wc -l`; larger ones were split by responsibility
- Only FE-owned files were touched
- PR diagram: not requested or skipped under the size rule (nothing to check), or validated and rendered covering every changed file (a tooling failure goes in `quality_checks.failed`)
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
