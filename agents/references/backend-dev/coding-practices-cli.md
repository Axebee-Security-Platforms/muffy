## Coding Practices: CLI and console apps

Read after [coding-practices.md](coding-practices.md) when the task is a command-line tool, console app or screenless daemon (`Platform: cli`), in any language. Also read the language's stack file if one exists. The contract's `contract/cli.md` is the spec ([platforms.md](../../../skills/muffy/references/platforms.md#cli-surface-the-contract-of-a-cli)). The API-over-HTTP rules in coding-practices.md apply only if the tool also serves HTTP.

### Interface
- Implement exactly the commands, flags, defaults and exit codes in `contract/cli.md`; use the project's argument parser, not hand-rolled parsing. Unknown flag or bad value → a one-line error naming it, usage hint, non-zero exit
- stdout carries the result only (so it can be piped); progress, logs and errors go to stderr. A `--json` (or the contract's) mode prints machine-readable output with a stable shape and nothing else on stdout
- Exit 0 on success, a distinct documented non-zero code per failure class; never exit 0 after an error. `--help` and `--version` work without side effects or config
- Detect a non-interactive terminal (no TTY): no prompts, spinners or colour; honour `NO_COLOR`. Prompt only when the contract says so, and always offer a flag to skip it

### Structure
- `main` parses, calls and maps the result to an exit code; commands are plain functions that take their inputs (args, reader, writer, clock, environment) as parameters, so tests need no subprocess for logic
- Read configuration in one order: flags, then environment, then config file, then defaults, as the contract states. Config and cache live in the OS-standard directories, not the working directory
- File and path code is cross-platform for the OSes the contract lists: no hard-coded separators, no assumption about the shell, line endings or home directory

### Safety and errors
- A command that deletes, overwrites or sends data supports a dry run or a confirmation unless the contract says otherwise; never follow a path or URL from input without validating it; never put secrets in argv (visible in process lists), logs or error messages; read them from stdin, a file or the environment
- Handle SIGINT/SIGTERM: stop cleanly, remove partial output, exit non-zero. Handle a closed pipe (`| head`) without a stack trace
- Error text says what failed and what to do next, with no stack trace unless a `--verbose` flag asks for it

### Tests
- Unit-test command functions with injected readers, writers and environment. Add a few spawn tests that run the built binary and assert stdout, stderr and the exit code for the AC paths (success, bad input, missing file, no TTY). Use a temp directory and never the repo's files
