## Coding Practices: TypeScript (Node.js)

Adds to [coding-practices.md](coding-practices.md); same precedence rules. Libraries named below apply only if already in the project's dependencies; never add one because of this file. Applies to Express, Fastify, NestJS, Hono and plain Node servers.

- `strict` stays on; no `any`, no `as` casts to silence errors, no `@ts-ignore` without a comment. Type data from the outside as `unknown` and narrow it
- Validate every request body, query and param with a schema (zod/valibot/TypeBox or the framework's pipe/validator) and infer the TS type from the schema instead of writing it twice
- Every `async` call is awaited or deliberately handled; no floating promises. Use one error-handling middleware/filter that maps typed errors to the contract's status codes and shape
- Never block the event loop: no sync `fs`/crypto/`JSON.parse` of large payloads in handlers; move CPU-heavy work to a worker or queue
- Load and validate config from env once at startup (fail fast on missing values); don't read `process.env` throughout the code
- NestJS: keep controllers thin, logic in providers, DTOs validated with `class-validator`/zod pipes, and dependencies via constructor injection. Express/Fastify/Hono: route handler → plain service function; don't build a framework-in-a-framework
- Use the project's ORM/query builder (Prisma, Drizzle, Kysely, TypeORM) with parameterized queries and generated types; migrations only through its migration tool
- Shut down gracefully on SIGTERM (stop accepting, drain, close DB pool)
- Tests: Vitest or Jest; hit handlers with `supertest`/`app.inject`/`app.request`; real DB via test container for query logic; mock only external services
