## Coding Practices: Flutter

Read after [coding-practices.md](coding-practices.md) when the codebase has `pubspec.yaml`. Durable practices only; for a version-specific API, follow the surrounding code and the lockfile, never memory.

### Structure
- Widgets are small and compose; split a `build` method when it has two reasons to change. Build methods are pure: no I/O, no `setState` side effects, no object creation that belongs in `initState`
- Use `const` constructors wherever the widget's inputs allow it
- Use the state management the project already uses (Provider, Riverpod, Bloc, ...); do not add a second one. Keep it above the widgets that read it, not inside them
- Platform and network code sits behind a plain Dart interface so tests can swap it

### Theme and design tokens
- Style only through `Theme.of(context)` / `ThemeData` and the project's extension tokens: no raw colours, font sizes or magic paddings in widgets. Map `docs/design-system` tokens into the theme once
- Layouts respond to constraints (`LayoutBuilder`, `Flexible`, `Expanded`), not to fixed pixel sizes; check the largest text scale and the smallest screen in the design

### Async and lifecycle
- Check `mounted` before using `BuildContext` after an `await`; cancel subscriptions, timers and controllers in `dispose`
- Lists use the lazy builders (`ListView.builder`); heavy work goes to an isolate, not the UI thread
- Every data-driven screen shows loading, empty, error and success; a failure keeps what the user typed

### Accessibility
- `Semantics` labels on icon-only controls, touch targets of at least 48 dp, contrast per the design, and layouts that survive font scaling

### Tests
- Widget tests find by text, `Semantics` or key and assert what the user sees; `integration_test/` covers a flow only where a widget test cannot reach it
- Use fakes for your own interfaces at the boundary; golden files only where the design asks for pixel-exact output
