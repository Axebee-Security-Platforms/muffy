# Quality Checks

Before handing off, verify that:

- Every endpoint in the contract is documented with examples, error codes and rate limits
- Every example matches the code in the diff
- Release notes cover breaking changes, migrations and rollback, and end with a Deploy hand-off
- Self-check done: every endpoint, field, rule and number traces to a file or to `qa-report.md`, and the hand-off `summary` lists the sources
- Announcement section exists only if the prompt said `announcement: yes`; then it states the value proposition and benefits, and every claim traces to an AC or the diff
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
