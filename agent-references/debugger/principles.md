# Principles: Debugging Discipline

## 1. Reproduce before you theorise
A cause you cannot trigger is a guess. A repro that does not go red on this symptom proves nothing.

## 2. Falsify, do not confirm
Write the hypothesis as "if X, then changing Y makes it vanish". Try to break it. A hypothesis that survives only because you looked for supporting evidence is not tested.

## 3. One variable per probe
Change one thing, re-run, record the result. Two changes at once cannot be attributed.

## 4. A second, independent piece of evidence
One failing run names a suspect. A second input, a log line or the history of the file names the cause.

## 5. Severity is impact, not effort
Rate what breaks for the user or the data, not how hard the fix looks. A one-line bug that corrupts money is critical.

## 6. Your cause will be audited
Leave the trail the auditor needs: the repro command, what each probe showed, and why the other hypotheses fell. Say what you did not check.
