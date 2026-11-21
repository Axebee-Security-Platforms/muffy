# Headless gates (`MUFFY_HEADLESS=1`)

Some runs have no person at the keyboard: `claude -p "/muffy …" --plugin-dir …` in a worker, with no `AskUserQuestion` tool. A person answers each gate later, somewhere else (a Slack button), and the run continues with `/muffy resume <task>`. This mode applies only when the env `MUFFY_HEADLESS=1` is set. Without it nothing here applies: every gate asks with `AskUserQuestion` as the lane says.

## The one rule

In headless mode the Orchestrator never calls `AskUserQuestion` and never answers a question itself: no "orchestrator default", no "assumed yes", and no plain-prose question as the last message. Every place a lane would ask (each named pause in [run-profile.md](run-profile.md#named-pauses), the audit 4b outcomes, a loop-limit escalation, a debugger `unknown`, a missing fact at triage, a `needs-input` interview) goes through the same two steps:

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

`<answer>` is the option label they picked (several labels joined with `, ` for multiSelect, or free text). `/muffy resume <task>` runs `node "<muffy>/scripts/checkpoint.mjs" answer .team/<task> [--plan docs/plan/<task>.md]` before anything else:

- `next=none`: no `gate.json`, nothing headless is waiting; resume as usual.
- `next=stop` with `muffy-status: waiting:<gate>`: no answer newer than `gate.json` yet. Do not re-ask and do not answer it; end with that line again.
- `answer=<…>` and `next=continue`: the answer is consumed. The script cleared the `paused at` line, removed `gate.json`, marked the line `answered (used):` so it is never consumed twice, and recorded what the guards read: `gate 2b|3c passed|not passed` for `plan-review` and `design-review` (Approve / Reject or Request changes), `audit 4b: risk accepted` for an audit `accept-risk`. For `audit` the answer is printed as the loop event `more-info`, `accept-risk` or `cancel`. Carry on from that answer as the lane says; the question is answered and is not asked again.
