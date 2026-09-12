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
