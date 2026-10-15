## Coding Practices: Svelte / SvelteKit (TypeScript)

Adds to [coding-practices.md](coding-practices.md); same precedence rules. Libraries named below apply only if already in the project's dependencies; never add one because of this file.

- Match the Svelte version in `package.json`: Svelte 5 uses runes (`$state`, `$derived`, `$effect`, `$props`); Svelte 4 uses `export let` and `$:`. Never mix the two styles in one component
- Derive values with `$derived` (or `$:`), not by assigning inside an effect; `$effect` is for syncing with something outside Svelte
- Load server data in SvelteKit `load` functions (`+page.ts` / `+page.server.ts`), not in `onMount`; keep secrets and DB access in `.server` files only
- Mutations use form actions with `use:enhance` so forms work without JS; validate in the action with zod (or the project's equivalent) and return errors with `fail()`
- `{#each}` blocks always have a keyed `(item.id)`; no index keys on lists that reorder
- Share cross-component state through stores or a `.svelte.ts` module only when distant components need it; otherwise props and bindings
- Use `+error.svelte` for route errors; show loading with `{#await}` blocks, streamed promises returned from `load`, or `$navigating` for page transitions (SvelteKit has no `+loading` file). Use sized `<img>` or `<enhanced:img>` if `@sveltejs/enhanced-img` is installed
- Tests: Vitest + `@testing-library/svelte` by role/label; mock the network at the contract boundary
