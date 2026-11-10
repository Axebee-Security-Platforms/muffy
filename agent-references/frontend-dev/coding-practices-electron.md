## Coding Practices: Electron

Read after [coding-practices.md](coding-practices.md) when `package.json` has `electron`. Also read the stack file of the UI framework the renderer uses (React, Vue, ...). Version-specific APIs (IPC, packaging tool, auto-update): follow the surrounding code and the lockfile, never memory.

### Process boundaries (security first)
- Keep the renderer unprivileged: `contextIsolation` on, `nodeIntegration` off, a sandboxed renderer, and a strict content security policy. Never relax them to make something work; ask the Orchestrator for an architect decision
- The renderer reaches the OS only through a small, typed API exposed by the preload script. Each IPC channel has one name, one payload schema and validation in the main process; the main process never trusts renderer input (paths, URLs, commands)
- Load only local content or origins the contract lists; open external links in the system browser. No `eval`, no remote code, no `shell.openExternal` on unchecked input

### Structure
- Main process: windows, menus, tray, file system, updates. Renderer: the UI only. Business logic that both sides need goes in a plain shared module with no Electron import, so it tests without Electron
- Long work (file scans, parsing) goes to a worker or utility process, never blocking the main process's event loop
- State a user would expect to keep (window size, settings) is persisted in the app data directory, with a safe default when the file is missing or corrupt

### Platform behaviour
- Windows, Mac and Linux differ: menus (the macOS app menu), quit-on-last-window-close, keyboard shortcuts (`CmdOrCtrl`), paths (`path.join`, never string concat) and file locking. Handle only the platforms the contract lists
- Signing, notarization, installer build and auto-update feeds are configured only when the contract says so (smoke trigger) and never run by an agent; see [platforms.md](../../skills/muffy/references/platforms.md#human-only-actions)

### Design tokens and accessibility
- The renderer follows the web rules in [coding-practices.md](coding-practices.md) (semantic elements, `docs/design-system/tokens.css`). Add native-feel details only if the design asks: window controls, drag regions, system theme

### Tests
- Unit tests for shared logic and the main-process handlers with the Electron API faked at the edge; renderer tests per the UI framework's stack file. End-to-end runs launch the real app (Playwright's Electron launcher) and cover only AC flows a unit test cannot reach
