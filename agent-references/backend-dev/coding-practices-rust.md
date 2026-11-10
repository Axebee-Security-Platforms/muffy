## Coding Practices: Rust

Adds to [coding-practices.md](coding-practices.md); same precedence rules. Libraries named below apply only if already in the project's dependencies; never add one because of this file.

- Module layout (the small-files rule in `rules-and-guardrails.md` applies): `main.rs`/`lib.rs` hold only `mod` declarations, wiring and startup; use a directory module (`foo/mod.rs` or `foo.rs` + `foo/`) once a module has several files and re-export the public API with `pub use`; move a `#[cfg(test)] mod tests` past ~100 lines to `tests.rs` or `tests/`
- Code passes `cargo fmt` and `cargo clippy -- -D warnings` with no new `#[allow]` unless you explain it in a comment
- No `unwrap()`/`expect()` in request paths or library code; return `Result` and propagate with `?`. `expect` is acceptable only for startup invariants with a message that says why it can't fail
- Library/domain errors use a typed enum (`thiserror`); the top-level binary and handlers may use `anyhow`; map domain errors to the contract's status codes in one place
- Take `&str`/`&[T]` in parameters and own (`String`/`Vec<T>`) in structs; don't `.clone()` to quiet the borrow checker without checking if a borrow or `Arc` is right
- In async code never block the runtime: no `std::thread::sleep` or blocking I/O in an `async fn`; use `spawn_blocking` for CPU or blocking work, and never hold a `std::sync::Mutex` guard across an `.await`
- Use the project's framework (axum/actix) with typed extractors for validation at the boundary and `tracing` for structured logs; build `sqlx` queries with bound parameters (compile-time checked where the project uses it)
- Keep `unsafe` out unless the task needs it; if used, isolate it in one small function with a `// SAFETY:` comment stating the invariant
- Tests: `#[cfg(test)]` unit tests next to the code, `tests/` for integration; name tests for behavior; real DB via test container for query logic
