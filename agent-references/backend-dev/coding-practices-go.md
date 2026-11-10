## Coding Practices: Go

Adds to [coding-practices.md](coding-practices.md); same precedence rules. Libraries named below apply only if already in the project's dependencies; never add one because of this file.

- Follow `gofmt`/`goimports` and the project's `golangci-lint` config; package names are short, lowercase, no underscores; don't create `util`/`common` packages
- Accept interfaces, return structs; define an interface in the package that uses it and only when there are two implementations or a test needs a fake
- Pass `context.Context` as the first parameter through every call that does I/O; honor cancellation and set timeouts on outbound HTTP and DB calls
- Return errors, don't panic; wrap with `fmt.Errorf("doing x: %w", err)`, compare with `errors.Is`/`errors.As`, and handle each error once (log or return, not both)
- Every goroutine has an owner and a way to stop (context, `errgroup`, closed channel); never start one you can't wait for; protect shared state with a mutex or a channel, and run tests with `-race`
- Keep `main` thin: load config from env, build dependencies, start the server with graceful shutdown on SIGTERM
- Use `database/sql` with `sqlc`/`pgx` or the project's choice and parameterized queries; always `defer rows.Close()` and check `rows.Err()`
- Tests: table-driven with `t.Run` names that describe behavior; `httptest` for handlers; real DB via test container for query logic
