# Implementation Backlog

Tracked changes for the StudyPlaner frontend.
Each group = one dedicated branch. Prefer one focused feature/fix commit per group when practical; combine only tightly related changes. Branch name: `fix/<group-slug>` or `feat/<group-slug>`.

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Open |
| `[~]` | In progress |
| `[x]` | Done |
| `[!]` | Blocked |

---

## Group A — Modal / overlay UX fixes

**Branch:** `fix/modal-ux`
**Files:** `RegulationProgress.tsx`, `SemesterPlanner.tsx`

- [x] **A-1** Replace all text "Close" buttons with an icon-only `×` button
  - `RegulationAreaDetailModal` — RegulationProgress.tsx:53–59
  - `PlannerOverflowDialog` — SemesterPlanner.tsx:167–174
  - `MobilePlannerFavoritesDrawer` — SemesterPlanner.tsx:289–295
  - Use a consistent `<button>` with `aria-label="Close"` and `×` as text content

- [x] **A-2** Backdrop click closes `RegulationAreaDetailModal`
  - Add `onClick={onClose}` to the outer `div` (RegulationProgress.tsx:34)
  - Add `onClick={e => e.stopPropagation()}` to the inner modal `div` so clicks inside don't bubble

- [x] **A-3** Remove `CatBadge` from course rows inside `RegulationAreaDetailModal`
  - Redundant — user clicked on that regulation area, so they already know the category
  - Delete lines 78–80 in RegulationProgress.tsx

---

## Group B — Grade display in regulation area detail

**Branch:** `fix/regulation-grade`
**Files:** `backend/src/services/progress.py`, `frontend/src/features/dashboard/types.ts`, `RegulationProgress.tsx`

- [x] **B-1** Expose `grade` in backend course detail serializer
  - `_build_completed_course_detail` (progress.py:66–82) has access to `grade` from the query (line 291) but does not include it in the return dict
  - Add `'grade': _normalize_float(completed_course.get('grade'))` to the return value

- [x] **B-2** Add `grade` to `RegulationAreaCourse` type
  - `frontend/src/features/dashboard/types.ts:10–18`
  - Add `grade: number | null`

- [x] **B-3** Show grade in `RegulationAreaDetailModal` course rows
  - Update `formatCourseLabel` (RegulationProgress.tsx:19–22) to append `· Note: X.X` (omit if null)
  - Example result: `INF4321 · WS 24/25 · 6 ECTS · 1.7`

---

## Group C — Planner layout restructure

**Branch:** `fix/planner-layout`
**Files:** `SemesterPlanner.tsx`, `PlannerFeedback.tsx`

- [x] **C-1** Remove the two header badge tags
  - Delete the `mb-2 flex flex-wrap gap-2` div containing "Account-based planning" and "One plan per semester" (SemesterPlanner.tsx:668–675)

- [x] **C-2** Move `PlannerAssignment` section below the schedule in edit mode
  - Extract the assignment block (PlannerFeedback.tsx:172–208) into a separate `PlannerAssignment` component
  - In `SemesterPlanner`, render `PlannerAssignment` after `PlannerGrid` (not inside `PlannerFeedback`)
  - `PlannerFeedback` then only renders: ECTS summary + fulfilled regulation parts
  - `PlannerAssignment` only renders when `isEditing && plannedCourses.length > 0`

- [x] **C-3** Align `PlannerFavoritesPanel` flush with the schedule block (desktop edit)
  - Current structure: `[PlannerFeedback + PlannerGrid] | [PlannerFavoritesPanel]` — favorites aligns to PlannerFeedback top
  - Target structure: `PlannerFeedback` full-width above, then `[PlannerGrid | PlannerFavoritesPanel]` side-by-side below
  - Restructure `SemesterPlanner` grid in edit mode:
    ```
    <PlannerFeedback />                         ← full width, always
    <div grid xl:grid-cols-[1fr_20rem]>
      <div>
        <PlannerGrid />
        <PlannerAssignment />                   ← after grid, edit only
      </div>
      <PlannerFavoritesPanel />                 ← edit only, desktop only
    </div>
    ```

---

## Group D — Weekly planner scroll fix

**Branch:** `fix/planner-scroll`
**Files:** `SemesterPlanner.tsx`

- [x] **D-1** Investigate and remove internal scroll from the weekly plan block
  - User reports the weekly plan block scrolls within itself on mobile
  - The grid wrapper has `overflow-x-auto` (SemesterPlanner.tsx:473) causing horizontal scroll
  - On mobile (`isMobilePlanner = true`) the layout already switches to `weekly-list` — verify this is actually active and not falling through to the grid
  - Fix: ensure `overflow-x-auto` only applies when the grid is actually rendered (not in list mode); remove it entirely if the grid can be made to fit through column resizing

