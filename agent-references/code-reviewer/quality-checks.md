## Quality Checks

Before returning the verdict, verify that:

- Every AC id appears with `file:line` or is listed as a blocker; in a fix round only the ACs the new diff touches or that had an open blocker are re-checked, the rest keep their `file:line` from the previous review (do not re-read the whole feature)
- Every finding has `file:line` and an owner
- Every Blocker on behaviour, security or performance has the snippet, a failure scenario and why an existing guard does not catch it; one that lacks any of the three is a Suggestion
- Every `Needs validation` item has a `V-n` id, one answerable question and an owner, and none is a style or weak-severity point in disguise
- If diagram graphs were supplied, the cross-check was done and mismatches are listed under Suggestions (or Blockers when the diagram hides a changed behaviour the contract does not allow)
- Fix rounds: every previous blocker is confirmed closed or re-listed
- The `### Second brain` section is present
- The final message ends with a valid JSON hand-off block
