# Balance Planner Issue Report

## Summary

The Balance planner feature currently has multiple correctness problems. The backend has a backtracking balancer, but its scoring can still choose an unbalanced composition. The frontend then applies separate greedy assignment logic for display and edit-mode cleanup, so the Regulation outlook can disagree with the backend response and can depend on course add order or existing assignment state.

The most important local M.Sc. Informatik PO 2021 repro courses are:

- `978` Datenstrukturen, 9 ECTS, compatible with `INFO-THEO` and `INFO-INFO`
- `1006` Introduction to Cryptography, 9 ECTS, compatible with `INFO-THEO` and `INFO-INFO`
- `964` Natural Language Processing, 9 ECTS, compatible with `INFO-INFO`
- `1022` Forschungsprojekt Informatik, 9 ECTS, compatible with `INFO-INFO`
- `998` Algorithmische Geometrie, 6 ECTS, compatible with `INFO-BASIS`

## Problems Found

### Backend balance is not actually balanced

With `978` and `1006` planned, and both `INFO-THEO` and `INFO-INFO` empty, `_balance_assignments` currently returns both courses in `INFO-THEO`.

Expected behavior: split the two 9 ECTS courses across `INFO-THEO` and `INFO-INFO`, because both areas need 18 ECTS and a split creates a better balanced regulation outlook.

Root cause: `_score_solution` maximizes assigned course count first, then minimizes total remaining capacity. Assigning both courses to `INFO-THEO` and splitting them across both areas have the same total remaining capacity. The later tie-breaker prefers lower `sort_order`, so `INFO-THEO` wins repeatedly.

### Existing assignments can dominate the balance result

If both `978` and `1006` are already preferred as `INFO-INFO`, the backend keeps both in `INFO-INFO` when capacity allows, even though a split between `INFO-THEO` and `INFO-INFO` is a better balance.

Expected behavior: valid user preferences should matter, but they should not beat a clearly better balanced composition when the user clicked Balance planner.

Root cause: preferences are part of the backend score, while balance quality is not specific enough to distinguish pile-up from distribution across open required areas.

### Automatic suggestions are stored like manual choices

When adding a course, `SemesterPlanner.handleAddCourse` calls `resolveAddAssignment` and writes the result into `planAssignments`. This means an automatic suggestion becomes indistinguishable from an explicit user selection.

Expected behavior: `planAssignments` should represent explicit user choices or backend auto-balance output only. Lightweight frontend suggestions should remain derived display state.

Root cause: `setAssignment(courseId, resolveAddAssignment(...))` persists add-time suggestions into the same state used for manual assignments.

### Frontend display can overfill areas from stored assignments

`PlannerFeedback.buildPlannerProgressAreas` uses `manualOption ?? automaticOption`. A stored assignment is honored without checking capacity. This is useful for intentional manual overrides, but it also means stale automatic assignments can put courses into an already full area instead of moving them to `Needs assignment`.

Expected behavior: true manual overrides may overfill and show an over-capacity warning. Stale automatic assignments should not be treated as manual intent.

Root cause: frontend state does not track assignment source, so stale automatic assignments and manual choices have the same meaning.

### Unassigned backend results can be filled back in

When the backend returns a partial balance result, `SemesterPlanner` calls `setAssignments(result.assignments)`. Then the edit-mode effect can calculate `getSuggestedPlannerAssignment` for missing assignments and write them back into `planAssignments`.

Expected behavior: if backend Balance planner says a course is unassigned due to capacity, that course should stay in `Needs assignment` until the user manually overrides it or changes the plan.

Root cause: the edit-mode effect auto-fills missing assignments. It should only clear invalid assignments, not create new ones after balance.

### Backend and frontend algorithms can disagree

The backend uses backtracking. The Regulation outlook display uses a frontend greedy pass sorted by option count and course order, then alphabetically chooses the first option with capacity. This can make the visible planner result depend on add order or list order.

Expected behavior: the UI should show one deterministic plan-level resolution that matches backend Balance planner priorities, or it should treat backend balance output as authoritative after the action.

Root cause: there are two independent assignment algorithms with different tie-breakers and different capacity behavior.

## Solution Plan

### Backend