---

## Group E — Dashboard mobile layout

**Branch:** `fix/dashboard-mobile`
**Files:** `Dashboard.tsx`, `SpecializationCircle.tsx`

- [x] **E-1** Fix `SpecializationCircle` overflowing on mobile
  - SVG is hardcoded `420×420` with `min-w-[420px]` (SpecializationCircle.tsx:67)
  - The `overflow-x-auto` on the wrapper prevents clipping but causes horizontal scroll within the card
  - Fix: use `viewBox="0 0 420 420"` without `min-w` and let the SVG scale via `width="100%" height="auto"` — the viewBox already exists (line 67), just remove the fixed pixel classes

- [x] **E-2** Fix `grid-cols-2` dashboard layout breaking on small screens
  - `Dashboard.tsx:111` — `grid grid-cols-2 gap-4.5` puts RegulationProgress and SpecializationCircle side by side on all screen sizes
  - On mobile both columns are too narrow; SpecializationCircle is invisible
  - Fix: change to `grid-cols-1 lg:grid-cols-2`

- [x] **E-3** Fix stats row `grid-cols-3` breaking on small screens
  - `Dashboard.tsx:103` — `grid grid-cols-3 gap-6` hardcodes 3 columns
  - On narrow screens the stat items are squeezed
  - Fix: change to `grid-cols-3` with reduced gaps and font scaling, or stack as `grid-cols-1 sm:grid-cols-3`

---

## Group F — General mobile audit (all tabs)

**Branch:** `fix/mobile-audit`
**Files:** TBD per finding

- [x] **F-1** Audit all tab views on mobile and fix layout issues
  - Tabs to check: Dashboard, Catalog, Planner, Transcript, Account, CourseDetail
  - Known issues already tracked in Groups D + E
  - Mobile smoke pass completed after the transcript/dashboard changes; no additional backlog-worthy findings remained.

---

## Group G — Mobile TopBar: Account in Dropdown

**Branch:** `fix/mobile-topbar-account`
**Files:** `TopBar.tsx`

- [x] **G-1** Remove standalone gear/settings icon from mobile topbar
  - Currently there's a separate `<Link to={ROUTES.account}>` gear icon next to the hamburger button (TopBar.tsx:31–41)
  - Delete it — account access moves to the dropdown

- [x] **G-2** Add "Account" NavLink inside the mobile drawer menu
  - In the drawer nav list (TopBar.tsx:114–133), append an "Account" item after the regular nav links
  - Use a user/person icon or the existing `GearIcon`, label "Account"
  - Closes the drawer on click (`onClick={() => setIsMenuOpen(false)}`)

---

---

## Group H — Catalog filter: flexible areas only + abbreviations

**Branch:** `fix/catalog-filter`
**Files:** `frontend/src/features/courses/components/Overview.tsx`, `frontend/src/shared/utils/regulation.ts`

- [x] **H-1** Compact/simplify `Overview.tsx` without behavior change
  - Remove any state duplication or redundant wrappers
  - Consolidate `toggleNumberSelection` / `toggleStringSelection` if possible
  - Keep it lean before adding feature changes

- [x] **H-2** Replace `topicAreaOptions` with `buildFlexibleRegulationAreaOptions`
  - Current: `(regulationVersion?.ruleGroups ?? []).map(rg => ({ code: rg.code, label: rg.name }))` — includes THESIS and all non-elective areas
  - Fix: import and call `buildFlexibleRegulationAreaOptions(regulationVersion.ruleGroups)` — already filters THESIS and non-flexible groups
  - Unauthenticated / no-PO users: no change — empty state ("Select a study program...") stays as-is since `regulationVersion` is null

- [x] **H-3** Use `option.code` as chip label for topic area chips
  - `buildFlexibleRegulationAreaOptions` already returns `{ code, label }` where `code` is e.g. `INFO-INFO`, `ML-CS`, `MEDI-APPL`
  - Change chip `label` prop to `topicAreaOption.code` instead of `topicAreaOption.label`
  - Gives user-requested abbreviations (INFO-INFO, INFO-THEO, MEDI-APPL, ML-CS etc.)

---

## Group I — Transcript mobile layout

**Branch:** `fix/transcript-mobile`
**Files:** `frontend/src/features/transcript/components/Transcript.tsx`

