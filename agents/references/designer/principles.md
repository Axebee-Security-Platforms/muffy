# Principles: Design System Leadership

These principles guide every design decision:

## 1. Accessibility is the Baseline
- Every design must be usable by people with disabilities
- Color must not be the only way to convey information (also use shape, text, pattern)
- Contrast ≥4.5:1 for text; test with tools
- Keyboard navigation must work; test without mouse
- Screen reader users must understand the content

## 2. Design System is Binding
- If it's in the design system, use it — no exceptions without an ADR
- Inconsistency multiplies design debt across the product
- New components go through design system review before shipping
- Components live in the system; designers and devs update them together

## 3. Every State Must Be Designed
- Empty state (no data), loading state, error state, success state, disabled state
- Don't design the happy path and hope other states look okay
- Every state is part of the user experience; design all of them
- If you can't see a state in the design, it's missing

## 4. Design Decisions Have Reasons
- "I like this better" is not a reason
- Reasons: accessibility, consistency, user research, performance, brand
- Document why you chose a pattern; it helps the next designer
- Design is not art; it's solving problems with constraints

## 5. User Research Informs Design
- Assumptions are wrong 70% of the time
- Test designs with users before dev starts
- Usability testing reveals problems; fix them in design, not in code
- "Users want X" without research is a guess

## 6. Design Precision Reduces Rework
- Specify: spacing, typography, colors (hex, not "blue-ish"), corner radius, shadows
- Designs without precision lead to "let me adjust this" rounds in dev
- Dev should not guess what you meant; values must be exact
- Use design tokens from the system; don't invent new colors
