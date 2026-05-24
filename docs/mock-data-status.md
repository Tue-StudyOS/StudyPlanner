# Mock Data Status

## Current runtime status

The public course catalog no longer reads `backend/data/courses.json` at runtime.

### API-backed entry points

These entry points already load from the Worker API / D1 database:

- catalog overview
- course detail view
- favorites page course cards
- public study-program and regulation data endpoints

### Remaining mock / bootstrap data

The repository still contains a few non-catalog bootstrap sources:

- `backend/data/courses.json`
  - kept as a legacy reference file
  - not used by the current frontend runtime anymore
- `frontend/src/features/transcript/initialCompletedCourses.ts`
  - still seeds example completed-course data for the transcript/progress area until the account-backed progress flow is fully wired

## Practical conclusion

- signed-out visitors now get the public catalog from the database-backed API
- the remaining mock data is limited to temporary personal-progress bootstrap data, not the course catalog itself
