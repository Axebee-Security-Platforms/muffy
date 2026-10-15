## Fix Profile

Read this only when the prompt has `Profile: fix`. Only mode 3 runs: there is no mode 1 and no smoke build.

- Deploy plan: the prompt gives the path of the newest `.team/*/deploy.md`. Use it as is and do not rewrite it. None given: survey the repo's existing deploy files and follow the `staging:` value from `project.md`
- Staging: health check plus the smoke test from the Mode 3 checklist, as usual. Run the checks for the fix's AC if a live check exists
- Production: only with "Human approved" in the prompt, same as always. Canary and rollback rules do not change
