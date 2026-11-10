## Coding Practices: React / Next.js (TypeScript)

Adds to [coding-practices.md](coding-practices.md); same precedence rules. Libraries named below apply only if already in the project's dependencies; never add one because of this file.

- Default to server components (Next.js App Router); add `"use client"` only to the smallest leaf that needs state, effects or browser APIs
- Fetch server data with the project's data layer (server components, route handlers, or TanStack Query/SWR), not `useEffect` + `useState`
- Don't mirror props into state; compute during render, and reach for `useMemo`/`useCallback` only after measuring a problem
- `useEffect` is for syncing with something outside React; if it just derives state or reacts to a click, move the logic out
- Stable, unique `key`s from data ids, never array indexes for lists that reorder or change
- Use `next/image` with width/height and `next/link`; use the framework's metadata/loading/error conventions (`loading.tsx`, `error.tsx`) for those states
- Forms: React Hook Form + zod (or the project's equivalent) and server actions/route handlers validated again on the server
- Types: component props typed explicitly; prefer `type` for props and unions over enums; infer from zod/contract types instead of redefining them
- Tests: Testing Library queries by role/label, mock the network with MSW at the contract boundary
