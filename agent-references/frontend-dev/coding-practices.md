## Coding Practices

Framework-neutral core. Also read the one stack file that matches the codebase. The `Platform:` on the contract's Stack line says whether this is web, mobile or desktop ([platforms.md](../../skills/muffy/references/platforms.md)); the HTML, CSS and layout-shift bullets below are web rules, and a native stack file replaces them with its own. Outside the web, `tokens.css` and `var(--color-*)` do not apply: bind the same semantic tokens to the platform's theme layer (Flutter `ThemeData`, RN theme object, SwiftUI Asset colors, Compose `MaterialTheme`, a XAML `ResourceDictionary`, Electron CSS), and accessibility means the platform's own labels and roles (VoiceOver, TalkBack, UI Automation), dynamic type or font scaling, and touch targets of at least 44 pt / 48 dp. Detect from the manifest:
- `pubspec.yaml` → [coding-practices-flutter.md](coding-practices-flutter.md)
- `react-native` or `expo` in `package.json` → [coding-practices-react-native.md](coding-practices-react-native.md) (plus the React file)
- `Package.swift` or `*.xcodeproj` / `*.xcworkspace` → [coding-practices-swift.md](coding-practices-swift.md) (iOS and Mac)
- `build.gradle` / `build.gradle.kts` with an Android plugin → [coding-practices-kotlin.md](coding-practices-kotlin.md)
- `electron` in `package.json` → [coding-practices-electron.md](coding-practices-electron.md) (plus the renderer framework's file)
- a `*.csproj` / `*.sln` using WinUI, WPF, WinForms or MAUI → [coding-practices-windows.md](coding-practices-windows.md)
- web, from `package.json`:
- `next` or `react` → [coding-practices-react.md](coding-practices-react.md)
- `vue` or `nuxt` → [coding-practices-vue.md](coding-practices-vue.md)
- `svelte` or `@sveltejs/kit` → [coding-practices-svelte.md](coding-practices-svelte.md)
- `@angular/core` → [coding-practices-angular.md](coding-practices-angular.md)
- `solid-js` or `@solidjs/start` → [coding-practices-solid.md](coding-practices-solid.md)
- `astro` → [coding-practices-astro.md](coding-practices-astro.md) (plus the stack file of any framework used for its islands)
- anything else (unknown framework), in this order, stop at the first step that gives enough to code correctly:
  1. `docs/stacks/<framework>.md` exists → run `node "<muffy>/scripts/check-stack-notes.mjs" <framework>`: `fresh` or `unchecked` → read it and treat it as the stack file; `stale` → treat it as missing (step 3, problem `stack-unknown: <framework> <version> (note is for <old>)`). The whole ladder is in [stack-ladder.md](../shared/stack-ladder.md)
  2. Learn from local sources only, no web access: the version in the lockfile, the package's README/types in `node_modules`, existing code, `docs/architecture/baseline.md`. If the repo already has working examples of the idioms you need, follow them and say which stack you assumed
  3. Still unsure of idioms that change correctness (reactivity, routing, data loading, SSR) → don't guess: return `status: blocked` with a blocker `owner: Researcher`, problem `stack-unknown: <framework> <version>`, and stop. The Orchestrator gets a capped stack note written, then resumes you

Order of precedence: the surrounding code's conventions, then `design.md` / the design system / `contract.md`, then these files. Apply a practice only when the task touches that area; none of these justify extra wrappers or abstractions the AC doesn't need.

### File size
- Hard cap: no source file you write or edit passes ~300 lines (tests ~500); past ~200 lines, stop adding and split first. Never write one file that holds a whole screen or feature
- Split by responsibility: page/route composition, presentational components (one per file), hooks/composables/stores, API client calls, types, constants/helpers, styles. Tests in their own files
- Write the split layout before coding (list the files and what each owns) and create them up front; do not dump everything into one file "to split later"
- A file you edit that is already over the cap: don't grow it. Extract the part you touch into a new file in the same change
- Before hand-off run `wc -l` on every file you created or changed; any over the cap is fixed, not reported

### Components
- One component, one job; split when it has two reasons to change or its template passes ~100 lines, not before
- Prefer composition (children/slots) over a growing list of boolean props; derive values instead of copying props into state

### State and data
- Keep server data (fetched, cached, mutated) separate from UI state (open, selected, input draft); use the project's data-fetching layer for the former
- Keep state as local as possible; lift it only to the nearest common parent; reach for global state last
- Every data-driven view handles loading, empty, error and success; mutations show pending state and recover from failure
- Use types (TypeScript where the project has it) from the contract; no `any`, no casts to silence the compiler, validate untyped external data at the edge

### Forms
- Use the project's form + schema validation approach; validate on submit and on blur, show the error next to the field, and keep the user's input on failure
- Disable submit only while pending, never to hide a validation problem; every field has a visible label

### Performance and accessibility
- No fetch waterfalls: start independent requests together; lazy-load heavy components that are below the fold or behind an interaction
- Web: give images dimensions (no layout shift from late-loading content); interactive elements are real `button`/`a`/`input`, not clickable `div`s. Native: the stack file's accessibility section replaces this (platform labels, roles, touch targets)
- Focus is visible and returns sensibly after dialogs close

### Tests
- Test what the user sees and does (roles, labels, text), not internal state or class names; cover each design.md state and each AC error case
- A test names the behaviour (`shows the cooldown timer after 3 failed logins`); it must survive a refactor that keeps behaviour and fail when the behaviour breaks
- Mock the network at the boundary (the contract's endpoints), not the components under test or your own hooks and stores
