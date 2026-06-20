# User Feedback Backlog

Actionable fix plan derived from two user interviews (source: `feedback.txt`).
Captured 2026-06-20. Nothing here is implemented yet — this file is for joint
review before work starts, and as a brief for the next implementation agent.

Every point below has been traced to concrete code with `file:line` references,
a root cause, a proposed fix, and acceptance criteria. Several feedback items
share the same root cause; those are grouped so they can be fixed in one pass.

## How to work this backlog

- Use **one shared branch** for the whole backlog. One focused commit per group
  (A, B, C, …). Merge once into `main` at the end (see `AGENTS.md` → Workflow).
- Read `StudyOS.html` before any visual change; replicate its colors/spacing,
  use Tailwind classes, do not invent new styles (see `CLAUDE.md` → Design).
- Every change must work at 320 / 375 / 768 / desktop, light and dark mode.
- Add/adjust tests for changed logic; run `npm run lint` and `npm run build` in
  `frontend/` before committing.

## Status legend

| Symbol | Meaning |
| --- | --- |
| `[ ]` | Open |
| `[~]` | In progress |
| `[x]` | Done |
| `[!]` | Blocked / needs decision |

---

## Open decisions for the team (resolve before implementing)

These change *what* we build, not just how. Decide together first.

1. **Brand red vs. error red (Groups A, B, H).** The brand/primary color *is*
   red/crimson (`--color-primary: rgb(147 13 42)`, the logo color, fixed in
   `StudyOS.html`). Users read red as "error". Options:
   (a) keep brand red for actions, introduce a clearly different hue for errors
   (e.g. orange/amber) + a green for success; or
   (b) recolor primary actions to a neutral/brand-secondary and reserve red
   strictly for errors. Option (a) is lower-risk and keeps the logo identity.
2. **Planner redesign scope (Group F).** "Information overload" + "font too
   small" is a design-direction question, not a one-line CSS fix. Decide how far
   to go: density pass + responsive type (small), or a layout rework (large).
3. **Discard interaction (Group C, item 14).** Undo vs. confirm-dialog vs. a
   clearer trash affordance. Pick one pattern and apply it consistently.
4. **Lecturer titles on cards (Group J).** Cards intentionally strip
   "Prof./Dr."; detail view keeps them. Decide consistent behavior.

---

## Suggested order of work

1. Quick, high-impact, low-risk: **E** (conflict bug), **G** (modal fixes),
   **B** (feedback button), **C** (transcript import UX + search speed).
2. Foundational: **A** (semantic color tokens) — unblocks 13/17/18 and tidies B/H.
3. Content correctness: **D** (favorites/offering), **H** (schedule legibility).
4. Breadth: **I** (i18n completeness).
5. Design-led, larger: **F** (planner density + responsive type).
6. Minor/decision: **J** (card titles).

---

## Group A — Semantic color tokens: split error / success from brand primary

**Feedback:** Interview 2, lines 13, 17, 18.
**Priority:** High (foundational — unblocks B, H, and item 17).
**Recommended commit:** `feat: add semantic danger/success colors, stop reusing primary for errors`
**Primary files:** `frontend/src/index.css`, `frontend/src/features/feedback/components/FeedbackWidget.tsx`, `frontend/src/features/transcript/components/*`, `frontend/src/features/dashboard/components/CategoryProgress.tsx`, `frontend/src/features/dashboard/components/RegulationProgress.tsx`, plus every `focus:border-primary` / `text-primary` error usage.

**Root cause.** `--color-primary` (`index.css:23`, dark `:122`) is simultaneously
the brand color, the primary-action color, the input focus color, and the error
color. There is no `danger` or `success` token (only `--color-thesis: #1dd3b0`
exists as a green-ish accent, `index.css:48`).

