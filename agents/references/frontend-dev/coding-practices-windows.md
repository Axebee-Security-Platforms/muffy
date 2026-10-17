## Coding Practices: Windows app (.NET)

Read after [coding-practices.md](coding-practices.md) when the codebase has a `*.csproj` or `*.sln` using WinUI, WPF, WinForms or .NET MAUI. A Mac app is [coding-practices-swift.md](coding-practices-swift.md). Version-specific APIs (Windows App SDK, MAUI handlers, MVVM library): follow the surrounding code and the project's target framework, never memory.

### Structure
- Use the UI framework and MVVM approach the project already uses; a view binds to a view model and holds no business logic. Code-behind only for pure view concerns (focus, animation hooks)
- View models and domain code are plain .NET with no UI types, so they test without a window. Services (file system, network, settings, dialogs) sit behind interfaces and are injected
- Enable nullable reference types if the project does; no `!` to silence the compiler, no `async void` outside event handlers, no `.Result` / `.Wait()` on the UI thread

### Threading and lifecycle
- UI updates happen on the UI thread (dispatcher); I/O is async and cancellable. Unsubscribe events and dispose `IDisposable`s when a view closes to avoid leaks
- Handle file in use, access denied, long paths, missing network and sleep/resume as normal states with a visible result

### Design tokens and platform feel
- Colours, spacing and typography come from shared theme resources (`ResourceDictionary`) mapped from `docs/design-system`; no raw hex or pixel literals in views. Support light/dark/high-contrast themes, DPI scaling and the window sizes in the design
- Keyboard-first: full tab order, access keys and shortcuts for the actions the AC names

### Security and release
- Secrets in the Credential Locker / DPAPI or the project's secret store, never in config files. Package manifest capabilities, installer type, signing certificates and update channel change only when the contract says so (smoke trigger). You never sign or publish to the Store; see [platforms.md](../../../skills/muffy/references/platforms.md#human-only-actions)

### Accessibility
- `AutomationProperties` (name, help text) on interactive and image elements, logical focus order, contrast per the design, UI that survives text scaling

### Tests
- `dotnet test` with the project's framework on view models and domain logic with fakes you own. UI Automation tests only for AC flows a unit test cannot reach, run on a Windows host with a desktop session
