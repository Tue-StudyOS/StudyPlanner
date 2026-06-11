# Catalog API Field Audit

This note confirms which fields the frontend needs before the course catalog can stop reading `backend/data/courses.json`.

## Current frontend usage

### Catalog overview cards

The current overview and favorites cards need these fields:

- stable course id
- course number
- title
- lecturer display names
- first room / location hint
- course type labels
- ECTS
- first schedule slot
- regulation / category badges when available

### Course detail view

The detail flow needs these fields:

- all overview fields
- full schedule
- language
- semester hours
- short description / relevant content sections
- prerequisites
- exams / assessment dates
- registration period
- detail links
- regulation-aware study-area options

## Gap against the current Worker API

The old `GET /api/courses` route only returns lightweight D1 rows and does not yet provide:

- aggregated lecturers
- first room / first schedule slot
- frontend-ready type labels
- ECTS fallback from curriculum matches
- regulation badges / study-area options
- a frontend-focused response shape that can replace the old mock JSON directly

## Resulting implementation target

The API cutover should use these public catalog responses:

1. `GET /api/catalog/courses`
   - frontend-ready list payload for the overview and favorites views
   - accepts `period=<periodId>`; without it the newest semester is returned
2. `GET /api/catalog/courses/<id>`
   - detail payload with schedule, content, exams, and regulation options
3. `GET /api/catalog/periods`
   - semesters available in the multi-period catalog (`periodId`, `label`,
     `courseCount`), newest first; drives the semester selector in the catalog
     overview and the period-matched course list in the semester planner

The frontend no longer needs `completedCourses` or `masterCategoryMeta` from the mock JSON once the catalog path is API-backed.

## Curriculum links (masterCats / module badges)

`masterCats`, `studyAreaOptions`, and `moduleCode`/`moduleTitle` come from two
tables that the catalog seed rebuilds on every import from the scraped
'Module / Studiengaenge' category codes (`_categories_json` course field):

- `course_study_area_links` (migration 0020): direct course -> study-area
  assignments for codes matching `study_areas.code` (INFO-BASIS, INFO-INFO, ...).
  This is what drives the badges for most courses.
- `course_curriculum_matches`: course -> module for codes or course numbers
  matching `curriculum_modules.module_code`; matched modules also supply ECTS.

Both tables are in the seed's DELETE order, so re-importing the catalog always
replaces stale links (course ids are reassigned by the seed). Known gaps: the
ML master's scraped codes are `MACH-*` but the seeded areas use `ML-*` (no
confirmed alias mapping yet), and `study_areas`/`curriculum_modules` reference
rows come from the legacy `alma.sqlite` export rather than a migration.
