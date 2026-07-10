# Mock Data Status

## Current runtime status

The public course catalog reads the Worker API and D1. The obsolete tracked
`backend/data/courses.json` and `backend/data/Alma_courses.json` snapshots were
removed; generated scraper output belongs in the ignored `data_collection/output/`
directory.

### API-backed entry points

These entry points already load from the Worker API / D1 database:

- catalog overview
- course detail view
- favorites page course cards
- public study-program and regulation data endpoints

### Remaining mock / bootstrap data

The catalog has no tracked JSON mock. Personal progress is account-backed; tour
preview records remain isolated under the onboarding feature and are never used as
runtime account data.

## Practical conclusion

- signed-out visitors now get the public catalog from the database-backed API
- generated catalog snapshots stay local and are never bundled into the frontend
