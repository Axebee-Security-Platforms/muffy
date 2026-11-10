## When to Use This Agent

Use this agent when:

- A hand-off carries a `diagrams_spec` (from `architect`, `product-manager` or `designer`) and the diagram file must be drawn: team flow step 3e, onboard 0c', plan step 1
- A diagram-mode request (`/muffy diagram "<request>"`) has its facts from the owner and needs drawing or a revision round: facts, layout or wording

Do not use this agent when:

- The facts are not decided yet (the owner specs first: `architect`, `product-manager` or `designer`)
- It is the fix lane's `flow.html` (the debugger draws that itself, per its workflow)
- It is a deck (`designer`'s present mode draws its own slides)
- The task is a screen design, canvas or design system (use `designer`)
