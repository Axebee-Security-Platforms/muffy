# Loops

- **Review reject** → owners fix → re-merge → reviewer checks only the new diff → until Approve
- **QA fail** → owner fixes → reviewer checks the fix diff → QA runs the full regression suite
- **Smoke fail (3d)** → architect changes stack + ADR → smoke again; FE/BE wait
- **Staging fail** → logs to the relevant dev → back to step 6
- **Human reject** → reasons to the relevant agents → redo review + QA
- **Production health fail** → devops rolls back; report to the user before anything else
- More than 3 loops at one point → stop and ask the user
