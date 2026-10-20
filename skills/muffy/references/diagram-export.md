# Diagram export and direct import

Orchestrator or user only: these commands write a file, so agents under the Bash guard do not run them. The diagram format itself (template, JSON, patterns, checks, importing as a draft) is agent content: [diagram-style.md](../../../agents/references/shared/diagram-style.md).

## Exporting a still image
Manual: only when the user asks for an image (a slide, a document, a chat message), never unprompted.
- `node .claude/skills/muffy/scripts/diagram-export.mjs <file.html> --png out.png [--theme light|dark] [--scale 2] [--width 1280]` works for every kind: headless Chrome/Edge opens the page on its finished frame (no animation or controls) and captures its full height. A flow's step bar is left out
- `--svg out.svg [--theme ...]` works for every kind. A `flow` diagram exports its own SVG (the diagram only). The other kinds are HTML cards, so the page is redrawn as native SVG shapes and text from what the browser laid out: positions, colours, borders, wires and text lines are kept, the whole page is included (title, subtitle, ledger), and shadows and the grid paper are left out. The text stays text, shown in the viewer's system font, so it stays editable in Figma, Inkscape or PowerPoint but may reflow slightly there
- A page that fails `check-diagram.mjs` is not exported. No Chrome/Edge: it says so and exits 2

## Importing straight to HTML
`diagram-import.mjs <file> --html <path>` writes the page directly instead of printing a JSON draft. Only the Orchestrator or the user runs it; the draft-and-check procedure an agent follows is "Importing an existing diagram" in [diagram-style.md](../../../agents/references/shared/diagram-style.md#importing-an-existing-diagram).
