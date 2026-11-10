## Coding Practices: Kotlin (Android)

Read after [coding-practices.md](coding-practices.md) when the codebase has `build.gradle` / `build.gradle.kts` with an Android plugin. Version-specific APIs (Compose and Material versions, navigation, DI library): follow the surrounding code and the version catalog, never memory.

### Structure
- Use the UI toolkit the project uses (Jetpack Compose or Views); do not mix styles in one screen. A composable or fragment renders state and emits events; it holds no business logic
- Follow the project's layers (UI → ViewModel → repository/data source). The ViewModel exposes one immutable UI state and takes events; data sources sit behind interfaces so tests can fake them
- Use the project's DI (Hilt, Koin, manual); do not add a second one. No `!!` outside tests; model absence with nullable types or a sealed result

### Concurrency and lifecycle
- Coroutines run in a scope tied to the lifecycle (`viewModelScope`, `repeatOnLifecycle`); inject dispatchers; no blocking calls on the main thread; never swallow `CancellationException`
- Survive configuration change and process death: state that matters is in the ViewModel or saved state, not in a composable's `remember` alone
- Handle runtime permissions, no network and background limits as normal states with a visible result

### Design tokens and platform feel
- Colours, typography and shapes come from the app theme mapped from `docs/design-system` (`MaterialTheme` or XML themes); no raw hex or dp literals in screens. Support dark theme, edge-to-edge insets, and the system back gesture
- Compose: keep composables stateless where you can (state hoisting), give lazy lists stable keys, avoid doing work in the composition body

### Security and release
- Secrets never in source or `strings.xml`; use the Keystore or the project's secret store. Manifest permissions, `minSdk`, signing and ProGuard/R8 config change only when the contract says so (smoke trigger). You never sign or upload to Play; see [platforms.md](../../skills/muffy/references/platforms.md#human-only-actions)

### Accessibility
- `contentDescription` or semantics on every interactive and icon-only element, touch targets of at least 48 dp, text that scales with the system font size

### Tests
- JUnit for ViewModel and domain logic with fakes you own; Compose UI tests find by semantics (text, role, tag). Instrumented tests (`androidTest/`) only for AC flows the JVM cannot reach
