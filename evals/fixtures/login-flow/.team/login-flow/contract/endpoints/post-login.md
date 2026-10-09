# POST /login

- Request: `{ "email": string, "password": string }`
- 200: `{ "ok": true }` and a session cookie (`sessions` row, 7 days)
- 401 `invalid_credentials`: unknown email or wrong password, same body for both
- 429 `rate_limited`: 5 failed attempts per email per minute, `Retry-After` header set

Covers AC-1 (200) and AC-2 (429).