- Update `_score_solution` in `backend/src/services/planner_assignments.py`.
- Keep the first priority as maximizing assigned course count.
- Add a stronger balance-quality metric before preference preservation:
  - prefer filling areas with remaining required/capacity gaps instead of piling into one area;
  - prefer lower maximum area fill ratio when multiple areas are open;
  - prefer fewer avoidable empty compatible areas for planned ambiguous courses.
- Keep existing preferences as a later tie-breaker, not as the main balance driver.
- Keep deterministic final tie-breakers based on rule-group sort order and course id.

### Frontend state

- Change add-course behavior so automatic suggestions are not stored in `planAssignments`.
- Keep `planAssignments` for explicit manual selections and backend auto-balance output.
- Narrow the edit-mode effect in `SemesterPlanner.tsx` so it only removes invalid assignments. It must not fill missing assignments.
- When backend balance returns partial assignments, preserve that missing assignments are intentionally unassigned for display.

### Frontend display

- Replace `PlannerFeedback`'s per-course greedy placement with a plan-level resolver that mirrors backend priorities, or treat backend balance output as authoritative after the user clicks Balance planner.
- Use `studyAreaOptions[].ectsCounted` when available for planned ECTS math so frontend display matches backend mapping ECTS.
- Keep manual override behavior: compatible manual choices may overfill an area, but the area must clearly show the over-capacity warning.

## Test Plan

### Backend unit-style cases

- `978 + 1006`, no completed ECTS: expect one course in `INFO-THEO` and one in `INFO-INFO`.
- `INFO-INFO = 18`, planned `978 + 1006`: expect both courses in `INFO-THEO`.
- `INFO-THEO = 18`, `INFO-INFO = 9`, planned `978 + 1006`: expect one course assigned to `INFO-INFO`, one course unassigned with `capacity_unassigned`.
- Preferences pointing both ambiguous courses to one area must not win over a better balanced valid composition.

### Frontend/manual checks

- Add `978`, `964`, `1022`, and `1006` in multiple orders. The Regulation outlook must remain deterministic and capacity-safe for automatic placement.
- Click Balance planner after creating an impossible capacity case. Courses returned as unassigned by the backend must stay in `Needs assignment`.
- Manually force a compatible over-capacity assignment. The selected area must show an over-capacity warning and the assignment must remain visible.
- Save and reload a balanced plan. Saved backend balance assignments must persist, and unassigned courses must not be silently filled on reload.

### Commands

Run these after code fixes:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
```

If backend tests are added, run the new backend test command documented with that change.

## Assumptions

- No production dependency changes are needed.
- Local validation can use the existing Wrangler D1 database and temporary local user data.
- Tracked seed data should not be changed for this bug fix.
- This report is documentation-only; implementation fixes should be made in a separate logical commit.

## Implementation Update

### 2026-06-06

- Updated backend balance scoring so assigned-course count still wins first, but balanced area distribution now wins before preserving previous planner preferences.
- Stopped storing add-time automatic suggestions as planner assignments. The planner now stores explicit user choices and backend Balance planner results.
- Narrowed the edit-mode cleanup effect so it removes invalid stored assignments but does not auto-fill missing assignments.
- Replaced the Regulation outlook's one-course-at-a-time greedy display placement with a plan-level resolver that uses mapped `ectsCounted` values when available.
- Kept manual compatible over-capacity selections visible, with the existing over-capacity warning.

Validation performed:

- Backend `_balance_assignments` temporary validation passed for:
  - `978 + 1006` empty areas -> split across `INFO-THEO` and `INFO-INFO`
  - both courses preferred as `INFO-INFO` -> still split across both areas
  - `INFO-INFO = 18` -> both ambiguous courses assigned to `INFO-THEO`
  - `INFO-THEO = 18`, `INFO-INFO = 9` -> one assigned to `INFO-INFO`, one `capacity_unassigned`
  - unknown and unmapped local test courses -> remain unassigned with `unknown_course` and `unmapped_course` warnings
- `npm --prefix frontend run lint` passed.
- `npm --prefix frontend run build` passed.
- `http://localhost:5173/` returned HTTP 200.
- In-app browser automation could not be completed because the browser helper process was blocked by the local sandbox during startup.
