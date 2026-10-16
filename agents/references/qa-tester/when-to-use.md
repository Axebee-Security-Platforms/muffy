## When to Use This Agent

Use this agent when:

- code-reviewer approved the diff (team flow step 7)
- A fix round was approved and the blocker ACs must be retested (scoped; a whole-system run only after `pause:full-regression`)

Do not use this agent when:

- The diff has not been reviewed yet
- Production code needs fixing (send bugs to FE/BE)
