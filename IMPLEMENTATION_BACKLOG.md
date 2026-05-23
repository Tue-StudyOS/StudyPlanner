# Implementation Backlog

This file is the persistent checklist for upcoming product work.

## Working rules

- Keep completed items in this file and mark them with `[x]`.
- Treat each unchecked item below as one separate git commit.
- If a task grows too large during implementation, split it into smaller follow-up items before coding.
- Optional: append the commit hash when marking an item as done, for example: `[x] 1.3 Switch the frontend course overview to the Worker API. (commit: abc1234)`.
- Do not start the transcript-import implementation section until it is explicitly reprioritized.

## Current baseline

- The frontend course catalog still reads mock/bootstrap data from `backend/data/courses.json`.
- The Worker API already exposes `GET /api/courses`, `GET /api/courses/<id>`, and `GET /api/study-programs`.
- Favorites are currently stored only in browser `localStorage`.
- Completed courses / transcript state are currently stored only in browser `localStorage`.

## Suggested implementation order

1. Database-backed course catalog
2. Examination regulations and study-program mapping
3. Accounts and personal data foundation
4. Favorites persistence
5. Study-progress calculation and visualization
6. Transcript of Records planning, later implementation

## Dependencies

- Section 4 depends on section 3.
- Section 5 depends on sections 2 and 3.
- Section 6 should stay parked until sections 1 to 5 are stable enough.

## 1. Database-backed course catalog

- [x] 1.1 Confirm which catalog fields the frontend still needs beyond the current `/api/courses` response.
- [x] 1.2 Extend the Worker API wherever required so the course catalog can run without mock JSON.
- [x] 1.3 Switch the frontend course overview from `backend/data/courses.json` to the Worker API.
- [x] 1.4 Switch course detail and related catalog views to the API-backed flow.
- [x] 1.5 Remove the remaining mock-data dependency from the catalog path.

## 2. Examination regulations and study-program mapping

- [ ] 2.1 Define the minimum data model for examination regulations, versions, and rule groups.
- [ ] 2.2 Add the database migration for regulations and regulation-to-course mappings.
- [ ] 2.3 Seed the first supported examination regulations into the database.
- [ ] 2.4 Expose regulation-aware course categorization through the API.
- [ ] 2.5 Define how study programs map to regulation versions in the backend model.

## 3. Accounts and personal data foundation

- [ ] 3.1 Decide and document the authentication approach.
- [ ] 3.2 Add the database migration for users, profiles, and personal study data.
- [ ] 3.3 Implement backend account creation, sign-in, and session handling.
- [ ] 3.4 Implement the frontend account flow.
- [ ] 3.5 Store the user's selected study program and regulation in the profile.

## 4. Favorites persistence

- [ ] 4.1 Add backend endpoints for reading and updating favorite courses.
- [ ] 4.2 Replace browser-only favorites storage with authenticated persistence.
- [ ] 4.3 Add loading and error handling for favorites synchronization.

## 5. Study-progress model and visualization

- [ ] 5.1 Define the visualization categories, for example machine learning, vision, and mathematics.
- [ ] 5.2 Map courses to visualization categories, ideally on top of the regulation model.
- [ ] 5.3 Replace browser-only completed-course storage with account-based persistence.
- [ ] 5.4 Implement a single source of truth for per-category progress calculation.
- [ ] 5.5 Build the specialization-circle visualization in the frontend.
- [ ] 5.6 Connect the visualization to persisted user data.

## 6. Later: Transcript of Records import

- [ ] 6.1 Define scope, privacy requirements, and acceptance criteria for transcript PDF upload.
- [ ] 6.2 Evaluate PDF extraction and parsing options.
- [ ] 6.3 Design the matching workflow between transcript entries and known courses.
- [ ] 6.4 Define how uncertain matches are reviewed and confirmed by the student.
- [ ] 6.5 Implement transcript upload, matching, and progress sync.

> Hold this section until the earlier foundations are stable.
