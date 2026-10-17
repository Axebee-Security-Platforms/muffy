# Quality Checks

Before handing off, verify that:

- `contract.md` is an index (≤ 60 lines): every section is a one-line summary with a link to its part file, and every link resolves
- Every AC has a home in the contract
- Every endpoint has method, request/response schema, error codes and status codes
- Runtime + version in Stack match `deploy.md`
- The `## Cost` line in `contract.md` starts with `Budget: none | within | over | unknown | unlimited`, and `over` or `unknown` names a cheaper option on that same line
- `contract.md` has a Cost section: `Budget: none. No new recurring cost`, or a range and basis per figure compared with the budget in `docs/strategy.md` (or noted as none given); every new recurring cost and build/buy choice is reported in `contract/cost.md` / `contract/stack.md` for the product-manager to record (you do not write `docs/strategy.md`), and its infrastructure figure matches `deploy.md` `## Infra cost`
- Any buy choice with a recurring cost, personal-data processing or lock-in either follows an answer in `requirements.md`, is an open `questions[]` entry, or is the repo's existing provider; each option has cost basis, lock-in and `[verify]`/`[assumed]` marks, every looked-up fact carries `<url> · checked <date>`, and no more than 6 fetches were used
- Every file that FE/BE/devops will touch has exactly one owner
- Onboard mode: `overview.html` exists only if the repo had no diagram, matches `baseline.md`, and marks unconfirmed parts `verify: true`
- Diagrams: none drawn with `diagrams: none needed (<reason>)` in the brain note, or each one drawn matches a trigger in `diagrams.md`, shows nothing the contract lacks, passes `check-diagram.mjs`, and is linked from `contract.md`
- Each ADR you wrote is a new file with `Kind: technical`, supersedes only technical ADRs, and any conflict with a product ADR was reported, not overridden
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
