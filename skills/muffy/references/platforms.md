# Platforms: web, mobile, desktop, CLI

Muffy's flow is the same for every target. What changes is who builds it, what "design" and "smoke" mean, and which toolchain must exist on the host. The architect records the target in `contract.md` on the Stack line as `Platform: <value>`; every other step reads it from there. No `Platform:` line = `web`.

This file holds what the Orchestrator acts on: who to spawn, the toolchain check and what only the user may do. How each agent works on a platform lives with that agent: the CLI contract in [architect output-format](../../../agents/references/architect/output-format.md), native tokens and accessibility in [designer rules](../../../agents/references/designer/rules-and-guardrails.md) and [frontend coding practices](../../../agents/references/frontend-dev/coding-practices.md), smoke evidence in [devops workflow](../../../agents/references/devops/workflow.md#non-web-platforms-platform-mobile-desktop-or-cli), test runners in [qa-tester platform runners](../../../agents/references/qa-tester/platform-runners.md).

## Routing

| Platform | Stack examples | Builder | Design (3, 3b, 3c) |
|---|---|---|---|
| `web` | Next.js, Vue, Angular, Svelte | `frontend-dev` + `backend-dev` | Canvas, phone and desktop widths |
| `mobile` | Flutter, React Native / Expo, Swift (iOS), Kotlin (Android) | `frontend-dev` (app), `backend-dev` (its API, if any) | Canvas drawn as a phone frame (375 × 812), plus a tablet frame only if the AC names tablets |
| `desktop` | Electron, SwiftUI/AppKit (Mac), WinUI / WPF / MAUI (Windows), Flutter desktop | `frontend-dev` | Canvas drawn at the window sizes the AC names (min, default); no phone frame |
| `cli` | CLI tool, console app, daemon with no screens | `backend-dev` | No canvas, no `pause:design-review`. The architect writes `contract/cli.md` (the CLI surface) instead. Treated as "No UI change" in [run-profile.md](run-profile.md) |

A TUI with screens (full-screen terminal UI) is `cli` for routing, but the designer's text mock-ups of each screen go in `design.md` and the user approves them at `pause:design-review`.

A platform that is none of these (a game, an embedded device, a plugin) is allowed once it is listed under `platforms` in `.team/stack-extensions.json` ([stack-learning.md](stack-learning.md#what-a-project-can-add-without-editing-muffy)); the architect then states in the contract's Stack who builds it, what "design" means for it, and the toolchain, and devops states what smoke means in `deploy.md`.

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

The check is `node "<muffy>/scripts/devops-preflight.mjs" --toolchain <name>[=<version>]` (names in the script's usage line); the Orchestrator or devops runs it, and a FAIL prints the blocker text below. Missing → the step returns `status: blocked` with a blocker `owner: Devops`, problem `toolchain-missing: <name> on <host OS>`. Code review and unit tests that run on the host may continue; build, smoke and UI tests for that target wait for a host that has it (the user's own machine or CI). Never mark them passed from reading the code. QA reports such an AC as `not-run: toolchain-missing`; show it at the Human gate as not run, never as passed.

## Smoke (3d)
The steps are the same on every platform; devops picks the evidence for the platform and records it in `deploy.md`. 3d is skipped by default under the rules in [run-profile.md](run-profile.md). The smoke triggers also fire for a new native module, plugin or entitlement, a minimum OS version change, and a change to signing or build config.

## Human-only actions
No agent signs, notarizes, uploads to a store (App Store, Play, Microsoft Store), submits for review, publishes a package (npm, crates, NuGet, Homebrew) or touches signing keys, certificates or provisioning profiles. Devops prepares the artifact and a checklist; the user performs the action. Release is the user's own step after `pause:human-gate` (step 10); the Deploy hand-off from `docs-writer` (step 11) lists it.
