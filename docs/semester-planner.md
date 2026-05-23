# Semester Planner Model and API

This note defines the minimum backend shape for account-based weekly semester plans.

## Goal

A signed-in student can save one planned weekly schedule per semester.
The planner does not invent new course times; it stores **which courses are in the plan** and derives the visible weekly grid from the course schedule data already present in D1.

## Minimum data model

### `user_semester_plans`

One saved plan header per user and semester.

Fields:

- `user_id`
- `semester_label` – for example `SS 2026`
- `title` – optional display title
- `notes` – optional free text
- timestamps

Constraint:

- one row per `(user_id, semester_label)`

### `user_semester_plan_courses`

The planned catalog courses that belong to one semester plan.

Fields:

- `plan_id`
- `course_id`
- `position` – keeps a stable manual order for the side panel
- timestamps

Constraint:

- one row per `(plan_id, course_id)`

## Why this is enough

- the real weekly slots already exist in `appointments` / `parallel_groups`
- a saved semester plan only needs the selected course set
- overlap detection can be computed from the stored course ids plus the public schedule data
- the model stays small and easy to migrate

## Minimum API

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
  "courseIds": ["964", "978", "1006"]
}
```

### `DELETE /api/me/semester-plans/<semester_label>`

Optional cleanup endpoint for removing one saved semester plan.

## Frontend contract

The frontend planner combines:

- favorite courses as draggable candidates
- public catalog schedule data for rendering the grid
- the saved course ids from the semester-plan API for persistence

This keeps the planner aligned with the existing data model and avoids duplicating schedule logic in user-specific tables.
