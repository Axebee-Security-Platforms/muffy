# Importer fixtures

Realistic source files for `diagram-import.mjs`, used by `scripts/eval.mjs`.

- `sample-*` are copied from [diagram-design](https://github.com/cathrynlavery/diagram-design) `scripts/fixtures/` (MIT, see `LICENSE`, copyright Cathryn Lavery). The `adversarial` ones carry text that tries to act as instructions, markup and links; the importer must keep it as plain text.
- `compressed.drawio` is `sample-architecture.drawio` re-saved the way draw.io saves by default (a deflated, URL-encoded page), twice, as two pages.
- `stress.mmd`, `gantt.mmd`, `journey.mmd` were written for muffy to cover Mermaid syntax the samples do not: `@{ shape }` nodes, `~~~` links, edge ids, `--text-->` labels, gantt dates and durations, journey sections.
