# Semester planner model and API

A signed-in student can save a weekly plan per semester. The frontend combines
catalog appointments with selected courses, hidden slots and optional manual
slots. Changes are automatically saved after a debounce; there is no separate
edit/save workflow.

## Storage

Plans live in user_state.semester_plans_json, keyed by semester label. Each entry
contains semesterLabel, optional title/notes, courseIds, courseAssignments,
hiddenSlotIds, manualSlots, createdAtUnix and updatedAtUnix.

The current API still uses numeric catalog IDs, serialized as strings in its
responses. Those IDs are not stable across ALMA reseeds. Do not copy that legacy
pattern into new user-generated data: use stable ALMA course keys as described in
[runtime configuration](cloudflare-runtime-config.md#catalog-refresh).

## Routes

All routes require a session; mutations require X-CSRF-Token.

| Method and path | Behavior |
| --- | --- |
| GET /api/me/semester-plans | List saved semester headers |
| GET /api/me/semester-plans/<semester> | Read a saved plan |
| PUT /api/me/semester-plans/<semester> | Create or replace a plan |
| DELETE /api/me/semester-plans/<semester> | Remove a plan |
| POST /api/me/semester-plans/<semester>/balance | Calculate regulation assignments without saving |

A PUT body has this shape (IDs and area codes are illustrative; use current
catalog IDs and compatible regulation codes):

```json
{
  "title": "My semester",
  "notes": null,
  "courseIds": ["964", "978"],
  "courseAssignments": {"964": "INFO-INFO"},
  "hiddenSlotIds": [],
  "manualSlots": [
    {"id": "manual-964", "courseId": "964", "day": "Monday", "time": "10:00-12:00"}
  ]
}
```

Manual slots may also include room and label. Save validation rejects unknown
course IDs and normalizes stored assignments against the selected regulation.

## Semester-specific Interested lists

Interested is not a global wishlist. Each semester has its own list in
`user_state.favorites_json`, keyed by semester label. Membership uses stable,
normalized ALMA course numbers (`COALESCE(number, unit_id)`), not numeric row IDs.
The API resolves those keys to current catalog IDs and returns alias groups so
stars also match period-specific course rows after a catalog reseed.

- `GET /api/me/favorites?semesterLabel=WS%202026%2F27` reads only that semester.
- `PUT /api/me/favorites` accepts `semesterLabel` and `favoriteCourseIds`.
- Responses contain `semesterLabel`, `favoriteCourseIds`, `favoriteCourseGroups`
  and `count` (logical courses, not the number of row aliases).
- A semester label is required. Older cached clients receive a reload error
  rather than an empty global list that their legacy pruning code could use to
  delete courses from the running semester.
- Writes replace only the selected semester's list, even when another device is
  working on a different semester.

The catalog defaults to the existing planning window: it switches to summer on
March 1 and winter on September 1. A new semester has no stars or automatically
copied courses; previous lists, saved plans and completed courses remain intact.
There is no requirement to complete the previous semester. The semester hub's
existing earlier visibility window is unchanged. The introduction tour opens
this same planning semester; its hub steps still stay on the semester overview.
Auto-Balance and its feedback are available in the planning semester, including
March/September before that term begins. Other semester plans remain accessible
without the automatic balancing control.

An explicit semester plan uses that semester's Interested list. Its catalog
link carries `?semester=<label>`; catalog detail drawers preserve that scope.
Past plans link to their archived Interested list without adding another calendar
column. The catalog shows which semester its stars affect and offers a link back
to the current planning semester. Adding/removing a star updates only its own
semester's plan. Loading an Interested list no longer prunes an existing plan.

Legacy global lists migrate lazily: stars are assigned to saved semesters where
that course already appears in the plan. Unassigned stars remain in the running
semester rather than being copied into the upcoming planning semester. The
original array is retained as `__legacyCourseIds` for recovery; old course IDs
that no longer exist cannot be reliably mapped after a reseed. Existing plans
are never rewritten by migration, and a course's outcome is never inferred.

## Regulation balancing

The balance request accepts courseIds and optional courseAssignments. Its response
contains assignments, warnings, unassignedCourseIds, summary and strictSolutionFound.
It uses explicit regulation mappings, completed ECTS and effective area capacity
(maxEcts when present, otherwise requiredEcts).

The backend favors assigning courses and balanced area distribution before
preserving previous preferences. Incompatible or capacity-limited courses can
remain unassigned. Compatible manual assignments may overfill an area and produce
a visible warning. The balance endpoint itself does not persist; the frontend
adopts its result into the plan and uses normal autosave.

Known API limitation retained from earlier QA: strictSolutionFound describes the
searchable course set, so unknown/unmapped requested courses can still appear in
warnings while that flag is true. Consumers must also inspect warnings and
unassignedCourseIds.

## Source references

- [Persistence and slot validation](../backend/src/services/user_semester_plans.py).
- [Backend balancing](../backend/src/services/planner_assignments.py).
- [Frontend state and autosave](../frontend/src/features/planner/hooks/useSemesterPlanner.ts).
- [Authentication](authentication.md) and [mobile checklist](mobile-testing.md).
