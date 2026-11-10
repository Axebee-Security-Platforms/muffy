# Quality Checks

Before handing off, verify that:

- `contract.md` is an index (≤ 60 lines): every section is a one-line summary with a link to its part file, and every link resolves
- Every AC has a home in the contract
- Every endpoint has method, request/response schema, error codes and status codes
- Runtime + version in Stack match `deploy.md`
- Any buy choice with a recurring cost, personal-data processing or lock-in either follows an answer in `requirements.md`, is an open `questions[]` entry, or is the repo's existing provider; each option has cost basis, lock-in and `[verify]`/`[assumed]` marks, every looked-up fact carries `<url> · checked <date>`, and no more than 6 fetches were used
- Every file that FE/BE/devops will touch has exactly one owner
- Onboard mode: an `overview.html` spec exists only if the repo had no drawn architecture diagram (an ASCII tree, a prose ARCHITECTURE.md or a PDF does not count as one), matches `baseline.md`, and marks unconfirmed parts `verify: true`
- Diagrams: none spec'd with `diagrams: none needed (<reason>)` in the brain note, or each `diagrams_spec` entry matches a trigger in `diagrams.md`, shows nothing the contract lacks, and is linked from `contract.md`. You never run `check-diagram.mjs` yourself — `diagrammer` draws and checks it
- Each ADR you wrote is a new file with `Kind: technical`, supersedes only technical ADRs, and any conflict with a product ADR was reported, not overridden
- The `<brain>` note is written
- The final message ends with a valid JSON hand-off block
