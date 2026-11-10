## Quality Checks

Before handing off, verify that:

- Every endpoint, error code and status code in the contract is implemented
- Every security/limit AC has code and a test
- Tests were actually run and the reported results are real
- No file created or changed is over ~400 lines (tests ~600), checked with `wc -l`; larger ones were split by responsibility
- Only BE-owned files were touched
- Migrations are reversible
- Code follows `coding-practices.md` and the matching stack file; an unknown stack is stated in the report, and no library was added because of those files
- PR diagram: not requested or skipped under the size rule (nothing to check), or validated and rendered covering every changed file (a tooling failure goes in `quality_checks.failed`)
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