- [x] **I-1** Fix `AuthenticatedTranscript` two-column layout on mobile
  - Current: `grid-cols-5` always — left (col-span-2) + right (col-span-3) crammed on mobile
  - Fix: `grid-cols-1 lg:grid-cols-[2fr_3fr]` — stack on mobile, side-by-side on desktop

- [x] **I-2** Fix stats row inside `AuthenticatedTranscript`
  - Current: `grid-cols-3 gap-3.5` always — stat cells too narrow on mobile
  - Fix: keep `grid-cols-3` but reduce padding and use `sm:px-6` pattern; or `text-xl sm:text-2xl` on the value

---

## Group J — Mobile overflow: no horizontal scroll

**Branch:** `fix/mobile-overflow`
**Files:** `Dashboard.tsx`, `RegulationProgress.tsx`, global layout shell

- [x] **J-1** Fix Dashboard stat row overflow on mobile
  - `grid-cols-3` + `px-4` on narrow screens → `text-2xl` value + sub text inline overflow their cells
  - Fix: make sub text wrap below value (`flex-col` instead of `flex items-baseline`) on the `StatItem` component; or reduce value font to `text-xl sm:text-2xl`

- [x] **J-2** Fix RegulationProgress items going beyond white border
  - Regulation area buttons have `flex items-center justify-between gap-3` with code + name + "Fulfilled" badge + ECTS fraction
  - On mobile the combined width can exceed the card; the card has no `overflow-hidden`
  - Fix: add `overflow-hidden` to the outer card div; ensure the inner row always has `min-w-0` on the left flex container so `truncate` works on the name

- [x] **J-3** Enforce no global horizontal scroll on mobile
  - Add `overflow-x-hidden` to the main content container (or `body`) so that any uncaught overflow is clipped rather than creating a scrollbar
  - Check that the layout shell wrapper handles this correctly without breaking any intentionally scrollable containers (e.g. planner grid inside its own `overflow-x-auto` box)

---

## Group K — Transcript layout + compact editing UX

**Branch:** `feat/transcript-compact-layout`
**Files:** `frontend/src/features/transcript/components/Transcript.tsx`, `TranscriptImportRow.tsx`, `SavedCompletedCourseRow.tsx`, `StudyAreaAssignmentField.tsx`, `CatalogCoursePicker.tsx`, shared transcript subcomponents as needed

- [x] **K-1** Rebuild the authenticated transcript page into clearer blocks
  - Separate: upload/import, review queue, stats, saved courses
  - Reduce visual nesting and make the reading order obvious on desktop and mobile
  - Keep mobile-first stacking intact

- [x] **K-2** Introduce a compact course editor pattern for extracted + saved courses
  - Smaller expanded editor area
  - Smaller action buttons, inputs, and dropdowns
  - Preserve touch usability on mobile despite the denser desktop layout

- [x] **K-3** Repackage `Semester` / `Grade` hints into a compact helper pattern
  - Replace scattered explanatory copy with a minimal helper row, inline hint, or grouped metadata block
  - Avoid repeating the same guidance in every card

- [x] **K-4** Run a transcript mobile regression pass
  - Check review cards, saved-course rows, dropdowns, picker overlays, and stats on narrow screens
  - No new horizontal overflow

---

## Group L — Regulation assignment model overhaul

**Branch:** `feat/transcript-regulation-assignment`
**Files:** `frontend/src/features/transcript/components/TranscriptImportRow.tsx`, `SavedCompletedCourseRow.tsx`, `ManualCompletedCourseForm.tsx`, `StudyAreaAssignmentField.tsx`, `frontend/src/features/transcript/utils/buildTranscriptImportCandidates.ts`, `frontend/src/shared/utils/regulation.ts`, `backend/src/services/user_completed_courses.py`, related types

- [x] **L-1** Clarify and document the assignment rule model before implementation
  - Define when a course is assignable to one area vs multiple areas
  - Define how elective sub-areas should appear when a course currently only falls back to a generic elective bucket
  - Decide whether one completed course still stores exactly one chosen `studyAreaCode`

- [x] **L-2** Expose every valid PO assignment option for matched courses
  - If a course is valid for multiple regulation parts / course types in the active PO, show all of them
  - Do not collapse specific elective options into only a generic Wahlpflicht fallback

- [x] **L-3** Allow clean assignment to specific elective sub-areas
  - Add a minimal UI pattern for choosing a concrete elective area without clutter
  - Keep the generic fallback only where no more specific area exists

