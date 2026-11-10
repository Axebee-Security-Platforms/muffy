## Coding Practices: Solid / SolidStart (TypeScript)

Adds to [coding-practices.md](coding-practices.md); same precedence rules. Libraries named below apply only if already in the project's dependencies; never add one because of this file.

- Components run once, not on every update: don't destructure props (loses reactivity), read `props.x` inside JSX/effects or use `splitProps`/`mergeProps`
- Derive values with a function or `createMemo`, not by setting a signal inside `createEffect`; `createEffect` is for syncing with something outside Solid
- Use `<Show>`, `<For>`, `<Switch>`/`<Match>` for conditionals and lists, not `.map` or ternaries in JSX; `<For>` keys by reference, use `<Index>` for primitives
- Fetch with `createResource` or the project's query layer (TanStack Query, SolidStart `query`/`createAsync`), not `onMount` + signal; wrap in `<Suspense>` and `<ErrorBoundary>` for loading and error states
- Keep state local with signals; use stores (`createStore`) for nested objects and context only when distant components share it
- SolidStart: keep secrets and DB access in server functions (`"use server"`); mutations via `action` with `<form>`, validated on the server
- Tests: Vitest + `@solidjs/testing-library` by role/label; mock the network at the contract boundary
