# Implementation Backlog

Tracked upcoming frontend changes for the StudyPlaner app.
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

## Group A — Account settings cleanup + device-driven layouts

**Branch:** `feat/account-settings-cleanup`
**Files:** `frontend/src/features/auth/components/AccountPage.tsx`, `frontend/src/features/auth/{types.ts,api.ts,AuthContext.ts}`, `frontend/src/features/layout/components/TopBar.tsx`, `frontend/src/features/planner/components/SemesterPlanner.tsx`, `frontend/src/features/transcript/components/Transcript.tsx`, `backend/src/services/authentication.py`

- [x] **A-1** Auto-save study profile settings
  - Remove the dedicated `Save study profile` button
  - Save study program, start semester, and planner layout automatically after changes (debounced or blur-based)
  - Keep saving/saved/error feedback visible but lightweight

- [x] **A-2** Remove `Planner mobile mode` from settings and active profile usage
  - Planner and transcript should decide mobile vs desktop behavior automatically from the viewport
  - Remove the manual `auto / mobile / desktop` override from the account page
  - Stop depending on that override in frontend state and backend profile update handling

- [x] **A-3** Rename `Planner mobile layout` to `Planner layout`
  - Keep the setting only for choosing the planner variant itself
  - Remove the helper copy: `Use these settings to try both mobile planner variants and to force mobile or desktop planner behavior when needed.`

- [x] **A-4** Reorder the account-page cards for mobile and desktop
  - Apply the requested swap between `Study profile` and `Update credentials`
  - Keep the higher-frequency study settings easier to reach than credential changes

- [x] **A-5** Fix the mobile top-bar app name
  - Change the mobile label from `Study` to `StudyPlanner`

---

## Group B — Planner header, actions, and copy cleanup

**Branch:** `fix/planner-header-cleanup`
**Files:** `frontend/src/features/planner/components/SemesterPlanner.tsx`, `frontend/src/features/planner/components/PlannerFavoritesPanel.tsx`

- [x] **B-1** Align the edit action with the semester selector
  - Keep the `Edit semester` action on the same visual row/height as the semester picker
  - Preserve a stable header layout in both view and edit states

- [x] **B-2** Remove redundant planner copy and status text
  - Remove `Mobile planner active ...` from the page intro
  - Remove `Mobile weekly list view enabled.`
  - Remove `X saved course(s) for ...`
  - Remove the extra `Semester` micro-label if the dropdown context is already clear
  - Keep `You have unsaved changes.`

- [x] **B-3** Surface `Delete saved plan` first in edit mode
  - Put the destructive full-plan delete action before the other edit controls
  - Keep the action clearly separated and confirmable

- [x] **B-4** Rename the mobile edit entry from `Favorites` to `Import`
  - Update related helper text so the drawer wording matches the action

---

## Group C — Planner slot removal + compact schedule readability

**Branch:** `fix/planner-slot-removal`
**Files:** `frontend/src/features/planner/components/SemesterPlanner.tsx`, planner helpers/types used for weekly blocks and saved-plan editing

- [x] **C-1** Remove individual planned time slots instead of removing every block for the same course
  - Add a trash/delete icon directly on each rendered slot
  - Cover grid blocks, mobile list rows, and overflow-dialog entries

- [x] **C-2** Introduce slot-level identity for remove actions
  - The current remove behavior appears course-based, which breaks duplicate-slot cleanup
  - Use a stable slot identifier so one duplicate can be removed without deleting the other

- [x] **C-3** Simplify the visible planner block content
  - In the weekly plan, only show course title, time, and room
  - Remove all other non-essential per-slot metadata from the main plan view

- [x] **C-4** Improve `Compact weekly grid` on phones
  - Rework density, truncation, and touch affordances
  - Make the compact variant clearly usable instead of just technically available

---

## Group D — Planner progress panel redesign

**Branch:** `feat/planner-progress-redesign`
**Files:** `frontend/src/features/planner/components/PlannerFeedback.tsx`, `frontend/src/features/planner/components/SemesterPlanner.tsx`, planner assignment/progress helpers

- [x] **D-1** Move the regulation/progress panel below the weekly planner

- [x] **D-2** Place `Planned ECTS` next to the regulation/progress panel on desktop
  - Stack the cards on mobile

- [x] **D-3** Rename `Fulfilled regulation parts`
  - Replace it with a clearer label

- [x] **D-4** Rebuild the planner regulation summary into a real progress view
  - Show what is already credited and what the current plan adds
  - Use clearly different visual weight/color for existing progress vs newly planned contribution
  - Prefer a simple list/graph hybrid if that communicates progress better than the current fulfilled-only cards

- [x] **D-5** Fix planner-progress correctness before the visual overhaul ships
  - Validate assignment logic, counting, and regulation-area aggregation
  - The current summary is not reliable enough for a pure UI refresh

- [x] **D-6** Evaluate optional course auto-balancing only as a follow-up
  - Do not block the redesign on this
  - Kept the existing deterministic assignment suggestion and did not add a more opaque balancing layer.

---

## Group E — Transcript import robustness + grade input constraints

**Branch:** `fix/transcript-import-grade-ux`
**Files:** `frontend/src/features/transcript/components/Transcript.tsx`, `frontend/src/features/transcript/components/TranscriptImportRow.tsx`, `frontend/src/features/transcript/components/ManualCompletedCourseForm.tsx`, `frontend/src/features/transcript/utils/buildTranscriptImportCandidates.ts`, transcript types/api/provider files, `backend/src/services/user_completed_courses.py`

- [x] **E-1** Reproduce and fix the imported ToR save error
  - Investigate the failing save path behind `The server hit an unexpected error while processing this request.`
  - Check payload validation, duplicate handling, issue persistence, and backend write logic

- [x] **E-2** Restrict transcript grades to the valid ToR scale
  - Allow only `1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0`
  - Replace the free numeric grade input with a scale-aware control

- [x] **E-3** Enforce the same grade rules in frontend and backend
  - Apply the same validation for imported rows, manual transcript edits, and persisted completed courses
  - Reject `5.0` for credited ToR entries with a clear user-facing validation message

- [x] **E-4** Fix the transcript mobile clipping regression
  - Re-check the authenticated transcript layout on narrow screens
  - Ensure the responsive layout decision is automatic and no account setting is required

---

## Backlog notes

- Implement each group on its own dedicated branch; prefer one focused feature/fix commit per group.
- Combine adjacent groups only when that produces a clearer review than splitting them.
- If removing `plannerMobileMode` touches stored profile data or API contracts, keep the compatibility path explicit.
- Re-run planner + transcript mobile smoke tests after every affected group.
