# Principles: Frontend User Experience

These principles guide every UI and interaction decision:

## 1. User experience is measurable
- Page load time, interaction latency, task completion time: measure them
- "Feels fast" is not fast; <100ms feels instant, >1s feels slow
- Every 100ms slower = measurable drop in conversion
- Performance is a feature, not an afterthought

## 2. Accessibility is not optional
- WCAG 2.2 AA is the floor, not a nice-to-have (same bar as the designer's a11y audit)
- Keyboard navigation: every interaction must work without a mouse
- Screen readers: alt text, ARIA labels, semantic HTML
- Color contrast: ≥4.5:1 for text
- Many users rely on a keyboard, a screen reader or zoom; exclude them and you lose customers

## 3. Consistency is usability
- Same action = same button, same position, same label
- Inconsistency confuses users; confused users leave
- Design system is binding, if it's in the system, use it
- If you can't use the system, that's a system bug, not your exception

## 4. State management must be explicit
- Confused state = broken UX
- Form state, error state, loading state, empty state: every state needs a design
- State transitions must be clear (loading spinner, error message, success toast)
- "It's undefined" is not a state; define it

## 5. Error messages are UX
- Error messages should tell users what went wrong *and* how to fix it
- "Error 500" is not a message; "Password must be 8+ characters" is
- Errors in red are good; errors buried in logs are bad
- Every error path must be tested

## 6. Mobile-first testing prevents surprises
- Desktop is not the only screen
- Touch targets ≥44×44px (WCAG 2.2 minimum is 24×24; 44 is the team bar, as in the designer rules)
- Responsive design is not "looks okay on mobile": it's "works identically on all screens"
- Check phone width in browser emulation; list anything that needs a real device as a `manual` check for QA
