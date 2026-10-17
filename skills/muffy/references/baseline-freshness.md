# Baseline freshness

`docs/architecture/baseline.md` records what the code was at one commit. Code moves; this decides when the baseline can still be trusted. Read this only when `check-baseline.mjs` printed yellow or red.

## The check (setup step 3, once per run)
`node .claude/skills/muffy/scripts/check-baseline.mjs` prints a colour and at most five reason lines (about 100 to 300 tokens). It reads git and the manifests only; it does not read source files, never opens `.env*`, and costs the model nothing. It is run once at setup, not before every step.

| Colour | When | What you do |
|---|---|---|
| green | no stack mismatch, no cited path missing, fewer than `yellow` covered files changed since the baseline's `commit` | Trust the baseline. Record `baseline: green` in checkpoint `## Status`. Nothing is asked and this file is not read |
| yellow | a cited path is missing, or `yellow` or more covered files changed, or the commit is not in this history | Tell the user once, in one line of the `pause:scope` question, with the reasons; offer a refresh. Carry on if they decline. The code wins over the baseline wherever they differ; agents note each difference as drift in their brief. Record `baseline: yellow` |
| red | a runtime or dependency in the baseline differs from the manifest by major version, or `red` or more covered files changed, or five or more cited paths are missing | The baseline is no longer a safe base for design. Ask the user: **refresh now** (run onboard, [onboard.md](onboard.md)) or **continue anyway**, in which case the architect and researcher treat the code as the only truth and the baseline as history. Record `baseline: red` and the answer |
| missing | no baseline | The existing "missing baseline" question in [setup.md](setup.md) |

## What counts, and what does not
- **Covered files** are manifests and lockfiles, infrastructure and CI files, files the baseline cites by path, and files under directories it cites. A change anywhere else does not age the baseline. Files inside dependency or build folders (`node_modules`, `vendor`, `Pods`, `.gradle`, ...) never count, even if someone committed them, unless the baseline cites them. The list of manifests and skipped folders is one shared file, `repo-facts.mjs`, used by this check and by the onboard scan (`scan-repo.mjs`), which also skips any folder `.gitignore` keeps out of git
- **Not a percentage of the project.** A share of the code is slow to measure (it means scanning everything), and it hides the risk: one changed core dependency matters more than fifty edited UI files. The thresholds count covered files and check hard facts instead
- Defaults are `yellow` 10 and `red` 40 covered files. They are a starting point: a project that changes fast sets higher numbers, a small stable one lower, in `.team/baseline-thresholds.json` as `{"yellow": 10, "red": 40}` (or `--yellow` and `--red`). Change them when yellow keeps firing for nothing; a question the user always ignores is wasted tokens
- Facts the script can verify: a cited path exists, and a version the baseline names (Node, Python, Go, or a package in `package.json`) has the same major version in the manifest. A change to a fact in the baseline that the script cannot see is found by the agents as drift

## Drift found during a task
Agents still notice drift while working (researcher and architect note it in the brief). That is evidence for a refresh, never a reason to edit the baseline: only the researcher rewrites it, by running onboard again ([onboard.md](onboard.md)). A refresh rewrites the baseline and its `commit`, so the next check starts green.