- **13 — dropdowns look like errors.** Inputs/selects use `focus:border-primary`
  (red border on focus), identical to the error border. Examples:
  `TranscriptImportRow.tsx:220` (semester), `:237` (grade),
  `CatalogCoursePicker.tsx:122`, plus `tone="error"` →
  `StudyAreaAssignmentField.tsx:55` (`border-primary/40 text-primary`).
- **18 — red is overloaded.** Error blocks reuse the brand red:
  `FeedbackWidget.tsx:248`, `Transcript.tsx:554/566/572`,
  `CatalogCoursePicker.tsx:126` (`border-primary/30 bg-primary-soft text-primary`).
- **17 — completed not green.** Progress rows fill with the category color and
  show `earned/required`; at 100% there is no distinct "completed" treatment
  (`CategoryProgress.tsx:27-45`; same gap in `RegulationProgress.tsx`).

**Proposed fix.**
- [ ] **A-1** Add tokens to `index.css` (light + dark): `--color-danger`,
  `--color-danger-soft`, `--color-success`, `--color-success-soft`. Pick hues
  per the team decision above; keep them legible in dark mode.
- [ ] **A-2** Repoint all *error* styles from `primary*` to `danger*`.
- [ ] **A-3** Change input/select focus from `focus:border-primary` to a neutral
  focus (e.g. `focus:border-fg-muted` / a focus ring) so a focused field never
  reads as an error.
- [ ] **A-4** Give 100%-complete categories/areas a `success` treatment (green
  bar + a "Completed" pill) in `CategoryProgress.tsx` and `RegulationProgress.tsx`.

**Acceptance criteria.** Selecting/focusing a dropdown shows no red. Error
messages use the danger color only. A completed category is visibly green with a
"Completed" label. Light and dark mode both pass.

---

## Group B — Make the Feedback button visually distinct

**Feedback:** Interview 2, line 16 (and contributes to line 15).
**Priority:** High (tiny change, removes a recurring mis-click).
**Recommended commit:** `fix: give feedback button a distinct non-primary style`
**Primary files:** `frontend/src/features/feedback/components/FeedbackWidget.tsx`.

**Root cause.** The floating feedback button uses `bg-primary` text-white
(`FeedbackWidget.tsx:170-176`) — identical to every primary action button, so it
competes for attention and gets clicked by mistake (see also Group C-15).

**Proposed fix.**
- [ ] **B-1** Restyle the launcher as a clearly secondary/utility control
  (e.g. neutral surface + border, or a subtle icon button), not brand-primary.
  Do this after Group A so it can use a non-primary token cleanly.

**Acceptance criteria.** The feedback launcher is visually subordinate to primary
actions and no longer shares the primary fill.

---

## Group C — Transcript import: clearer actions and faster search

**Feedback:** Interview 1 line 9; Interview 2 lines 14, 15.
**Priority:** High.
**Recommended commit:** `fix: improve transcript import actions and catalog search speed`
**Primary files:** `frontend/src/features/transcript/components/TranscriptImportRow.tsx`, `frontend/src/features/transcript/components/PersonalCourseCollection.tsx`, `frontend/src/features/transcript/components/CatalogCoursePicker.tsx`, `frontend/src/features/transcript/components/Transcript.tsx`.

