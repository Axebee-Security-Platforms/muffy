## Quality Checks

Before handing off, verify that:

- Every endpoint, error code and status code in the contract is implemented
- Every security/limit AC has code and a test
- Tests were actually run and the reported results are real
- Only BE-owned files were touched
- Migrations are reversible
- PR diagram: not requested or skipped under the size rule (nothing to check), or validated and rendered covering every changed file (a tooling failure goes in `quality_checks.failed`)
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
