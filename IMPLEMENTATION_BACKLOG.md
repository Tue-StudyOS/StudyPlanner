# Implementation Backlog

This file is the persistent checklist for upcoming product work.

## Working rules

- Keep completed items in this file and mark them with `[x]`.
- Treat each unchecked item below as one separate git commit.
- If a task grows too large during implementation, split it into smaller follow-up items before coding.
- Optional: append the commit hash when marking an item as done, for example: `[x] 1.3 Switch the frontend course overview to the Worker API. (commit: abc1234)`.
- Do not start the transcript-import implementation section until it is explicitly reprioritized.

## Current baseline

- The public course catalog already reads from the Worker API and D1.
- Temporary bootstrap data still exists for personal-progress example state.
- The Worker API already exposes `GET /api/courses`, `GET /api/courses/<id>`, and `GET /api/study-programs`.
- Favorites are currently stored only in browser `localStorage`.
- Completed courses / transcript state are currently stored only in browser `localStorage`.
- The signed-out visitor flow is not yet explicitly hardened; personalized areas still need clear empty states without mandatory login.
- There is no semester-specific weekly planner yet.

## Suggested implementation order

1. Database-backed course catalog
2. Examination regulations and study-program mapping
3. Accounts and personal data foundation
4. Favorites persistence
5. Study-progress calculation and visualization
6. Semester planner / weekly schedule
7. Transcript of Records planning, later implementation

## Dependencies

- Section 4 depends on section 3.
- Section 5 depends on sections 2 and 3.
- Section 6 depends on sections 2, 3, 4, and 5.
- Section 7 should stay parked until sections 1 to 6 are stable enough.

## 1. Database-backed course catalog

- [x] 1.1 Confirm which catalog fields the frontend still needs beyond the current `/api/courses` response.
- [x] 1.2 Extend the Worker API wherever required so the course catalog can run without mock JSON.
- [x] 1.3 Switch the frontend course overview from `backend/data/courses.json` to the Worker API.
- [x] 1.4 Switch course detail and related catalog views to the API-backed flow.
- [x] 1.5 Remove the remaining mock-data dependency from the catalog path.
- [x] 1.6 Reconcile the remaining `backend/data/courses.json` bootstrap usage with the completed API migration and document which entry points still show mock data.
- [ ] 1.7 Ensure first-time signed-out visitors load the public catalog only from API/database data, without any personal setup.

## 2. Examination regulations and study-program mapping

- [x] 2.1 Define the minimum data model for examination regulations, versions, and rule groups.
- [x] 2.2 Add the database migration for regulations and regulation-to-course mappings.
- [x] 2.3 Seed the first supported examination regulations into the database.
- [x] 2.4 Expose regulation-aware course categorization through the API.
- [x] 2.5 Define how study programs map to regulation versions in the backend model.

## 3. Accounts and personal data foundation

- [x] 3.1 Decide and document the authentication approach.
- [x] 3.2 Add the database migration for users, profiles, and personal study data.
- [x] 3.3 Implement backend account creation, sign-in, and session handling.
- [x] 3.4 Implement the frontend account flow.
- [x] 3.5 Store the user's selected study program and regulation in the profile.
- [x] 3.6 Make authentication optional for browsing so signed-out visitors can still see the full public course and study-program data.
- [x] 3.7 Add signed-out empty states for favorites, progress, and other personalized modules instead of forcing account creation.

## 4. Favorites persistence

- [x] 4.1 Add backend endpoints for reading and updating favorite courses.
- [x] 4.2 Replace browser-only favorites storage with authenticated persistence.
- [x] 4.3 Add loading and error handling for favorites synchronization.

## 5. Study-progress model and visualization

- [ ] 5.1 Define the visualization categories, for example machine learning, vision, and mathematics.
- [ ] 5.2 Map courses to visualization categories, ideally on top of the regulation model.
- [ ] 5.3 Replace browser-only completed-course storage with account-based persistence.
- [ ] 5.4 Implement a single source of truth for per-category progress calculation.
- [ ] 5.5 Build the specialization-circle visualization in the frontend.
- [ ] 5.6 Connect the visualization to persisted user data.

## 6. Semester planner / weekly schedule

- [ ] 6.1 Define the minimum data model and API for semester-specific weekly plans per account.
- [ ] 6.2 Add a planning mode that shows the user's favorite courses as draggable schedule candidates.
- [ ] 6.3 Build drag-and-drop placement into a weekly grid with course times and overlap highlighting.
- [ ] 6.4 Show live planning feedback, for example elective-block coverage, ECTS totals, and scheduled course times, while editing.
- [ ] 6.5 Add semester switching and persist one saved plan per semester in the account.
- [ ] 6.6 Add an explicit edit button that reveals the favorites list only in planning mode.
- [ ] 6.7 Keep the favorites picker a fixed-size side panel or equally smooth arrow-based flow that fits the existing interaction pattern.
- [ ] 6.8 Match all planner UI components to the current visual style.

## 7. Later: Transcript of Records import

- [ ] 7.1 Define scope, privacy requirements, and acceptance criteria for transcript PDF upload.
- [ ] 7.2 Evaluate PDF extraction and parsing options.
- [ ] 7.3 Design the matching workflow between transcript entries and known courses.
- [ ] 7.4 Define how uncertain matches are reviewed and confirmed by the student.
- [ ] 7.5 Implement transcript upload, matching, and progress sync.

> Hold this section until the earlier foundations are stable.
