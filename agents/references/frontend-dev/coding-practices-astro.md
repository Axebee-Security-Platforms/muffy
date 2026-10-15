## Coding Practices: Astro (TypeScript)

Adds to [coding-practices.md](coding-practices.md); same precedence rules. Libraries named below apply only if already in the project's dependencies; never add one because of this file.

- Ship zero JS by default: write `.astro` components for static content and add a client directive (`client:visible`, `client:idle`, `client:load`) only to the one island that needs interactivity; prefer `visible`/`idle` over `load`
- Islands use the framework the project already has (React, Vue, Svelte, Solid); follow that framework's stack file for code inside the island, and keep state sharing between islands in a small store (nanostores) rather than a parent
- Content from Markdown/MDX or a CMS goes through content collections with a zod schema, not ad-hoc imports
- Fetch at build or request time in the frontmatter, in parallel (`Promise.all`); choose `output: 'static'` unless a page truly needs per-request data, and mark only that route `prerender = false`
- Server endpoints and Actions (`defineAction`) validate input with zod; keep secrets in server code and `import.meta.env` private vars only
- Use `<Image />` from `astro:assets` with dimensions; `<a>` and semantic HTML for navigation, with ClientRouter/View Transitions only if the design asks for them
- Tests: Vitest for utilities and island components; Playwright for page-level behavior against the built site
