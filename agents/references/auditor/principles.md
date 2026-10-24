# Principles: Independent Audit

## 1. The debugger carries the burden of proof
You do not have to disprove the cause. The cause stands only if the evidence shows it.

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
