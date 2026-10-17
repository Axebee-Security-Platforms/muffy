# Budget control

Money is the user's, the ceiling is recorded once, and the Orchestrator is the one who stops the run. Token spend is a separate matter ([token-discipline.md](token-discipline.md)).

## Who does what
| Who | Duty |
|---|---|
| User | Owns the budget ceiling and every decision to exceed it |
| `product-manager` | **The only writer of every cost record** in `docs/strategy.md`: goal, success metric and ceiling (asks once, else `[assumed]`; changed only at the user's word, with an ADR), the build vs buy log and the cost baseline (cost-record at step 3a, cost-reconcile at closing) |
| `architect` | Reports cost: writes the `Budget:` verdict and figures in `contract.md` `## Cost`, `contract/cost.md` and `contract/stack.md`, and offers a cheaper option when `over` or `unknown`. Never writes `docs/strategy.md` |
| `devops` | Reports infrastructure cost in `deploy.md` `## Infra cost` (cloud, on-premises or hybrid, with controls), checks real usage at staging, and never creates cost beyond what is declared |
| Orchestrator | Reads the verdict and stops at `pause:budget`, sends every cost fact to the product-manager to record (step 3a, closing), and shows the cost at the Human gate. Never edits `docs/strategy.md` itself |
| `code-reviewer` | Blocks recurring cost that the diff adds but the contract does not declare |

## `pause:budget` (Orchestrator)
1. After step 3 (contract and `deploy.md` aligned), read the first word of the contract's `## Cost` line. `Budget: none`, `within` or `unlimited` → no pause; write `budget: ok` (or `budget: unlimited`) in checkpoint `## Status`
2. `over` or `unknown` → `AskUserQuestion`, before the design-review question and before any FE/BE work: the figure (range and basis, `[assumed]` marks kept), the ceiling or "none set", and three options with the cheaper one first (it is the default):
   - **Take the cheaper option** the architect offered (its figure shown)
   - **Accept the cost**: the user confirms the figure; if it is above the ceiling the ceiling is raised
   - **Cut scope** to fit: reasons go to `architect` and `product-manager`
3. Record the answer in `.team/<task>/requirements.md` (`Q-budget · figure · answer · asked by architect`) and in checkpoint `## Status` (`budget: accepted|cheaper|cut`)
4. Cheaper or cut → send the reasons to `architect` (+ `product-manager` for a scope cut) and read the new verdict; still `over` → ask again. Counts at loop point `3:architect` ([loops.md](loops.md))
5. Accept above the ceiling, or "unlimited" → carry the user's words in `requirements.md`; the product-manager changes the ceiling and writes the ADR in the cost-record spawn (step 3a below). Never edit the ceiling yourself
6. An unanswered `pause:budget` stops the run there. Never proceed on an assumed approval

## Recording cost (step 3a)
After step 3 and any `pause:budget` are settled, and before 3b, spawn `product-manager` once with `mode: cost-record`, step `3a`, and `Read:` `contract.md`, `contract/cost.md`, `contract/stack.md`, `deploy.md` `## Infra cost`, `requirements.md`. It records the build vs buy log, the cost baseline line and, only on the user's word, the ceiling. A `Budget:` mismatch it reports goes back to the architect. Use `model: "haiku"` and effort `low` (the work is transcription, [token-discipline.md](token-discipline.md)). Skip the spawn when the verdict is `Budget: none` and there is no new build/buy choice: write `cost-record: skipped (no new cost)` in checkpoint `## Status`.

## Unlimited budget
When the user says the budget is unlimited, the product-manager records `unlimited (user, <date>)` as the ceiling once (in the cost-record spawn, or its first strategy write). It is a stated answer, so it is not re-asked and it is not `unknown`. Then:
- No `pause:budget`; the architect's verdict is `Budget: unlimited`
- Cost is still declared in `## Cost` with its basis, and still appended to the build/buy log and cost baseline: it is project data, not only a gate
- `code-reviewer` still raises `undeclared-cost`, and the Human gate and closing still show the cost line (shown as `unlimited ceiling`)
- A provider choice is still put to the user for lock-in or personal-data reasons, but price alone no longer triggers it
- It limits money only. Token spend, loop limits and the `pause:full-regression` approval are unchanged
- The user can set a ceiling later; the product-manager replaces the line and writes an ADR, and the next verdict is computed against it

## Human gate and closing
- **Step 10:** the question includes one cost line: the declared figure vs the ceiling (or `unlimited ceiling`), whether it was verified in staging or is still `[assumed]`, and any cost accepted at `pause:budget`
- **Closing:** spawn `product-manager` with `mode: cost-reconcile`, step `12`, giving the confirmed figures and where each came from (the staging report, the plan the user chose, the bill or usage the user showed, the hardware bought). It replaces this task's declared or `[assumed]` baseline lines with `confirmed (<source>, <date>)`. Unconfirmed figures stay marked. It never touches the goal or the ceiling, and neither do you. The final message repeats the cost line
- An undeclared recurring cost found in review (`undeclared-cost`) goes back to `architect` to declare and re-verdict; if the new verdict is `over`, `pause:budget` runs again before the merge
