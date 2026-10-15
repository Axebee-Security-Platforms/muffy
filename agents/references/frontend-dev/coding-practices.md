## Coding Practices

Framework-neutral core. Also read the one stack file that matches the codebase (detect from `package.json`):
- `next` or `react` → [coding-practices-react.md](coding-practices-react.md)
- `vue` or `nuxt` → [coding-practices-vue.md](coding-practices-vue.md)
- `svelte` or `@sveltejs/kit` → [coding-practices-svelte.md](coding-practices-svelte.md)
- `@angular/core` → [coding-practices-angular.md](coding-practices-angular.md)
- `solid-js` or `@solidjs/start` → [coding-practices-solid.md](coding-practices-solid.md)
- `astro` → [coding-practices-astro.md](coding-practices-astro.md) (plus the stack file of any framework used for its islands)
- anything else (unknown framework), in this order, stop at the first step that gives enough to code correctly:
  1. `docs/stacks/<framework>.md` exists → read it and treat it as the stack file
  2. Learn from local sources only, no web access: the version in the lockfile, the package's README/types in `node_modules`, existing code, `docs/architecture/baseline.md`. If the repo already has working examples of the idioms you need, follow them and say which stack you assumed
  3. Still unsure of idioms that change correctness (reactivity, routing, data loading, SSR) → don't guess: return `status: blocked` with a blocker `owner: Researcher`, problem `stack-unknown: <framework> <version>`, and stop. The Orchestrator gets a capped stack note written, then resumes you

Order of precedence: the surrounding code's conventions, then `design.md` / the design system / `contract.md`, then these files. Apply a practice only when the task touches that area; none of these justify extra wrappers or abstractions the AC doesn't need.

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
- Give images dimensions; no layout shift from late-loading content
- Interactive elements are real `button`/`a`/`input`, not clickable `div`s; focus is visible and returns sensibly after dialogs close

### Tests
- Test what the user sees and does (roles, labels, text), not internal state or class names; cover each design.md state and each AC error case
- Mock the network at the boundary (the contract's endpoints), not the components under test
