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

The API cutover should use two public catalog responses:

1. `GET /api/catalog/courses`
   - frontend-ready list payload for the overview and favorites views
2. `GET /api/catalog/courses/<id>`
   - detail payload with schedule, content, exams, and regulation options

The frontend no longer needs `completedCourses` or `masterCategoryMeta` from the mock JSON once the catalog path is API-backed.
