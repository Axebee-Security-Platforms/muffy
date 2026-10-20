## Platform runners

Read when the contract's Stack line has a `Platform:` other than `web`. Use the project's own runner, scoped by path, name or filter ([hooks-enforcement.md](../../../skills/muffy/references/hooks-enforcement.md) §10, §11):
- Flutter: `flutter test` (unit, widget), `integration_test/` (integration)
- React Native: Jest (unit), Maestro or Detox (e2e)
- Swift: XCTest / Swift Testing via `xcodebuild test` or `swift test`; `*UITests` targets are e2e
- Kotlin: JUnit via `./gradlew testDebugUnitTest`; `androidTest/` (instrumented) is e2e
- Electron: the unit runner, plus Playwright with the `_electron` launcher for e2e
- Windows: `dotnet test`; UI Automation tests are e2e
- CLI: spawn the built binary and assert stdout, stderr and the exit code; no browser automation

Emulator, simulator and device runs are L3 at least ([test-levels.md](../../../skills/muffy/references/test-levels.md)). The host lacks the simulator, emulator or SDK ([toolchain table](../../../skills/muffy/references/platforms.md#toolchain-on-the-host)) → report the AC as `not-run: toolchain-missing`, never as passed.
