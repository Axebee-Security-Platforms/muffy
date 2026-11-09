## Coding Practices

Language-neutral core. Also read the one stack file that matches the codebase:
- `go.mod` → [coding-practices-go.md](coding-practices-go.md)
- `Cargo.toml` → [coding-practices-rust.md](coding-practices-rust.md)
- `package.json` with `typescript` or a Node server framework (express, fastify, nestjs, hono) → [coding-practices-typescript.md](coding-practices-typescript.md)
- `Platform: cli` on the contract's Stack line (command-line tool, console app, screenless daemon) → [coding-practices-cli.md](coding-practices-cli.md), in addition to the language's file above
- anything else (unknown language or framework), in this order, stop at the first step that gives enough to code correctly:
  1. `docs/stacks/<framework>.md` exists → run `node "<muffy>/scripts/check-stack-notes.mjs" <framework>`: `fresh` or `unchecked` → read it and treat it as the stack file; `stale` → treat it as missing (step 3, problem `stack-unknown: <framework> <version> (note is for <old>)`). The whole ladder is in [stack-ladder.md](../shared/stack-ladder.md)
  2. Learn from local sources only, no web access: the version in the lockfile or manifest, vendored/installed package docs and types, existing code, `docs/architecture/baseline.md`. If the repo already has working examples of the idioms you need, follow them and say which stack you assumed
  3. Still unsure of idioms that change correctness (error handling, concurrency, data access, auth middleware) → don't guess: return `status: blocked` with a blocker `owner: Researcher`, problem `stack-unknown: <framework> <version>`, and stop. The Orchestrator gets a capped stack note written, then resumes you

Order of precedence: the surrounding code's conventions, then `contract.md`, then this file. Apply a practice only when the task touches that area; none of these justify extra layers or abstractions the AC doesn't need.

### File size
- Hard cap: no source file you write or edit passes ~400 lines (tests ~600); past ~300 lines, stop adding and split first. Never write one file that holds a whole feature
- Split by responsibility, not by line count: one module per concern (routes/handlers, business rules, data access, types/DTOs, errors, config). Tests live in their own file(s), per feature
- Write the split layout before coding (list the files and what each owns), create the files up front, and keep each focused. Do not dump everything into one file "to split later"
- A file you edit that is already over the cap: don't grow it. Extract the part you touch into a new module, or the split goes in the same change
- Before hand-off run `wc -l` on every file you created or changed; any over the cap is fixed, not reported

### API
- Validate every request at the boundary (schema, types, ranges) and reject bad input with the contract's error shape and status code; never trust data past the boundary unchecked
- Use the status codes and error shape from `contract.md`; one error shape across all endpoints, no stack traces or internal ids in responses
- Any list endpoint is paginated with a capped page size; a write that clients may retry (payments, creates triggered by webhooks) is idempotent

### Structure
- Route/controller only parses, calls and responds; business rules live in a plain function that can be tested without HTTP. Split a data-access layer only when queries repeat or the logic needs a DB-free test
- Dependencies (DB, clock, external clients) are passed in or injected, not imported as globals inside business logic, so tests can swap them
- One transaction per business operation; no network calls to third parties inside an open transaction

### Data
- Query only the columns and rows needed; load related rows in one query or a join, not in a loop (N+1 is a bug)
- For a table expected to grow, index the columns the new queries filter or join on, in the same migration, after checking the query plan (`EXPLAIN`); don't index speculatively
- Money as integer minor units or decimal, never float; timestamps in UTC

### Errors and logging
- Catch an error only where you can handle it or add context; otherwise let it propagate to the one top-level handler
- Log structured events (`{event, id, ...}`) at the boundary and on failure; never log secrets, tokens or full personal data
- Do not swallow an error to return a default; a failed dependency returns a failure, not made-up data

### Tests
- Test behavior through the public function or endpoint: the happy path, each AC error case, and each auth/permission boundary
- A test names the behaviour (`rejects an expired reset token`), not the function; it must still pass after a refactor that keeps behaviour, and fail when the behaviour breaks
- Never assert on private helpers, call order or internal state; if something is only testable by reaching inside, move the seam (pass the dependency in) instead
- Use a real DB (test container or the project's test DB) for query and migration logic; mock only what you don't own (third-party APIs, clock, email), never your own modules
