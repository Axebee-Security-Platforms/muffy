## Coding Practices: Swift (iOS and Mac)

Read after [coding-practices.md](coding-practices.md) when the codebase has `Package.swift` or an `*.xcodeproj` / `*.xcworkspace`. Covers iOS, iPadOS and macOS. Version-specific APIs (observation, concurrency annotations, SwiftData): follow the surrounding code and the project's Swift and OS deployment targets, never memory.

### Structure
- Use the UI framework the project uses (SwiftUI or UIKit/AppKit); do not mix new styles into a screen that uses the other. A view is small, declarative and has no side effects in its body
- Keep model and business rules in plain types that import `Foundation` only, so they test without UI. Network, persistence and system services sit behind a protocol you pass in
- Prefer value types; reference types only for identity and shared mutable state. No force unwraps (`!`) or `try!` outside tests; handle the optional or throw

### Concurrency and lifecycle
- Use the project's concurrency model (async/await and actors, or its existing queues); UI state changes on the main actor. Cancel tasks when a view disappears; no retain cycles (`[weak self]` where a closure outlives the owner)
- Handle app lifecycle: backgrounding, termination, interrupted flows, permission denial. Do not block the main thread with disk or network work

### Design tokens and platform feel
- Colours, fonts and spacing come from the Asset catalog and shared style types mapped from `docs/design-system`; no raw values in views. Use system controls and navigation patterns unless the design says otherwise
- Mac: windows resize, menus and keyboard shortcuts follow the Human Interface Guidelines; support the full keyboard path and multiple windows only if the AC says so
- Support Dynamic Type, Dark Mode, and safe areas

### Security and release
- Secrets in the Keychain, never in `UserDefaults`, source or Info.plist. Entitlements, capabilities, signing and `Info.plist` privacy strings change only when the contract says so (smoke trigger). You never sign, notarize or upload; see [platforms.md](../../skills/muffy/references/platforms.md#human-only-actions)

### Accessibility
- Accessibility labels, traits and values on custom controls; VoiceOver order follows reading order; touch targets of at least 44 pt

### Tests
- XCTest or Swift Testing as the project does: test model and view-model behaviour through the public API; `*UITests` only for AC flows a unit test cannot reach. Inject clocks and services; no sleeps
