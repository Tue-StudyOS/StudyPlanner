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
- **Planner**: the Monday–Friday calendar grid must remain visible at every
  window width, including a narrow desktop browser. It must never switch to a
  day-by-day agenda. On narrow screens, scroll sideways inside the calendar to
  reach every weekday; the page itself must not overflow horizontally. The time
  labels stay pinned while scrolling. Overlapping sessions get enough column
  width to remain readable. Hidden tutorial alternatives must not appear or
  create false conflicts. Select a course for details/tutorial choices; test
  removal, adding courses, Add slot, Export, unscheduled courses and Complete semester. Past semesters
  must not expose removal, export or completion; adding a slot remains available.
  The favorites drawer and tutorial choices must remain usable on touch widths.
  Check the entire signed-in semester page, not only the timetable component:
  populated progress cards and area selectors must not widen the page's grid
  tracks or push the calendar container beyond the viewport at 320 px and 375 px.
- **Account**: long emails (`break-all`) and long study-program names
  (`break-words`) wrap inside their cards.

## iOS regression check (session cookie)

Safari/iOS blocks third-party cookies. The app must call same-origin `/api/*`
so `studyplanner_session` is stored on `studyplaner.pages.dev`, not on
`workers.dev`. Covered by `frontend/tests/shared/apiBaseUrl.test.ts`.

Manual check: on an iPhone or iPad (Safari, Prevent Cross-Site Tracking on),
sign in and open Transcript. Personal courses must load. The historical failure
was two red banners reading "Authentication is required for this endpoint"
while the page still looked signed in.

## iOS regression check (ToR import)

Safari/iOS lacks async iteration over `ReadableStream`, which pdf.js needs.
The polyfill in
`frontend/src/features/transcript/utils/ensureReadableStreamAsyncIterator.ts`
must run before any pdf.js use (covered by unit tests in
`frontend/tests/transcript/ensureReadableStreamAsyncIterator.test.ts`).

Manual check: on an iPhone (Safari), upload a ToR PDF on the Transcript page.
The review list must appear; the historical failure mode was the error
"undefined is not a function (near '...value of readableStream...')".
