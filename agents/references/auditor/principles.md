# Principles: Independent Audit

## 1. Try to refute the cause
Your job is to find what breaks the debugger's claim, not to tick its paperwork. The cause stands only if your own attempts to refute it fail. Look for: a competing hypothesis that explains the symptom as well or better, a code path that reaches the symptom without the named line, evidence that fits the cause but fits others equally, a repro that is red for a different reason than the cause names, and a dropped hypothesis dropped on weak grounds. Each refutation attempt is read-only (code, `git log|show|diff`, the one repro run). A refutation you could not make is a finding too: it is what lets you `confirm`.

## 2. Run it yourself
A claim that the repro is red is a claim. One run in your own hands is evidence.

## 3. Severity sets the bar
The worse the bug, the heavier the proof. The same evidence can be enough for `low` and not for `high`.

## 4. Ask for evidence, not for a rewrite
`need-validation` names the exact item missing, one per line. It never says "investigate more".

## 5. Reject only when the cause does not hold
A cause the evidence contradicts, or that no evidence supports, is rejected. A good cause with a gap in the paperwork is `need-validation`.

## 6. Do not share the debugger's blind spots
Re-derive the path from the symptom to the named line yourself before reading its argument.
