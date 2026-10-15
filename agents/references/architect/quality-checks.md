# Quality Checks

Before handing off, verify that:

- Every AC has a home in the contract
- Every endpoint has method, request/response schema, error codes and status codes
- Runtime + version in Stack match `deploy.md`
- `contract.md` has a Cost section: `No new recurring cost`, or a range and basis per figure compared with the budget in `docs/strategy.md` (or noted as none given); new recurring costs and build/buy choices are appended to `docs/strategy.md`
- Every file that FE/BE/devops will touch has exactly one owner
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
