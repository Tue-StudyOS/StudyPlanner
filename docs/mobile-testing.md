# Manual mobile test checklist

There is no E2E setup in this repo, so mobile compatibility is verified manually.
Run these checks before merging UI changes, in light and dark mode.

## Viewports

Use browser dev tools (device emulation) at minimum:

| Width | Represents |
| --- | --- |
| 320 px | Small Android / iPhone SE landscape edge case |
| 375 px | iPhone (Mini/SE portrait) |
| 390–430 px | Current iPhones / Androids |
| 768 px | Tablet portrait |
| ≥ 1280 px | Desktop |

On real devices, prefer iOS Safari and Android Chrome.

## Global checks (every page)

- No horizontal scrolling or layout breaks.
- No text overflowing card borders; long course names wrap or truncate.
- Buttons at the bottom of dialogs stay reachable (no clipping behind browser chrome).
- Modals (`RegulationAreasInfo`, `SpecializationCircle` detail, planner dialogs,
  onboarding) scroll internally and close via the X button.
- Top bar collapses to the burger menu below 960 px; menu opens and closes.

## Page-specific checks

- **Catalog/Overview**: filter bar wraps; course cards with long titles and many
  badges stay inside their card; detail drawer fills the screen on phones.
- **Transcript**: upload card, stats, and manual form stack vertically; import
  review rows with long extracted titles truncate in the header and wrap when
  expanded; the semester/grade/area fields stack on narrow widths.
- **Planner**: weekly grid switches to the mobile layout; favorites panel wraps;
  drag–and–drop is replaced by usable controls on touch widths.
- **Account**: long emails (`break-all`) and long study-program names
  (`break-words`) wrap inside their cards.

## iOS regression check (ToR import)

Safari/iOS lacks async iteration over `ReadableStream`, which pdf.js needs.
The polyfill in
`frontend/src/features/transcript/utils/ensureReadableStreamAsyncIterator.ts`
must run before any pdf.js use (covered by unit tests in
`frontend/tests/transcript/ensureReadableStreamAsyncIterator.test.ts`).

Manual check: on an iPhone (Safari), upload a ToR PDF on the Transcript page.
The review list must appear; the historical failure mode was the error
"undefined is not a function (near '...value of readableStream...')".
