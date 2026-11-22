# Headless gates (`MUFFY_HEADLESS=1`)

Some runs have no person at the keyboard: `claude -p "/muffy …" --plugin-dir …` in a worker, with no `AskUserQuestion` tool. A person answers each gate later, somewhere else (a Slack button), and the run continues with `/muffy resume <task>`. This mode applies only when the env `MUFFY_HEADLESS=1` is set. Without it nothing here applies: every gate asks with `AskUserQuestion` as the lane says.

## Rule H3: the fix lane decides its own gates (default)

In the **fix lane**, headless needs no policy flag: every gate is decided by `checkpoint.mjs ask`, and the person approves at PR review, not at a gate. Each stop would cost a new process that reloads the skill, so none is made. Other lanes are unchanged. `MUFFY_HEADLESS_GATES=ask` turns H3 off (the fix lane then follows the rest of this file).

| Gate (fix lane) | `ask` answers | Recorded in `## Status` |
|---|---|---|
| `scope` | `next=continue`, unless the run would promote or change scope | `auto: scope approved, headless fix lane … · rule H3` |
| `audit`, first `need-validation` | `next=continue`: re-run the debugger, then the auditor | `auto: re-diagnose · rule H2` |
| `human-gate` | `next=continue`: carry on to docs-writer and closing. The qa-report (the test gate's result, or its `skipped` line when the project has no `test_command`), its `manual` AC and the diff summary are for the PR review | `auto: ship to PR review · rule H3` |
| `audit` reject or a second `need-validation`, `escalation`, `question`, a promotion | `next=close:blocked` | `blocked at pause:<gate> · <reason>` |

On `next=close:blocked`: write the reason and the evidence so far into `fix.md`, start no dev, close per [closing.md](closing.md) with status `blocked`, commit `.team/<task>/` on the task's branch, and end the final message with `muffy-status: blocked:<gate>` as its last line. A blocked run is never answered by accepting the risk or by guessing the missing fact. `muffy` opens no PR: the review is on the branch, so say in the final message where `qa-report.md` and `fix.md` are.

## The one rule

Outside rule H3 (every lane but fix, or `MUFFY_HEADLESS_GATES=ask`), in headless mode the Orchestrator never calls `AskUserQuestion` and never answers a question itself: no "orchestrator default", no "assumed yes", and no plain-prose question as the last message. Every place a lane would ask (each named pause in [run-profile.md](run-profile.md#named-pauses), the audit 4b outcomes, a loop-limit escalation, a debugger `unknown`, a missing fact at triage, a `needs-input` interview) goes through the same two steps:

1. Write the exact `AskUserQuestion` input you would have sent to `.team/<task>/gate.json`: `{ "questions": [ { "question", "header" (≤12 chars), "multiSelect", "options": [ { "label", "description" } ] } ] }`, with 1-4 questions and 2-4 options each, the recommended option first.
2. Run `node "<muffy>/scripts/checkpoint.mjs" ask .team/<task> <pause id> [facts]` and act on what it prints:
   - `next=ask-user`: not headless. Ask with `AskUserQuestion` as before (the script wrote nothing).
   - `next=continue` after `OK auto: … · rule H2`: rule H2 passed the gate and recorded it in `## Status` (and removed `gate.json`). Carry on.
   - `next=stop` followed by `muffy-status: waiting:<gate>`: the script checked `gate.json` against `schemas/gate.schema.json`, added `gate`, `task` and `created_at`, and set the `paused at pause:<gate>` line in `## Status`, replacing any older one, never a second. Leave the trail ([resume.md](resume.md#leaving-a-trail-every-stop)): commit `.team/<task>/` on the task's branch, then stop. The final message ends with the line `muffy-status: waiting:<gate>` exactly as printed, as its very last line, after the `/muffy resume <task>` line.

The pause id is the named pause: `scope`, `scope-upgrade`, `plan-review`, `design-review`, `full-regression`, `audit` (4b reject, or a need-validation that does not re-run), `escalation` (loop limit), `question` (any other question: debugger `unknown`, a missing triage fact, a `needs-input` interview), `human-gate`, plus `onboard-review` and `todo-review`.

Facts the script needs, from what the lane already decided (never guess them in its favour):

| Pause | Flags |
|---|---|
| `scope` | `--triage-passed` when `next-action.mjs triage` picked this lane with no failed condition; `--ac-from-request` when every AC is read straight from the request or the error report, none invented; `--scope-change` when the run would promote, add work or cut the request |
| `audit` | `--verdict need-validation` or `--verdict reject` (a need-validation still unresolved after its round counts as `reject`) |

## Rule H2 (automatic passes)

Only when `MUFFY_HEADLESS_POLICY=self-heal` is set too. Any other value, or none, means every gate waits for a person.

| Gate | Passes automatically when | Recorded in `## Status` |
|---|---|---|
| `pause:scope` | triage passed, the AC come straight from the request, no promotion or scope change, and env `MUFFY_TRIGGERED_BY` names who clicked Investigate | `auto: approved by Investigate (@<MUFFY_TRIGGERED_BY>) · rule H2` |
| audit `need-validation` | the first time: the debugger re-runs once, then the auditor | `auto: re-diagnose · rule H2` |
| audit `need-validation` again, or `reject` | never: `gate.json` | |
| `pause:human-gate`, `plan-review`, `design-review` and every other pause | never: `gate.json` | |

If the run wants to promote or change scope after an H2 pass, it stops at `pause:scope` again with `--scope-change`.

## Answers and resume

The person's answer arrives as one line appended to `## Status`, written by whatever renders `gate.json` (not by muffy):

```
- <gate> answered: <answer> by <who> (<source>) <ISO time>
```

`<answer>` is the option label they picked (several labels joined with `, ` for multiSelect, or free text). A `gate.json` with several questions gets one line once every question is answered: the answers in question order, separated by ` | ` (space, pipe, space), for example `- scope answered: Go | FE + devops | Confirm by @lead (Slack, via Terminus) 2026-11-21T14:00+07:00`; a multiSelect answer inside one part keeps its `, `. A single question has no pipe. `/muffy resume <task>` runs `node "<muffy>/scripts/checkpoint.mjs" answer .team/<task> [--plan docs/plan/<task>.md]` before anything else:

- `next=none`: no `gate.json`, nothing headless is waiting; resume as usual.
- `next=stop` with `muffy-status: waiting:<gate>`: no answer newer than `gate.json` yet. Do not re-ask and do not answer it; end with that line again.
- `answer=<…>` and `next=continue`: the answer is consumed. The script cleared the `paused at` line, removed `gate.json`, left the person's line as it is and appended `<gate> answer consumed · <time>`, so it is never consumed twice, and recorded what the guards read: `gate 2b|3c passed|not passed` for `plan-review` and `design-review` (Approve / Reject or Request changes), `audit 4b: risk accepted` for an audit `accept-risk`. For `audit` the answer is printed as the loop event `more-info`, `accept-risk` or `cancel`. With several questions it prints `answer.<n>=<header>: <answer>` per question, in order (the gate decision for `plan-review`, `design-review` and `audit` is read from the first). Carry on from that answer as the lane says; the question is answered and is not asked again.

If `answer` exits 2 (an answer it cannot map, or a number of ` | ` parts other than the number of questions; nothing is written then), `gate.json` and the pause are still in place: stop, end with the error and `muffy-status: waiting:<gate>`. Never guess the answer and never fall back to a prose question.
