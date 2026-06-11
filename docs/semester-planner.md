# Semester Planner Model and API

This note defines the backend shape for account-based weekly semester plans after the user-schema reduction.

## Goal

A signed-in student can save one planned weekly schedule per semester. The planner does not invent new course times; it stores which courses are in the plan and derives the visible weekly grid from course schedule data already present in D1.

## Data model

Semester plans are stored inside `user_state.semester_plans_json`. The JSON value is an object keyed by semester label.

Each semester entry contains:

- `semesterLabel` – for example `SS 2026`
- `title` – optional display title
- `notes` – optional free text
- `courseIds` – selected catalog course ids as strings
- `courseAssignments` – optional course-id to regulation-area mapping
- `hiddenSlotIds` – optional hidden schedule slots
- `createdAtUnix`, `updatedAtUnix`

This replaces the old per-plan tables and keeps all account/planner state in `user_state`.

## Why this is enough

- the real weekly slots already exist in `appointments` / `parallel_groups`
- a saved semester plan only needs the selected course set plus small UI metadata
- overlap detection can be computed from the stored course ids plus public schedule data
- the model stays small and easy to export as account state

## API

### `GET /api/me/semester-plans`

Returns the list of saved semester headers for the current user.

### `GET /api/me/semester-plans/<semester_label>`

Returns one semester plan plus its selected course ids.

### `PUT /api/me/semester-plans/<semester_label>`

Creates or replaces the saved plan for one semester.

Request body:

```json
{
  "title": "My SS 2026 plan",
  "notes": "optional",
  "courseIds": ["964", "978", "1006"],
  "courseAssignments": {"964": "INFO"},
  "hiddenSlotIds": []
}
```

### `DELETE /api/me/semester-plans/<semester_label>`

Removes one saved semester plan.

## Frontend contract

The frontend planner combines:

- favorite courses as draggable candidates
- public catalog schedule data for rendering the grid
- saved course ids from the semester-plan API for persistence

This keeps the planner aligned with the reduced user schema and avoids duplicating schedule logic in separate user-specific tables.
