# Spawn prompt order (cache-stable prefix)

Silent flows re-spawn a role every round instead of continuing it with `SendMessage`, so the prompt is rebuilt each time. A prompt cache only reuses an identical **prefix**: put what is the same on every spawn of a role in a task first, and what changes per step or round last. `make-envelope.mjs` prints this order; never reorder it by hand.

**A spawn from `next.mjs` carries the template as a file.** The text below is the envelope: `next.mjs` writes it to `.team/<task>/envelopes/<step>-<role>-r<n>.md` and the Agent call carries only `Task:`, `Brain:`, `Step:`, `Hand-off:`, `Envelope: <path>` and one line telling the agent to read the file first. The cache-stable order below still holds, inside the file.

| Block | Lines | Changes per spawn? |
|---|---|---|
| 1. Constant | `Task:` / `Brain:` / `Vault:` / `Mode:` / `Profile:`, `Worktree:` / `Branch:`, `Don't touch:`, `Shared files you may not write`, `Commit trailer:`, `Final message:` | No (same for every round of a role in a task) |
| 2. Per spawn | `Goal:`, `Done when:`, `Read:`, `Write:`, then the optional `Announcement:` / `PR diagram:` / `Human approved:` / `Test level:` / `Full regression:` / `Checkpoint:` | Yes |
| 3. Last | `Hand-off shape:` (carries the step and round) | Yes |

Rules:
- Nothing that varies by round goes before the `Final message:` line. A blocker list, a validator error, a failed-check list or a review path goes in `Read:` (as a path), never pasted ([token-discipline.md](token-discipline.md) "Don't relay")
- A fresh spawn in a silent flow gets the earlier hand-off files in `Read:` (`handoff/<step>-<role>-r<n>.json`): its `decisions[]` are the reasoning of the previous round, and a re-listed `D-n` id means a changed choice
- `decisions[]` is required on a `done` or `blocked` hand-off of `designer`, `architect`, `product-manager`, `frontend-dev`, `backend-dev`, `devops` and `docs-writer` (outside present mode) so the next spawn does not have to guess why

Flows that are silent: design-review send-back ([design-review.md](design-review.md)), the fallback ladder's retries and full-flow fix rounds ([loops.md](loops.md)), stack-learning resumes ([stack-learning.md](stack-learning.md)). Requirements, present and diagram rounds still continue the same agent with `SendMessage`.