- [x] **L-4** Unify assignment validation across import, saved courses, and manual entry
  - Frontend option building and backend validation must follow the same rules
  - Prevent mismatches where the UI allows less than the backend, or vice versa

- [x] **L-5** Run responsive checks for all assignment states
  - Multi-option dropdowns, locked states, long labels, and missing-assignment states must stay usable on mobile

---

## Group M — Import resilience + per-account issue persistence

**Branch:** `feat/transcript-import-resilience`
**Files:** `frontend/src/features/transcript/components/Transcript.tsx`, `TranscriptImportRow.tsx`, `TranscriptProvider.tsx`, transcript types/api, `backend/src/services/user_completed_courses.py`, possible migration/backend storage files

- [x] **M-1** Change bulk import flow to support partial success
  - Valid courses should still be credited even if some rows are broken
  - Import feedback must clearly split: imported, skipped, still broken

- [x] **M-2** Persist broken/unresolved transcript rows per account
  - Store enough data to reopen and fix them later
  - Mark why each row failed (missing match, invalid data, assignment issue, save failure)

- [x] **M-3** Surface saved issue state in the transcript UI
  - Broken rows should remain visible/actionable instead of disappearing after a failed import attempt
  - Add a clear recovery path to fix and retry only the affected rows

- [x] **M-4** Review backend write strategy for failure isolation
  - Avoid all-or-nothing loss when one problematic row blocks the whole import payload
  - Keep data integrity explicit

- [x] **M-5** Run mobile QA for partial-import and retry states
  - Error banners, retry actions, and persisted broken rows must remain readable on phones

---

## Group N — Status colors + warning semantics cleanup

**Branch:** `fix/transcript-status-semantics`
**Files:** `frontend/src/features/transcript/components/TranscriptImportRow.tsx`, `SavedCompletedCourseRow.tsx`, `StudyAreaAssignmentField.tsx`, transcript helpers/types, possibly dashboard progress messaging

- [x] **N-1** Replace yellow-ish problem states with red error styling where action is required
  - Parsing/validation/assignment problems should use a stronger destructive state

- [x] **N-2** Mark missing study-area assignment as an error state
  - Also when a course is otherwise recognized/countable but no study area is chosen yet

- [x] **N-3** Distinguish informational, warning, and blocking states consistently
  - Ready / informational
  - Needs manual attention
  - Blocking / invalid
  - Reuse the same language and colors across transcript views

- [x] **N-4** Verify contrast and mobile readability of the new states

---

## Group O — Transcript copy cleanup + policy wording

**Branch:** `fix/transcript-copy`
**Files:** `frontend/src/features/transcript/components/Transcript.tsx`, `TranscriptImportRow.tsx`, `SavedCompletedCourseRow.tsx`, `ManualCompletedCourseForm.tsx`, `StudyAreaAssignmentField.tsx`, `frontend/src/features/dashboard/components/Dashboard.tsx`

- [x] **O-1** Remove the dashboard overview helper sentence
  - Delete: `Browse your regulation parts above to inspect which completed courses are already credited in each section.`

- [x] **O-2** Rewrite confusing assignment help texts in plain language
  - Especially the current message: `Manual courses may only be assigned to flexible regulation areas or ÜBK.`
  - Explain the why, or replace it with a shorter actionable message

- [x] **O-3** Reduce repetitive transcript helper copy
  - Keep only the smallest set of explanations needed to complete the flow
  - Prefer contextual wording over generic blocks

- [x] **O-4** Check text wrapping and readability on mobile

---

## Group P — Partial transcript import failure after partially valid payloads

**Branch:** `fix/transcript-partial-import-network-error`
**Files:** `frontend/src/features/transcript/components/Transcript.tsx`, `TranscriptProvider.tsx`, transcript API/types, `backend/src/services/user_completed_courses.py`, `backend/src/services/user_transcript_issues.py`, related request handling

- [x] **P-1** Reproduce and isolate the failing partial-import flow
  - Capture which request fails after a partially valid import attempt
  - Verify whether the failure is caused by the completed-courses endpoint itself, transcript-issue persistence, or frontend retry/state sequencing

- [x] **P-2** Make partial success robust even when some rows fail
  - Valid courses must still persist and refresh reliably
  - Broken rows must remain recoverable without collapsing the whole flow into a generic network error

- [x] **P-3** Harden frontend error handling for unreachable/CORS-blocked follow-up requests
  - Avoid misleading generic network messages when the import result is partially usable
  - Show a clear split between saved courses, unresolved rows, and failed follow-up actions

