# Setup

1. Create `.team/<task>/`, `.team/<task>/handoff/` and `.team/<task>/rounds/`. `<brain>` = `<vault>/Projects/<repo-name>/`; create `project.md`, `tasks/`, `agents/<role>/` (one per agent) if missing
2. Create `<brain>/tasks/<task>.md` (frontmatter `project`, `task`, `date`, `status` + `[[agents/<role>/<task>]]` links); add the task to `project.md` → `## Tasks` as `in progress`
3. Read `project.md` (Lessons, Open issues, backlog). Resuming: read `.team/<task>/checkpoint.md` + `tasks/<task>.md` instead to find the step reached
4. **Confirm scope** (`pause:scope`): state the feature slice in one or two lines and the explicit out-of-scope list; `AskUserQuestion` until the user confirms. Multi-feature requests are cut to one slice here, never inside a step
5. **Pick the run profile** ([run-profile.md](run-profile.md)), state it to the user in one line, and create the todo list from the steps it keeps
6. **Worktrees** (`<role>` = the short prefix: `ops`, `fe`, `be`, `qa`): at setup create only the ops worktree, if the profile keeps step 3d: `git worktree add .worktrees/ops-<task> -b ops/<task> main`. After 3d passes, before step 4, create `fe` and `be` from the smoke-tested base: `git worktree add .worktrees/<role>-<task> -b <role>/<task> ops/<task>`. If 3d is skipped, create them from `main` instead. qa is created at step 7 from the reviewed branch. Agents receive the paths; they never create worktrees on the fly
7. Write the first `.team/<task>/checkpoint.md` ([memory-model.md](memory-model.md#checkpoint)): pin `## Goal` verbatim from the request, then the run profile, and the scope confirmed in step 4
