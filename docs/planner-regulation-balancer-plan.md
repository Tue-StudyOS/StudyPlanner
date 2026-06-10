# Manual INstructions from Human
Creat a new branch `planner

# Planner Regulation Assignment Balancer Plan

## Feature Goal

When a user adds favorite courses to the semester planner, the planner should show which examination-regulation area each planned course counts toward. If a course can count toward multiple areas, the app should initially choose a sensible area from database-backed regulation mappings, avoid overfilling an area when another compatible area has capacity, and still let the user change the assignment manually.

The planner should also provide an auto-balance action that computes the best valid assignment composition for all planned courses. If no valid composition exists, the user should receive a clear warning explaining why.

The feature must stay generic. It must work from the regulation tables and course mappings, not from hardcoded M.Sc. Informatik codes such as `INFO-PRAK`, `INFO-TECH`, or `INFO-INFO`.

## Current State

Relevant existing files:

- `backend/migrations/0002_regulation_model.sql` defines `regulation_versions`, `regulation_rule_groups`, and `regulation_course_mappings`.
- `backend/migrations/0007_semester_plans.sql` defines saved semester plans.
- `backend/migrations/0008_plan_course_assignments.sql` already adds `study_area_code` to `user_semester_plan_courses`.
- `backend/src/services/user_semester_plans.py` persists `courseAssignments` but currently validates only that course IDs exist.
- `backend/src/services/user_completed_courses.py` already has useful assignment-validation logic for completed courses.
- `frontend/src/features/planner/utils/plannerAssignments.ts` currently assigns greedily in the frontend.
- `frontend/src/features/planner/components/PlannerFeedback.tsx` already renders the Regulation outlook.
- `frontend/src/features/planner/components/PlannerFavoritesPanel.tsx` already exposes a compact `Counts as` select for favorites.
- `frontend/src/shared/utils/regulation.ts` currently builds area options, including broad fallback options.

Observed local data for `MSC_INFO_2021`:

- `INFO-PRAK`, `INFO-TECH`, `INFO-THEO`, `INFO-INFO`, `INFO-FOKUS`, and `INFO-BASIS` each have `required_ects = 18`.
- `THESIS` has `required_ects = 30`.
- `max_ects` is currently null for these groups, so capacity handling needs an explicit generic rule.
- Ambiguous mapped courses exist. Example from local SQLite: course `978` `Datenstrukturen` maps to `INFO-INFO` and `INFO-THEO`.

## Design Principles

- Use `regulation_course_mappings` and `regulation_rule_groups` as the source of truth.
- Keep completed-course assignments fixed; planner balancing should not mutate transcript/completed-course data.
- Store only explicit user/planner choices in `user_semester_plan_courses.study_area_code`.
- Treat automatic assignments as derived until saved.
- Do server-side validation before persisting assignments.
- Avoid a M.Sc. Informatik-only implementation. M.Sc. Informatik is just the first concrete use case.

## Data Model Plan

No new table is required for the first implementation because `user_semester_plan_courses.study_area_code` already exists.

Recommended migration:

- Add an index on `(plan_id, study_area_code)` if planner assignment queries become backend-driven.
- Do not add enum-like category constants for `INFO-*` areas.
- Consider a later migration to backfill `regulation_rule_groups.max_ects` from regulation source data. For now, derive capacity generically.

Capacity rule:

- Use `max_ects` when present.
- Otherwise, for capped progress areas use `required_ects` as capacity.
- For areas with neither `max_ects` nor `required_ects`, treat capacity as unbounded.
- Exclude thesis-like groups from planner course assignment unless the course is explicitly mapped to them and the UI later supports thesis planning.

The first implementation should define this as a shared backend/frontend concept, for example `effectiveCapacityEcts`, so the UI and backend do not drift.

## Backend Plan

### 1. Add Planner Assignment Domain Helpers

Create a small backend helper module, for example `backend/src/services/planner_assignments.py`.

Responsibilities:

- Load the authenticated user profile and active `regulation_version_id`.
- Load rule groups for the active regulation.
- Load allowed course-to-rule-group options from `regulation_course_mappings`.
- Validate that a submitted `study_area_code` belongs to the active regulation.
- Validate that a submitted `study_area_code` is compatible with the submitted course.
- Compute effective capacity from rule-group fields.

This should reuse or extract logic from `user_completed_courses.py` where possible, especially:

- `_load_rule_groups_for_regulation`
- `_load_course_rule_group_options`
- flexible-area detection
- rule-group-code to master-category mapping

Do not copy large blocks blindly. Extract shared regulation assignment helpers if the code becomes duplicated.

### 2. Validate Semester Plan Assignments on Save

Update `replace_current_user_semester_plan` in `backend/src/services/user_semester_plans.py`.

Validation behavior:

- Reject unknown course IDs as today.
- Drop assignment entries for courses not present in `courseIds`.
- Reject assignment codes that are not part of the user's active regulation.
- Reject assignment codes that are not in the course's allowed mapped regulation areas.
- If a course has exactly one compatible area and no assignment is sent, the backend may store null and let serialization derive it, or store the single assignment. Prefer storing only explicit assignments to keep persistence clear.
- If there is no active regulation, allow saving the course plan but ignore/clear assignments.

This prevents stale frontend state or manipulated API requests from saving invalid assignments.

### 3. Add an Auto-Balance Endpoint

Add an authenticated endpoint:

```text
POST /api/me/semester-plans/<semester_label>/balance
```

Request body:

```json
{
  "courseIds": ["978", "1006"],
  "courseAssignments": {
    "978": "INFO-INFO"
  }
}
```

Response body:

```json
{
  "assignments": {
    "978": "INFO-THEO",
    "1006": "INFO-INFO"
  },
  "warnings": [],
  "unassignedCourseIds": [],
  "summary": [
    {
      "areaCode": "INFO-THEO",
      "plannedEcts": 6,
      "creditedEcts": 12,
      "capacityEcts": 18
    }
  ]
}
```

The endpoint should compute assignments but not save them. The frontend applies the returned assignments locally, and the existing Save semester action persists them. This keeps the action reversible and consistent with existing unsaved planner changes.

### 4. Backend Balancing Algorithm

Inputs:

- Planned catalog courses.
- Course ECTS from catalog/module data.
- Active regulation rule groups.
- Existing completed courses and their `study_area_code`.
- Course-compatible rule groups from `regulation_course_mappings`.
- Current planner assignments as optional preferences.

Constraints:

- A course can be assigned to exactly one compatible rule group.
- Completed course ECTS already consume capacity.
- Planned ECTS should not exceed effective capacity where capacity exists.
- Courses already completed should not add planned ECTS again.
- A course with no compatible regulation mapping should remain unassigned and produce a warning.

Optimization priority:

1. Maximize number of assigned planned courses.
2. Minimize capacity overflows.
3. Prefer assignments that satisfy remaining required/capacity gaps.
4. Prefer existing manual planner assignments when they are still valid.
5. Use regulation `sort_order` as deterministic tie-breaker.

Algorithm choice:

- Use bounded backtracking or dynamic programming, not a simple greedy sort.
- The number of planned courses is small enough for exhaustive search with pruning in normal planner use.
- Sort courses with the fewest compatible options first to reduce search space.
- Track area totals incrementally and prune branches that exceed capacity.
- If all branches fail under strict capacity, return no strict solution and include the closest diagnostic result.

Important distinction:

- The "add one course" default can use a lightweight single-course resolver.
- The "Auto-balance" button should use the full composition algorithm.

## Frontend Plan

### 1. Replace Greedy-Only Assignment Logic

Refactor `frontend/src/features/planner/utils/plannerAssignments.ts`.

Keep helper functions for:

- getting compatible area options for a course
- resolving stored/manual assignment validity
- computing current planned/credited totals for display

Change the default suggestion rule:

- First prefer valid existing assignment.
- Else choose the first compatible area that has remaining capacity.
- If all compatible areas are full, choose none and show an overflow warning instead of silently overfilling.
- Use regulation `sortOrder` and option order for deterministic fallback.

Do not use fallback-to-all-selectable areas for catalog courses that have no concrete regulation mapping. That fallback is risky for planner correctness. If broad flexible assignment is needed later, make it explicit from backend metadata.

### 2. Show Assignments in Regulation Outlook

Extend `PlannerFeedback.tsx`.

Target UI behavior:

- Each Regulation outlook area shows planned course chips as today.
- Each planned course chip should show the assigned area code/name.
- When editing, each planned course should have a compact select to change its assignment.
- If a planned course has multiple compatible areas, make that visible.
- If a course cannot be assigned, show it in a warning section instead of hiding it from the outlook.
- If an area exceeds capacity, show the row in warning tone with text like `Over capacity by 3 ECTS`.

Props to add:

- `isEditing`
- `onSetAssignment`
- possibly `assignmentWarnings`

### 3. Add Auto-Balance Button

Place the button in the Regulation outlook header, not only in the favorites panel. The user should be able to balance after building a plan.

Behavior:

- Enabled only in edit mode.
- Calls the new backend balance endpoint with current unsaved `courseIds` and `courseAssignments`.
- Applies returned assignments to local `planAssignments`.
- Keeps the plan unsaved until the user clicks Save semester.
- Shows success text when assignments changed.
- Shows warning text if no valid strict composition exists.

Recommended button label:

```text
Auto-balance areas
```

### 4. Keep Manual Control Clear

Manual assignment changes should update `planAssignments` immediately.

If the user manually chooses an area that causes over-capacity:

- Allow the local selection while editing.
- Show the over-capacity warning.
- Let Save fail only if the assignment is incompatible with the regulation mapping, not merely because it exceeds capacity.

Reasoning: over-capacity may still be useful as planning information, while incompatible category storage is data corruption.

## API and Type Changes

Frontend types:

- Extend `RegulationRuleGroup` with `minEcts`, `maxEcts`, and derived capacity handling.
- Add planner balance request/response types in `frontend/src/features/planner/api.ts`.
- Add warning types for unassigned, overflow, and incompatible assignment states.

Backend serialization:

- Consider adding planner assignment metadata to semester-plan responses later, but not required for the first version.
- The frontend already has catalog courses and active regulation version loaded, so the first implementation can compute display state client-side and use the balance endpoint only for composition.

## Data Quality Follow-Up

The local M.Sc. Informatik mapping coverage appears incomplete in `backend/data/alma.sqlite`: only `INFO-BASIS`, `INFO-INFO`, and `INFO-THEO` had mapped courses in the quick inspection. The feature can still be implemented correctly, but useful planner behavior depends on complete `regulation_course_mappings`.

Follow-up data tasks:

- Verify the scraper/import path for the Alma subsection:
  `M.Sc. Informatik / Computer Science (Version 2021)`.
- Ensure modules from the Modulhandbuch populate `curriculum_modules`, `study_areas`, `module_study_area_options`, and `regulation_course_mappings`.
- Add a data audit command that reports per-regulation mapping counts by rule group.
- Do not patch missing mappings in frontend code.

## Implementation Steps

1. Extract backend regulation assignment helpers from completed-course service logic.
2. Add server-side validation for planner `courseAssignments` in semester-plan save.
3. Add backend planner balance service and route.
4. Add frontend API client for balance endpoint.
5. Refactor planner assignment utilities around compatible options and effective capacity.
6. Extend Regulation outlook with assignment controls, overflow warnings, and unassigned-course warnings.
7. Add Auto-balance button and wire it to local planner state.
8. Update docs for planner assignment behavior and API.

## Verification Plan

Backend:

- Add tests or lightweight service-level checks for valid assignment, invalid area code, incompatible course-area pair, no active regulation, and duplicate/missing course IDs.
- Test balance with a course that maps to two areas and one area already full from completed courses.
- Test impossible composition returns warnings instead of a misleading assignment.

Frontend:

- Run `npm --prefix frontend run lint`.
- Run `npm --prefix frontend run build`.
- Manually verify `/planner` with user `test2` on the deployed or local app:
  - add a favorite with one mapping
  - add a favorite with multiple mappings
  - manually change the assignment
  - trigger over-capacity
  - run Auto-balance
  - save and reload the semester plan

Deployment:

- Apply D1 migrations locally first.
- Deploy backend if routes or validation changed.
- Deploy frontend after backend route is available.
- If Cloudflare Pages automatic deployment is configured, merging to `main` should trigger frontend deployment; otherwise use the documented deploy command.

## Risks and Decisions

- `required_ects` as capacity is a pragmatic default, but some regulations may allow overfilling or only define minimums. Long-term, source data should populate `max_ects` where the regulation is truly capped.
- Existing frontend fallback logic can make unmapped courses look assignable. For planner correctness, the implementation should prefer explicit DB mappings.
- If mappings are incomplete, Auto-balance will correctly warn rather than invent categories. That is a data issue, not a planner-algorithm issue.
- The first balancing endpoint should compute but not persist. This avoids surprising saves and keeps the existing edit/save workflow intact.

## Implementation Log

### 2026-06-05

- Added `backend/src/services/planner_assignments.py` as the planner-regulation assignment service.
- Implemented active-regulation rule-group loading, course mapping loading, save-time assignment validation, capacity calculation, and a bounded backtracking balancer.
- Wired `replace_current_user_semester_plan` to validate `courseAssignments` before persisting `user_semester_plan_courses.study_area_code`.
- Added `POST /api/me/semester-plans/<semester_label>/balance` before the generic semester-plan route so `/balance` is routed correctly.
- Added the frontend `balanceSemesterPlan` API client and planner state support for bulk assignment replacement.
- Changed planner assignment options to use explicit mapped course areas instead of the previous all-flexible fallback.
- Added frontend effective capacity handling with `maxEcts ?? requiredEcts`.
- Extended Regulation outlook with auto-balance, per-course assignment selects, unassigned-course warnings, and over-capacity warnings.
- Kept the balance action non-persistent: it updates unsaved planner state and still requires `Save semester`.
- Removed the successful auto-balance message box, kept warning/error messages, and made the Balance planner button visible outside edit mode with the edit-required hover hint.
- Changed Regulation outlook placement so fixed/single-option planned courses consume capacity first and flexible courses move to `Needs assignment` when no mapped area has enough remaining capacity.
- Relaxed the Regulation outlook capacity rule for manual assignments: automatic placement stays capacity-safe, but a user-selected compatible area is honored even if it temporarily overfills the area.
- Moved Regulation outlook into the main planner column directly below the weekly schedule, removed the separate Planned ECTS card, and folded planned ECTS/course count into the Regulation outlook header.
- Removed planner draft persistence while keeping the compact in-header "Unsaved semester draft" indicator for current in-memory changes.
- Audited branch cleanup and extracted duplicated backend regulation rule-group/course-option SQL loaders into `services/regulation_assignment_options.py`.
