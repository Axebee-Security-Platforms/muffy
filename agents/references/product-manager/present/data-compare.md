# Data Compare

Read this only when the deck compares numbers.

## Pick the chart from the question

| The question | `chart.kind` |
|---|---|
| Which group is bigger? (a few categories) | `bar` |
| How do groups differ across several measures? | `grouped-bar` |
| How did it change over time? | `line` |
| What changed between two points (before → after, plan → actual)? | `before-after` |
| What share of a whole? | `bar` sorted, labelled with % — no pie charts |

## Shape

```json
{ "type": "chart", "headline": "Support tickets fell 40% after launch",
  "kind": "before-after", "unit": "tickets / week",
  "categories": ["Before", "After"],
  "series": [{ "name": "Tickets", "values": [120, 72] }],
  "source": "data/support.csv#weekly", "derived": "40% = (120 − 72) / 120" }
```

- Every series has exactly one value per category
- `unit` is required; mixed units never share a chart
- `derived` is required when the headline or a label shows a number not in the source (a %, a difference, a ratio): write the formula from source values
- `xLabel` (optional): name the categories when they aren't self-explanatory ("Region", "Plan tier"); months and Before/After need none

## Highlight and note

When the headline points at one bar, point or category, mark it as the chart's `highlight` so the designer can make it the one thing the eye lands on (Storytelling with Data).

```json
"highlight": { "category": "After", "series": "Tickets" },
"note": { "at": "After", "text": "Sign-in launched", "source": "release-notes.md#Changes" }
```

- One `highlight` at most. `series` is required when the chart has several
- The headline must name the highlighted category (the checker compares the text). If the headline is about the whole pattern ("all regions grew"), don't highlight
- One `note` at most, ≤ 60 characters, pinned to `at` (defaults to the highlight). A number or date in it needs `note.source`
- Never highlight to pull the eye away from an unfavourable series; the honesty rules below still apply

## Honesty rules

- Compare like with like: same unit, same period length, same definition. If the sources differ, say so in `notes` and in a footnote, or don't compare
- Values are absolute amounts ≥ 0, so a chart can start at zero; never pass a trimmed range that makes a gap look bigger
- No forecasts, targets or "projected" values unless a source states them — and label them as such
- Use every relevant data point, not the ones that flatter the story
- The headline states what the data shows, no more. "Fell 40%" is fine; "Users love it" from a ticket count is not
- Data the requester supplied counts as a source; cite its file path. Numbers typed in the request itself: cite `request`
- `data.csv` gets one block per chart: a header row (`category,<series names>`) then the rows, so the requester can rebuild it in Canva or Slides