- **14 — the "X" deletes but looks like collapse.** The per-row close button
  (`TranscriptImportRow.tsx:156-163`) sits next to the expand/collapse toggle
  (the whole left area, `:139-153`) and calls `onDiscard` (permanent delete).
  Same ambiguity for credited rows in `PersonalCourseCollection.tsx:31-38`.
  - [ ] **C-1** Use an unambiguous delete affordance (trash icon + label/tooltip)
    and add either a confirm step or an Undo (team decision #3).
- **15 — main action is at the top, not the bottom.** "Import ready rows" lives
  in the section header (`PersonalCourseCollection.tsx:134-141`; saved rows
  `:178-185`), so after editing rows the only primary-colored control near the
  bottom is the floating Feedback button → accidental clicks.
  - [ ] **C-2** Add a reachable Import action at the bottom of the review list
    (sticky footer or a duplicate bottom button). Pairs with Group B.
- **9 — catalog search can take ~10s.** `CatalogCoursePicker` issues a server
  round-trip per query (`fetchCatalogCourses`, `CatalogCoursePicker.tsx:72`,
  effect `:58-96`) even though the transcript page already loads the full catalog
  (`Transcript.tsx:103-107`, `useCatalogCourses('', 1000, ALL_CATALOG_PERIODS)`).
  - [ ] **C-3** Filter the already-loaded catalog client-side (pass
    `baseCatalogCourses` into the picker), or cache results; keep the 250ms
    debounce. Only fall back to the server if the local set is insufficient.

**Acceptance criteria.** Deleting a row is unmistakable and reversible/confirmed.
A primary Import action is reachable at the bottom after editing. Catalog search
in the picker returns within a few hundred ms for the loaded catalog.

---

## Group D — Planner favorites must respect offering & selected semester

**Feedback:** Interview 1 lines 6, 7.
**Priority:** Medium-High (correctness).
**Recommended commit:** `fix: align planner favorites with course offering and semester`
**Primary files:** `frontend/src/features/planner/hooks/usePlannerFavorites.ts`, `frontend/src/features/planner/components/PlannerFavoritesPanel.tsx`, `frontend/src/features/planner/components/SemesterPlanner.tsx` (verify where `favoriteCourses` is sourced).

**Root cause.** `usePlannerFavorites` decides "plannable" purely by regulation
area options (`isAssignable` = `getPlannerCourseAreaOptions(...).length > 0`,
`usePlannerFavorites.ts:72-73`). It does **not** consider offering status or the
selected semester.

- **6 — dashed (likely-offered) favorites disappear.** Likely courses get a
  dashed card and can be favorited (`CourseCard.tsx:68-73`,
  `offeringStatus === 'likely'`), but they are missing from the planner's
  "Interested" panel — confirm whether `favoriteCourses` is pre-filtered to the
  active term's confirmed catalog in `SemesterPlanner.tsx` (likely culprit).
  - [ ] **D-1** Ensure likely/other-status favorites still surface in the panel
    (visibly marked), instead of vanishing silently.
- **7 — favorites added to a semester that doesn't offer them.** A winter-only
  course (e.g. "Introduction to Cryptography") can be dropped into a summer plan;
  no term guard exists in the add path (`PlannerFavoritesPanel.tsx:48-64`).
  - [ ] **D-2** Compare the course `termType`/offered periods against the active
    planner semester; block or clearly warn on mismatch.

**Acceptance criteria.** A favorited likely-offered course is reachable in the
planner. Adding a course to a semester where it is not offered is prevented or
clearly flagged.

---

## Group E — Stop flagging the same course in multiple rooms as a conflict

**Feedback:** Interview 2, line 21.
**Priority:** High (clear bug, small fix).
**Recommended commit:** `fix: do not treat parallel-room sessions of one course as a conflict`
**Primary files:** `frontend/src/features/planner/utils/plannerFeedback.ts` (+ test).

**Root cause.** `buildPlannerBlocks` marks overlap for any two blocks on the same
day with intersecting times, excluding only the identical block id
(`plannerFeedback.ts:162-170`). Two schedule slots of the *same* course at the
*same* time in different rooms have different block ids
(`${course.id}-${index}`), so they overlap each other and are flagged.

**Proposed fix.**
- [ ] **E-1** Skip the overlap check when two blocks share `courseId` and the
  same start/end (parallel rooms), or dedupe parallel-room slots before overlap
  detection. Keep genuine cross-course conflicts intact.
- [ ] **E-2** Add a unit test in `frontend/tests/` (pure function — easy to test).

**Acceptance criteria.** One course listed in two rooms at one time shows no
conflict; two different courses overlapping still do.

---

## Group F — Planner readability: density and responsive type

**Feedback:** Interview 2, lines 22, 23.
**Priority:** Medium (design-led; size depends on decision #2).
**Recommended commit:** `feat: improve planner density and responsive sizing`
**Primary files:** `frontend/src/features/planner/components/PlannerGrid.tsx`, `SemesterPlanner.tsx`, `PlannerProgressStrip.tsx`.

**Root cause / notes.** Feedback is subjective ("too much info", "font too
small", "doesn't adapt to screen"). Needs a design pass against `StudyOS.html`,
not an ad-hoc tweak.

- [ ] **F-1** (decision needed) Density pass: reduce simultaneously-visible
  modules / progressive disclosure, larger base font, fluid sizing
  (`clamp()` / responsive Tailwind steps), and make the grid grow with viewport.
- [ ] **F-2** Re-check 320/375/768/desktop with no overflow or clipping.

**Acceptance criteria.** Planner is comfortably readable on a phone and uses
available desktop space; defined together during review.

---

## Group G — Modals: header clipping, background scroll, backdrop blur

**Feedback:** Interview 2, lines 19, 24.
**Priority:** High (clear bugs, shared root cause).
**Recommended commit:** `fix: unify modal layering, scroll lock and backdrop blur`
**Primary files:** `frontend/src/features/planner/components/SemesterCompletionDialog.tsx`, `frontend/src/shared/components/DetailSheet.tsx`, `frontend/src/features/layout/components/TopBar.tsx` (reference), optionally a new shared modal wrapper.

**Root cause.** Overlays are inconsistent and some sit *below* the sticky top bar.
Current z-index inventory: TopBar `z-[80]` (`TopBar.tsx:51`), TopBar mobile menu
`z-[90]` (`:129`), `PlannerCourseDetailModal z-[90]` (`:129`),
`FeedbackWidget z-[95]` (`:180`), but **`SemesterCompletionDialog z-50`**
(`:448`) and **`DetailSheet z-50`** (`:31`).

- **24 — "Complete Semester" pop-up clipped + background scrolls.**
  `SemesterCompletionDialog` is `z-50`, below the TopBar `z-[80]`, so the sticky
  header overlaps its first line (`SemesterCompletionDialog.tsx:448`). It also
  never locks body scroll (its only `useEffect`, `:280`, just clears errors), so
  wheel/scroll chains to the page behind it.
  - [ ] **G-1** Raise the dialog overlay above the top bar (≥ `z-[90]`).
  - [ ] **G-2** Lock body scroll while open and add `overscroll-contain` to the
    scroll container (`:470`).
- **19 — catalog module popup needs a blurred backdrop.** The catalog course
  detail overlay (`DetailSheet.tsx:31`) uses `bg-black/45` with no blur.
  - [ ] **G-3** Add `backdrop-blur` to the catalog detail overlay; also lift it
    above the top bar if it should cover it.
- [ ] **G-4** (recommended) Extract a shared modal primitive (overlay + scroll
  lock + z-index above top bar + optional blur) and adopt it in all four modals
  so layering/lock/blur stop drifting apart.

**Acceptance criteria.** No modal header is hidden by the top bar. Scrolling
inside a modal never moves the page behind it. The catalog detail popup has a
blurred backdrop. Verified on mobile and desktop.

---

## Group H — Course-detail schedule: distinguishable, meaningful colors

**Feedback:** Interview 1, line 8.
**Priority:** Medium.
**Recommended commit:** `fix: make course-detail schedule colors legible and meaningful`
**Primary files:** `frontend/src/features/courses/components/WeeklyScheduleMiniGrid.tsx`.

**Root cause.** The mini schedule only distinguishes *weekly* (primary red at
25% opacity) vs *exam* (accent gold at 30% opacity) — both low-opacity fills and
small dots that are hard to tell apart (`WeeklyScheduleMiniGrid.tsx:148-150`
grid blocks, `:176-178` list dots). It does **not** separate lecture vs.
tutorial, which is what users expected from the differing colors.

**Proposed fix.**
- [ ] **H-1** Increase contrast (higher opacity / outline + fill) so categories
  are clearly distinct, including dark mode and for color-vision deficiency.
- [ ] **H-2** Add a small legend, or label entries by session type, so the color
  meaning is explicit. If we want lecture-vs-tutorial coloring, drive it from
  `slotType` (already carried on the block).

**Acceptance criteria.** A user can tell schedule entry types apart at a glance,
with a legend or labels; passes dark mode.

---

## Group I — i18n completeness (German/English consistency)

**Feedback:** Interview 1 line 5; Interview 2 line 20.
**Priority:** Medium (broad, mechanical).
**Recommended commit:** `feat: localize transcript, planner-completion and catalog-search strings`
**Primary files:** `frontend/src/features/i18n/translations.ts`, transcript components, `SemesterCompletionDialog.tsx`, `CatalogCoursePicker.tsx`, `PlannerFavoritesPanel.tsx`, dashboard components.

**Root cause.** The i18n system (`t()`, `translations.ts`) exists but large parts
of the transcript and planner-completion UIs are hardcoded English, so the app
mixes languages depending on which screen you are on.

- **5 — mixed language.** Hardcoded English examples: `Transcript.tsx` notices/
  errors (`:253/264/278/285/297/306/320` and the loading strings `:561/585/591`),
  `PersonalCourseCollection.tsx` ("Personal Courses" `:89`, "Current review"
  `:127`, "Import ready rows" `:140`, "Saved for later" `:171`, "Credited"
  `:213`, "Edit"/"Done"/"Clear all" `:101/110`), `TranscriptImportRow.tsx`
  ("Semester" `:211`, "Grade" `:225`, "Category" `:264`, "Accept as übK" `:198`),
  `SemesterCompletionDialog.tsx` ("Mark Planned Courses as Completed" `:455`),
  `PlannerFavoritesPanel.tsx` ("Interested" `:153`, `:154-155`, `:166`),
  `CompletedCourses.tsx` ("Completed Courses" `:70`).
- **20 — catalog search always English.** The picker placeholder/label is
  hardcoded (`CatalogCoursePicker.tsx:102` "Catalog course", `:121` "Search
  catalog by title or number"); also check the main catalog search in
  `courses/components/Overview.tsx`.

**Proposed fix.**
- [ ] **I-1** Route the strings above through `t()` and add German keys in
  `translations.ts`. Suggest tackling one feature area per sub-commit if large.
- [ ] **I-2** Quick guard: grep components for raw quoted JSX text to catch the
  rest.

**Acceptance criteria.** Switching language updates transcript, planner-completion
and catalog-search UIs; no English leaks into the German UI on those screens.

---

## Group J — Lecturer titles consistency on cards

**Feedback:** Interview 1, line 4.
**Priority:** Low (depends on decision #4).
**Recommended commit:** `fix: consistent lecturer titles across course views`
**Primary files:** `frontend/src/shared/components/CourseCard.tsx`.

**Root cause.** Cards/overview strip academic titles via `plainLecturerName`
(`CourseCard.tsx:34-36`, used `:112`), while the detail view shows the full
`course.lecturer` (`CourseDetailBody.tsx:70`). Hence titles "missing in some
sections but correct in the detailed view".

**Proposed fix.**
- [ ] **J-1** Make it consistent per decision #4 (most likely: keep "Prof./Dr."
  on cards too, i.e. drop the stripping).

**Acceptance criteria.** Lecturer titles render the same way across card,
overview, and detail views.

---

## Non-actionable context (no work item)

- Interview 1, line 3: "Alma is primarily used as a source of information." —
  background on how users treat ALMA; no change required.
