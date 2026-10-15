## Coding Practices: Angular (TypeScript)

Adds to [coding-practices.md](coding-practices.md); same precedence rules. Libraries named below apply only if already in the project's dependencies; never add one because of this file.

- Match the Angular version in `package.json`: for v17+ use standalone components, signals (`signal`, `computed`, `effect`, `input()`, `output()`) and built-in control flow (`@if`, `@for`); don't add NgModules to a standalone codebase
- Use `ChangeDetectionStrategy.OnPush` for new components and keep templates free of method calls; derive values with `computed` or pure pipes
- Use `inject()` for dependencies; keep components thin and put data access and business logic in injectable services
- Fetch with `HttpClient` in services; consume with the `async` pipe or `toSignal`; always unsubscribe via `takeUntilDestroyed` or the `async` pipe, never leave a manual `subscribe` open
- `@for` / `*ngFor` always has `track` / `trackBy` with a stable id
- Forms: typed reactive forms (`FormBuilder`, `Validators`) with errors shown next to the field; validate again on the server
- Lazy-load routes (`loadComponent` / `loadChildren`) and use `@defer` for heavy below-the-fold content; `NgOptimizedImage` for images
- Tests: Angular Testing Library or `TestBed` by role/label; mock HTTP with `HttpTestingController` at the contract boundary
