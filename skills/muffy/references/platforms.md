# Platforms — web, mobile, desktop, CLI

Muffy's flow is the same for every target. What changes is who builds it, what "design", "smoke" and "staging" mean, and which toolchain must exist on the host. The architect records the target in `contract.md` on the Stack line as `Platform: <value>`; every other step reads it from there. No `Platform:` line = `web`.

## Routing

| Platform | Stack examples | Builder | Design (3, 3b, 3c) |
|---|---|---|---|
| `web` | Next.js, Vue, Angular, Svelte | `frontend-dev` + `backend-dev` | Canvas, phone and desktop widths |
| `mobile` | Flutter, React Native / Expo, Swift (iOS), Kotlin (Android) | `frontend-dev` (app), `backend-dev` (its API, if any) | Canvas drawn as a phone frame (375 × 812), plus a tablet frame only if the AC names tablets |
| `desktop` | Electron, SwiftUI/AppKit (Mac), WinUI / WPF / MAUI (Windows), Flutter desktop | `frontend-dev` | Canvas drawn at the window sizes the AC names (min, default); no phone frame |
| `cli` | CLI tool, console app, daemon with no screens | `backend-dev` | No canvas, no `pause:design-review`. The architect writes a **CLI surface** section in the contract instead (below). Treated as "No UI change" in [run-profile.md](run-profile.md) |

A TUI with screens (full-screen terminal UI) is `cli` for routing, but the designer's text mock-ups of each screen go in `design.md` and the user approves them at `pause:design-review`.

### CLI surface (the contract of a CLI)
`contract/cli.md` replaces `contract/endpoints/`: commands and subcommands, flags and arguments with types and defaults, stdin/stdout/stderr roles, exit codes (0 ok, one named code per failure class), what `--help` prints, config and env var names, and whether output is machine-readable (`--json`). The AC ids map to commands in `ac-map.md` the same way they map to endpoints.

A platform that is none of these (a game, an embedded device, a plugin) is allowed once it is listed under `platforms` in `.team/stack-extensions.json` ([stack-learning.md](stack-learning.md#what-a-project-can-add-without-editing-muffy)); the architect then states in the contract's Stack who builds it, what "design" means for it, and the toolchain, and devops states what smoke and staging mean in `deploy.md`.

## Tokens and a11y outside the web
`docs/design-system/tokens.css` and `var(--color-*)` apply to web only. A native app binds the same semantic tokens to its own theme layer (Flutter `ThemeData`, RN theme object, SwiftUI Asset colors, Compose `MaterialTheme`, a XAML `ResourceDictionary`, Electron CSS). Accessibility means the platform's own labels and roles (VoiceOver, TalkBack, UI Automation), dynamic type or font scaling, and touch targets of at least 44 pt / 48 dp.

## Toolchain on the host
A step that needs a toolchain the host lacks does not pass and does not pretend to. The Orchestrator checks the required toolchain before step 3d and before step 7:

| Target | Needs |
|---|---|
| Swift iOS / Mac app | macOS with Xcode (`xcodebuild`); a simulator for UI tests |
| Kotlin Android, React Native Android | JDK, Android SDK, an emulator or device for instrumented tests |
| React Native iOS, Flutter iOS | macOS with Xcode |
| Flutter | Flutter SDK (`flutter doctor` clean for the target) |
| Windows app (WinUI/WPF/MAUI) | Windows host with the .NET SDK (and the Windows App SDK for WinUI) |
| Electron | Node, and the OS the installer is built for |
| CLI / console | The language's toolchain |

The check is `node .claude/skills/muffy/scripts/devops-preflight.mjs --toolchain <name>[=<version>]` (names in the script's usage line); the Orchestrator or devops runs it, and a FAIL prints the blocker text below. Missing → the step returns `status: blocked` with a blocker `owner: Devops`, problem `toolchain-missing: <name> on <host OS>`. Code review and unit tests that run on the host may continue; build, smoke, UI tests and staging for that target wait for a host that has it (the user's own machine or CI). Never mark them passed from reading the code.

## What 3d (smoke) and 9 (staging) mean
The step is the same; the evidence differs. Devops records the choice in `deploy.md`.

| Platform | Smoke build (3d) | Staging (9) |
|---|---|---|
| `web` | Container builds and the health route answers | Deploy to staging, health + smoke |
| Android | Debug APK/AAB builds; app installs and launches on an emulator | Internal-testing track or a signed-debug APK handed to the user |
| iOS | Simulator build launches | TestFlight internal build, or a simulator build handed to the user |
| Mac / Windows / Electron | App builds and starts, main window opens, exits cleanly | Unsigned installer or app bundle produced by CI, run by the user |
| `cli` | Binary builds; `--help` and one core command exit 0 | The release binary run against a smoke command on a clean directory (no repo files) |

3d is skipped by default under the rules in [run-profile.md](run-profile.md). The smoke triggers also fire for a new native module, plugin or entitlement, a minimum OS version change, and a change to signing or build config.

## Human-only actions
No agent signs, notarizes, uploads to a store (App Store, Play, Microsoft Store), submits for review, publishes a package (npm, crates, NuGet, Homebrew) or touches signing keys, certificates or provisioning profiles. Devops prepares the artifact and a checklist; the user performs the action. Release is a part of `pause:human-gate` (step 10), never of staging.

## QA by platform
`qa-tester` uses the project's own runner, scoped by path, name or filter ([hooks-enforcement.md](hooks-enforcement.md) §10, §11):
- Flutter: `flutter test` (unit, widget), `integration_test/` (integration)
- React Native: Jest (unit), Maestro or Detox (e2e)
- Swift: XCTest / Swift Testing via `xcodebuild test` or `swift test`; `*UITests` targets are e2e
- Kotlin: JUnit via `./gradlew testDebugUnitTest`; `androidTest/` (instrumented) is e2e
- Electron: the unit runner, plus Playwright with the `_electron` launcher for e2e
- Windows: `dotnet test`; UI Automation tests are e2e
- CLI: spawn the built binary and assert stdout, stderr and the exit code; no browser automation

Emulator, simulator and device runs are L3 at least ([test-levels.md](test-levels.md)). Without the toolchain above, QA reports the AC as `not-run: toolchain-missing`, never as passed.
