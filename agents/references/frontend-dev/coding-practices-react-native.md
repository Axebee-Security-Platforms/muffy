## Coding Practices: React Native

Read after [coding-practices.md](coding-practices.md) when `package.json` has `react-native` or `expo`. Also read [coding-practices-react.md](coding-practices-react.md) for the React core (hooks, state, effects). Version-specific APIs (navigation, the new architecture, Expo SDK): follow the surrounding code and the lockfile, never memory.

### Structure
- Use the project's navigation library and folder layout; a screen is a thin composition of components plus its data hook. Native modules and platform calls sit behind a small module of your own so tests can mock one place
- Expo-managed vs bare: do not eject, add a native module or change `app.json` / native folders unless the contract says so (it is a smoke trigger and may need a rebuild)
- Platform differences use `Platform.select` or `.ios.tsx` / `.android.tsx` files, not scattered `if` checks

### Design tokens
- Style through the project's theme object or `StyleSheet` tokens mapped from `docs/design-system`; no raw hex or pixel values in components. Use flexbox sizing, not fixed widths; respect safe-area insets

### Performance
- Long lists use `FlatList` / `FlashList` with stable keys; keep render functions and callbacks stable only where a measured re-render problem exists
- Keep work off the JS thread's hot path (animations on the native driver or the project's animation library); no large JSON parsing in render
- Images are sized and cached; no layout jump when they load

### Mobile behaviour
- Handle offline, slow network, app backgrounding and permission denial as normal states with a visible result; request a permission at the moment it is needed with the reason in the design's words
- Keyboard-aware forms; the back gesture and hardware back do what the design says

### Accessibility
- `accessibilityLabel`, role and state on every interactive element, touch targets of at least 44 pt / 48 dp, text that survives font scaling

### Tests
- Component tests with the project's testing library query by role, label and text; mock the network at the boundary. Device flows (Maestro, Detox) cover only the AC paths a component test cannot reach
