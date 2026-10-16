## PR Lens graph document (short form)

Enough to write a valid `.pr-lens/graph.json` without loading the CLI manual (~17k tokens). Written for CLI 0.3.x, schema `0.2.0`. If `validate` rejects the document twice for a reason this page does not explain, load the full manual once: `npx @coldtea/pr-lens-cli@latest skill references`.

Every object is strict: an unknown key is an error. Ids match `^[A-Za-z0-9][A-Za-z0-9._:/-]*$`, are unique per collection, readable kebab-case.

```json
{
  "schemaVersion": "0.2.0",
  "kind": "graph",
  "title": "fe: login-flow",
  "summary": "One sentence: what does this change do?",
  "lenses": ["architecture", "data-flow"],
  "provenance": { "repo": { "owner": "acme", "name": "web" }, "base": { "sha": "<merge-base sha>" }, "head": { "sha": "<HEAD sha>" } },
  "lanes": [{ "id": "ui", "label": "UI", "subtitle": "src/app", "order": 1 }, { "id": "data", "label": "Data access", "order": 2 }],
  "nodes": [{ "id": "login-form", "label": "LoginForm", "kind": "ui", "delta": "added", "lane": "ui", "subtitle": "email + OTP", "files": [{ "path": "src/app/LoginForm.tsx" }] },
    { "id": "api-client", "label": "apiClient", "kind": "module", "delta": "modified", "lane": "data", "files": [{ "path": "src/lib/api.ts" }] }],
  "edges": [{ "id": "form-to-api", "from": "login-form", "to": "api-client", "kind": "http", "delta": "added", "label": "POST /auth/otp", "emphasis": "hero", "animated": true }],
  "flows": [{
    "id": "request-otp", "title": "Request an OTP", "delta": "added",
    "participants": [{ "node": "login-form" }, { "node": "api-client" }],
    "messages": [
      { "id": "post", "from": "login-form", "to": "api-client", "label": "POST /auth/otp", "kind": "sync", "delta": "added" },
      { "id": "ok", "from": "api-client", "to": "login-form", "label": "202", "kind": "return", "delta": "added" }
    ]
  }],
  "stats": { "filesChanged": 4, "additions": 120, "deletions": 3, "chips": [{ "label": "New endpoints", "value": "1", "tone": "added" }] },
  "views": [
    { "id": "overview", "title": "Whole change", "lens": "architecture", "defaultOpen": true, "scope": { "kind": "all" } },
    { "id": "request-otp-flow", "title": "Request an OTP", "lens": "data-flow", "scope": { "kind": "selection", "flows": ["request-otp"] } }
  ]
}
```

- `delta` on every node, edge, flow and message: `added`, `modified`, `removed`, `unchanged`. Keep the unchanged neighbours the change touches; that is the blast radius.
- Lanes 1–16, nodes 1–256, edges up to 512. Every node has exactly one lane. Lane `order` places left to right.
- Node `kind`: `service app module function route job queue datastore cache external ui config test package other` (`other` always renders). `files` (path, optional startLine/endLine); `group` clusters nodes inside a lane; `badges` up to 6 extra chips (never restate the delta).
- Edge `kind`: `call http rpc event queue data dependency render other`. `from`/`to` must be declared node ids (the most common failure). `emphasis`: `normal`, `hero` (one or two at most), `muted`.
- Flow: 2–12 participants (node ids), 1–64 messages; step order is array order. Message `kind`: `sync async return self`; `self` requires `from == to`, no other kind may. Both ends must be participants of that flow. `repeat: n` for a step that runs n times.
- Views (needed: the Artifact page makes one tab per view; no views = no picture). `lens` must be one of the document's `lenses`. `scope`: `{ "kind": "all" }` or `{ "kind": "selection", "nodes": [], "edges": [], "flows": [], "lanes": [] }` naming at least one id. Architecture views: whole change first (`defaultOpen: true`), then one narrower view only if it is materially smaller. A data-flow view is a separate root and needs `lenses` to include `data-flow`.
- Leave out `payload` and `walkthrough`: the Artifact page is static SVG and draws neither.
- Do not invent `provenance` shas or stats: take them from `git merge-base <base> HEAD`, `git rev-parse HEAD` and `git diff --shortstat <base>...HEAD` (`<base>` = the branch the feature merges into, never assumed to be `main`).
