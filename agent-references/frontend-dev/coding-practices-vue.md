## Coding Practices: Vue / Nuxt (TypeScript)

Adds to [coding-practices.md](coding-practices.md); same precedence rules. Libraries named below apply only if already in the project's dependencies; never add one because of this file.

- Use `<script setup lang="ts">` and the Composition API; extract reusable stateful logic into composables, not mixins
- Type props and emits with `defineProps`/`defineEmits`; never mutate a prop, emit an event or use `v-model` instead
- Use `computed` for derived values, `watch` only for side effects; don't copy props into `ref`s
- Fetch server data with `useFetch`/`useAsyncData` (Nuxt) or the project's query layer (TanStack Query), not `onMounted` + `ref`
- Keep shared state in Pinia stores only when more than one distant component needs it; otherwise props/emits or provide/inject
- `v-for` always has a stable `:key` from data ids; never put `v-if` and `v-for` on the same element
- In Nuxt use `<NuxtLink>` and the `error.vue`/`useHead` conventions; use `<NuxtImg>` only if `@nuxt/image` is installed, otherwise a sized `<img>`
- Forms: VeeValidate/FormKit + zod (or the project's equivalent), and validate again on the server
- Tests: Vue Test Utils or Testing Library by role/label, mock the network at the contract boundary