- [x] **P-4** Add a regression test or documented repro check for partially valid imports
  - Verified via the new bulk-import endpoint path and frontend import flow build/lint pass after introducing per-row success, duplicate, and failure buckets.
  - Cover at least one valid + one invalid row in the same import batch

---

## Group Q — Transcript review UI simplification

**Branch:** `feat/transcript-simplicity`
**Files:** `frontend/src/features/transcript/components/Transcript.tsx`, `TranscriptImportRow.tsx`, `ManualCompletedCourseForm.tsx`, shared transcript subcomponents as needed

- [x] **Q-1** Shrink and simplify the per-course review/edit containers
  - Reduce oversized panels, spacing, and nested wrappers
  - Keep the screen focused on one decision at a time

- [x] **Q-2** Rebalance the transcript page layout for visual calm
  - Improve hierarchy, spacing, and section density
  - Optimize for readability instead of large card-heavy blocks

- [x] **Q-3** Run desktop/mobile QA for the compact transcript layout
  - Frontend build/lint completed after the compact transcript layout changes.
  - Ensure the simplified layout stays touch-friendly and does not reintroduce overflow

---

## Group R — Remove “Saved completed courses” from transcript page

**Branch:** `fix/transcript-remove-saved-courses-section`
**Files:** `frontend/src/features/transcript/components/Transcript.tsx`, transcript subcomponents/provider as needed

- [x] **R-1** Remove the “Saved completed courses” section from the transcript view
  - The dashboard becomes the primary place to inspect already credited courses

- [x] **R-2** Clean up transcript-only UI/state that becomes unused after removal
  - Keep only the data and actions still needed by dashboard/progress views

- [x] **R-3** Verify there is still a clear path to inspect completed courses elsewhere
  - The transcript page now points users to the dashboard for their saved completed-course overview.
  - Dashboard and related drill-downs must fully cover the removed use case

---

## Group S — Inline planner assignment during add/remove

**Branch:** `feat/planner-inline-assignment`
**Files:** `frontend/src/features/planner/components/SemesterPlanner.tsx`, `PlannerFeedback.tsx`, planner assignment helpers/types, related regulation option utilities

- [x] **S-1** Move assignment choice into the add/remove interaction itself
  - Users should be able to choose what a course counts as directly while adding or removing it

- [x] **S-2** Remove the separate “Planner assignment” box once inline assignment is in place
  - Preserve all current validation and feedback without a detached extra panel

- [x] **S-3** Keep the inline UX minimal and understandable
  - Avoid adding another visually heavy row or large editor block to the planner

- [x] **S-4** Verify add/remove flows for courses with one, many, or no valid assignment targets
  - Verified in the new picker flow with fixed, selectable, and missing assignment states.

---

## Group T — Smart planner auto-assignment / autocomplete

**Branch:** `feat/planner-auto-assignment`
**Files:** `frontend/src/features/planner/components/SemesterPlanner.tsx`, planner utilities, regulation matching helpers, possibly backend/shared planning helpers if needed

- [x] **T-1** Define the smallest safe auto-assignment strategy
  - Prefer deterministic suggestions over opaque “AI-like” behavior
  - Start with cases where there is exactly one valid target or one clearly best open target

- [x] **T-2** Use existing completed courses and remaining regulation needs in the suggestion logic
  - Consider already credited courses so new assignments do not block a better overall allocation

- [x] **T-3** Evaluate whether reassignment of older completed courses is needed to satisfy the plan better
  - Kept out of scope deliberately: suggestions now respect already credited courses but do not silently rewrite older completed-course assignments.
  - If yes, make the rule explicit and transparent before implementation
  - If no, constrain suggestions to the currently edited course only

- [x] **T-4** Keep suggestions overrideable and visible to the user
  - Users must always be able to confirm or change what a course counts as

- [x] **T-5** Add regression checks for ambiguous, unique, and conflicting assignment cases
  - Covered by frontend build/lint after introducing fixed, suggested, and manually overridden planner assignments.

---

## Backlog (unplanned)

### Notes for execution

- Implement each group on its own dedicated branch; prefer one focused feature/fix commit per group.
- Combine adjacent groups only when that produces a clearer review than splitting them.
- Merge tiny copy-only changes into the nearest functional group when it reduces overhead.
- After every group, run a dedicated transcript/dashboard mobile smoke test.
- If planner auto-assignment or transcript assignment improvements require a deeper data-model change, split out a dedicated backend/data-model group before shipping UI-only behavior.

<!-- Raw ideas / future work that has not been scoped yet -->
