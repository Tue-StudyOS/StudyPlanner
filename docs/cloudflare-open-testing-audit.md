# Cloudflare open-testing audit

## Scope

This document is the canonical repo-side audit and planning note for the first open-testing Cloudflare setup.

It combines:

- the current repo state
- the currently configured Cloudflare-facing state in `backend/wrangler.toml`
- the target D1-primary architecture
- the public ALMA scrape-data contract
- repo cleanup candidates
- the first open-testing boundary and readiness checklist

## Audit source and confidence

### Repo-confirmed inputs

- `backend/wrangler.toml`
- `package.json`
- `backend/migrations/0001_initial.sql` through `0017_add_cloud_dev_category.sql`
- `backend/scripts/export_sqlite_to_d1.py`
- `backend/src/router.py`
- `backend/src/services/*.py`
- `data_collection/alma/scraper.py`
- `data_collection/alma/cli.py`
- `backend/data/alma.sqlite`
- `einzupflegene_po/*.json`
- current repo docs in `README.md`, `backend/README.md`, and `docs/`

### Live-state gap

This audit can confirm the repo configuration, but it cannot fully confirm the live dashboard state because no Cloudflare dashboard export, Wrangler remote output, or screenshot bundle is checked into the repo.

**Follow-up required outside the repo:** verify the Worker, Pages project, custom domains, D1 instance name, and runtime variables against the live Cloudflare account before treating this note as a final production inventory.

## Current Cloudflare-facing repo state

### Worker

- Worker source: `backend/src/main.py`
- Worker router: `backend/src/router.py`
- Worker name in `backend/wrangler.toml`: `studyplaner-api`
- Compatibility date: `2025-05-20`
- Compatibility flag: `python_workers`
- `workers_dev = true`
- D1 binding name: `DB`

### D1

- The repo is built around **one D1 binding** named `DB`.
- `backend/wrangler.toml` currently points that binding at a database named **`studyplaner-db-test`**.
- Root helper scripts and several docs still refer to **`studyplaner-db`**, so the repo currently has **name drift** between documentation/scripts and the checked-in Worker binding.
- The checked-in migration set builds **39 tables and 2 views**.

### Frontend / Pages

- The frontend lives in `frontend/` and is intended for Cloudflare Pages deployment.
- The repo does not contain a Cloudflare Pages config export, so the exact live Pages project name and connected branch cannot be proven from the repo alone.
- Frontend/API integration assumes `VITE_API_BASE_URL` is configured in Pages.

### Runtime split today

- Public catalog data is already served from the Worker and D1-backed API.
- Account-backed features also exist in the Worker API:
  - auth/session
  - profile
  - favorites
  - completed courses
  - transcript issues
  - semester plans
  - progress
- The local ALMA scrape/import flow still starts from `backend/data/alma.sqlite` and `einzupflegene_po/*.json`.

## Current request/data flow

```text
public ALMA pages
  -> data_collection/alma/scraper.py
  -> backend/data/alma.sqlite
  -> backend/scripts/export_sqlite_to_d1.py
  -> backend/.tmp/d1-seed.sql
  -> Cloudflare D1 (binding: DB)
  -> Cloudflare Worker API
  -> frontend on Cloudflare Pages
```

## Repo-confirmed route surface

### Public read routes

- `GET /health`
- `GET /api/courses`
- `GET /api/courses/<id>`
- `GET /api/catalog/courses`
- `GET /api/catalog/courses/<id>`
- `GET /api/regulation-versions`
- `GET /api/regulation-versions/<code>`
- `GET /api/regulation-versions/<code>/courses`
- `GET /api/study-programs`

### Account-backed routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET|PATCH /api/me/profile`
- `PATCH /api/me/credentials`
- `GET|PUT /api/me/favorites`
- `GET|PUT /api/me/completed-courses`
- `POST /api/me/completed-courses/import`
- `GET|PUT /api/me/transcript-issues`
- `GET /api/me/semester-plans`
- `GET|PUT|DELETE /api/me/semester-plans/<semester>`
- `GET /api/me/progress`

## Current repo mismatches to resolve

| Area | Repo-confirmed current state | Why it matters |
| --- | --- | --- |
| D1 naming | `backend/wrangler.toml` uses `studyplaner-db-test`, while scripts/docs often use `studyplaner-db` | Commands and docs can drift from the bound database |
| Cloudflare docs | Some docs still describe a migration/test setup instead of the current single active D1 direction | Open-testing guidance is harder to trust |
| Legacy tracked data | `backend/data/courses.json`, `backend/data/Alma_courses.json`, and `backend/data/regulations/*` are still tracked | They add ambiguity around the real source of truth |
| Live inventory proof | No checked-in dashboard export or Wrangler remote inventory | The repo alone cannot prove live resource names/domains |

## Current architectural reading

The repo already behaves like a **single-D1 application** with a **temporary local SQLite ingestion/bootstrap path**.

That means the practical current split is:

- **D1** = runtime database for public catalog and account-backed API features
- **SQLite + export script** = ingestion/bootstrap mechanism used to refresh seed data
- **Worker** = only runtime API surface
- **Frontend** = consumer of the Worker API

## Current database inventory

### Schema summary

- Checked-in migration set: **39 tables + 2 views**
- Migration files: `backend/migrations/0001_initial.sql` through `0017_add_cloud_dev_category.sql`
- Current tracked source database: `backend/data/alma.sqlite`
- Intentional exclusion from D1 schema generation: SQLite FTS helper tables (`course_search*`)
- Official PO overlay source: `einzupflegene_po/*.json`

### Source-of-truth reading by table family

- **Public ALMA catalog data:** scraped from public ALMA pages into SQLite, then exported into D1
- **Official regulation/program seed data:** loaded from `einzupflegene_po/*.json`, plus a limited set of curriculum matches already present in SQLite
- **Derived app metadata:** maintained in repo migrations/seeds for progress views and regulation-friendly joins
- **Private account data:** created only through the authenticated Worker API and stored in D1

### Group A — scrape, catalog, and raw detail tables

| Table | Purpose | Data ownership | Key columns | Upstream source | Main consumers | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `scrape_runs` | One scrape/import run header for traceability | Public scrape metadata | `id`, `source_url`, `fetched_at_unix`, `raw_source_json` | `data_collection/alma/scraper.py` | import/audit tooling | Keep (transitional ingestion metadata) |
| `catalog_nodes` | Full ALMA catalog tree nodes, paths, and raw node payload | Public ALMA catalog | `run_id`, `node_id`, `parent_node_id`, `catalog_path`, `detail_url` | ALMA catalog crawl | import/audit tooling | Keep (normalized raw catalog backbone) |
| `catalog_node_paths` | Ancestor/descendant helper table for catalog traversal | Public ALMA catalog | `run_id`, `node_id`, `ancestor_node_id`, `depth` | derived during import | import/audit tooling | Keep |
| `course_placements` | Maps a course to one or more catalog nodes | Public ALMA catalog | `course_id`, `run_id`, `node_id` | ALMA import | import/audit tooling | Keep |
| `courses` | Canonical course records used by the API | Public ALMA catalog | `id`, `unit_id`, `period_id`, `number`, `title`, `raw_fields_json` | ALMA detail pages | `course_catalog.py`, `regulations.py`, favorites/progress/planner services | Keep |
| `lecturers` | Normalized lecturer/person records | Public ALMA catalog | `id`, `display_name`, `email`, `department` | ALMA detail pages | `course_catalog.py` | Keep |
| `course_lecturers` | Course-level lecturer links | Public ALMA catalog | `course_id`, `lecturer_id`, `source`, `source_text` | ALMA detail pages | `course_catalog.py` | Keep |
| `parallel_groups` | Normalized course group variants | Public ALMA catalog | `id`, `course_id`, `group_type`, `language`, `semester_hours` | ALMA detail pages | `course_catalog.py`, planner UI | Keep |
| `parallel_group_lecturers` | Group-level lecturer links | Public ALMA catalog | `parallel_group_id`, `lecturer_id`, `source`, `source_text` | ALMA detail pages | import/audit tooling | Keep (currently lightly used) |
| `parallel_group_fields` | Raw key/value detail fields for a parallel group | Public ALMA catalog | `parallel_group_id`, `key`, `value` | ALMA detail pages | import/audit tooling | Keep (raw traceability) |
| `appointments` | Time/room schedule slots for parallel groups | Public ALMA catalog | `id`, `parallel_group_id`, `weekday`, `start_time`, `end_time`, `room_text` | ALMA detail pages | `course_catalog.py`, planner UI, `v_course_schedule` | Keep |
| `appointment_lecturers` | Appointment-level lecturer links | Public ALMA catalog | `appointment_id`, `lecturer_id`, `source`, `source_text` | ALMA detail pages | import/audit tooling | Keep (raw traceability) |
| `appointment_cancellations` | Per-date cancellation markers | Public ALMA catalog | `appointment_id`, `cancelled_on` | ALMA detail pages | import/audit tooling | Keep (raw schedule detail) |
| `assessment_dates` | Exam/assessment dates attached to courses | Public ALMA catalog | `id`, `course_id`, `date_value`, `kind`, `source_title` | ALMA detail pages | `course_catalog.py` | Keep |
| `course_fields` | Raw course key/value fields from detail pages | Public ALMA catalog | `course_id`, `key`, `value` | ALMA detail pages | `course_catalog.py` | Keep |
| `content_sections` | Structured course content text blocks | Public ALMA catalog | `id`, `course_id`, `position`, `title`, `text` | ALMA content tab | `course_catalog.py` | Keep |
| `content_fields` | Raw key/value fields from course content tabs | Public ALMA catalog | `course_id`, `key`, `value` | ALMA content tab | import/audit tooling | Keep (currently optional raw capture) |

### Group B — curriculum, regulation, and mapping tables

| Table | Purpose | Data ownership | Key columns | Upstream source | Main consumers | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `study_programs` | Supported study-program catalogue | Official PO + limited SQLite base data | `id`, `code`, `name`, `po_version`, `source_status` | `einzupflegene_po/*.json`, partial SQLite seed | `authentication.py`, `router.py`, `regulations.py` | Keep |
| `study_areas` | Program-specific study areas / curriculum buckets | Mostly SQLite curriculum data | `id`, `program_id`, `code`, `name`, `required_ects`, `area_type` | `alma.sqlite` | regulation seeding/export, mapping views | Keep |
| `study_area_inclusion_rules` | Inclusion/containment rules between study areas | SQLite curriculum data | `id`, `target_study_area_id`, `included_study_area_id`, `rule_type` | `alma.sqlite` | import/audit tooling | Keep (not yet heavily used at runtime) |
| `curriculum_modules` | Curriculum module definitions | SQLite curriculum data | `id`, `module_code`, `title`, `ects`, `module_type` | `alma.sqlite` | `course_catalog.py`, regulation mapping | Keep |
| `curriculum_module_aliases` | Alternate module identifiers/text aliases | SQLite curriculum data | `id`, `module_id`, `alias`, `normalized_alias`, `alias_type` | `alma.sqlite` | import/matching tooling | Keep |
| `module_study_area_options` | Which study areas a module can count toward | SQLite curriculum data | `id`, `module_id`, `study_area_id`, `ects_counted`, `status` | `alma.sqlite` | `course_catalog.py`, completed-course assignment logic, views | Keep |
| `course_curriculum_matches` | Links courses to modules with match metadata | SQLite curriculum matching data | `id`, `course_id`, `module_id`, `match_type`, `confidence` | `alma.sqlite` | `course_catalog.py`, regulation seed/export | Keep |
| `examination_regulations` | Canonical regulation umbrella entities | Official PO seed | `id`, `code`, `name`, `degree`, `subject` | `einzupflegene_po/*.json` | `regulations.py`, auth/profile selection | Keep |
| `regulation_versions` | Specific regulation version records | Official PO seed | `id`, `regulation_id`, `code`, `version_label`, `source_status` | `einzupflegene_po/*.json` | `regulations.py`, auth/profile selection, progress | Keep |
| `study_program_regulation_versions` | Allowed/default mapping between programs and regulation versions | Derived official mapping | `study_program_id`, `regulation_version_id`, `is_default`, `enrollment_match` | export seed logic | `authentication.py`, `router.py` | Keep |
| `regulation_rule_groups` | Normalized regulation areas shown to users | Official PO seed + SQLite-derived groups for matched programs | `id`, `regulation_version_id`, `code`, `name`, `required_ects`, `group_type` | export seed logic | `regulations.py`, planner/progress/completed-course services | Keep |
| `regulation_course_mappings` | Course-to-regulation-area mappings | Derived from curriculum/module matches | `id`, `regulation_version_id`, `course_id`, `rule_group_id`, `status` | export seed logic | `regulations.py`, `progress.py`, completed-course/planner assignment logic | Keep |

### Group C — derived application metadata

| Table | Purpose | Data ownership | Key columns | Upstream source | Main consumers | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `progress_categories` | Dashboard visualization categories | App-owned derived metadata | `id`, `code`, `name`, `reference_ects`, `color_token` | repo migrations/seeds | `progress.py`, frontend dashboard | Keep |
| `course_progress_category_mappings` | Course-to-visualization-category mapping | App-owned derived metadata | `id`, `progress_category_id`, `course_id`, `regulation_version_id`, `weight` | repo migrations/seeds | `progress.py` | Keep |

### Group D — private account and user-state tables

| Table | Purpose | Data ownership | Key columns | Upstream source | Main consumers | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `users` | Account identity and password hashes | Private user data | `id`, `email`, `password_hash`, `password_salt`, `display_name` | auth API writes | `authentication.py` | Keep |
| `user_profiles` | Per-user profile and planner preferences | Private user data | `user_id`, `study_program_id`, `regulation_version_id`, `current_semester_label`, `planner_mobile_layout` | auth/profile API writes | `authentication.py`, planner/profile UI, progress | Keep |
| `user_sessions` | Bearer-token session store | Private user data | `id`, `user_id`, `token_hash`, `expires_at_unix`, `revoked_at_unix` | auth API writes | `authentication.py` | Keep |
| `user_favorites` | User favorite-course set | Private user data | `user_id`, `course_id`, `created_at_unix` | favorites API writes | `user_favorites.py`, planner favorites UI | Keep |
| `user_completed_courses` | User transcript/progress course records | Private user data | `id`, `user_id`, `course_id`, `external_course_code`, `study_area_code`, `grade` | completed-course API writes/import | `user_completed_courses.py`, `progress.py` | Keep |
| `user_transcript_issues` | Unresolved transcript import candidates | Private user data | `id`, `user_id`, `issue_key`, `candidate_json`, `updated_at_unix` | transcript-issue API writes | `user_transcript_issues.py` | Keep |
| `user_semester_plans` | One semester-plan header per user/semester | Private user data | `id`, `user_id`, `semester_label`, `hidden_slot_ids`, `updated_at_unix` | planner API writes | `user_semester_plans.py`, planner UI | Keep |
| `user_semester_plan_courses` | Ordered courses saved inside a semester plan | Private user data | `plan_id`, `course_id`, `position`, `study_area_code` | planner API writes | `user_semester_plans.py`, planner UI | Keep |

### Views

| View | Purpose | Main source tables | Main consumers | Status |
| --- | --- | --- | --- | --- |
| `v_course_curriculum_options` | Convenience join for course/module/study-area options | `courses`, `course_curriculum_matches`, `curriculum_modules`, `module_study_area_options`, `study_areas`, `study_programs` | inspection and future query simplification | Keep |
| `v_course_schedule` | Convenience join for course/group/appointment schedule data | `courses`, `parallel_groups`, `appointments` | inspection and future query simplification | Keep |

### Current data-coverage notes

- `backend/data/alma.sqlite` currently contains the imported public catalog backbone, including `1265` courses and `18376` catalog nodes.
- The SQLite source currently contains only a **partial curriculum/regulation mapping base** (`3` study programs, `21` study areas, `12` curriculum modules, `16` course-curriculum matches).
- The export step supplements that limited SQLite curriculum data with the official PO 2021 definitions from `einzupflegene_po/*.json`, producing the current six supported study programs in D1.
- User/account tables are empty in the tracked source database and are intended to be populated only through the deployed Worker API.

## Target Cloudflare data architecture

### Target state

The target for first open testing should stay intentionally simple:

- **one Cloudflare Worker** for the app API
- **one Cloudflare Pages frontend**
- **one Cloudflare D1 database** for both public catalog data and internal account-backed data
- **D1 as the canonical runtime database**
- **D1 as the long-term canonical application data store**

### Canonical ownership boundary

| Layer | Role in the target model | Canonical? |
| --- | --- | --- |
| D1 | Runtime app data for catalog, regulation, and account-backed features | Yes |
| Worker | API and policy layer over D1 | No |
| Pages frontend | UI consumer | No |
| `alma.sqlite` | local import/bootstrap source during the transition only | No |
| generated SQL dump | transport artifact for local/remote D1 imports | No |

### Transitional rule set

Until a direct D1-native ingestion path exists, the repo should treat the current import chain like this:

1. scrape public ALMA pages locally
2. refresh `backend/data/alma.sqlite`
3. generate a D1-friendly SQL dump with `backend/scripts/export_sqlite_to_d1.py`
4. import that dump into D1
5. treat D1 as the database the app actually runs against

That means **SQLite may still be the easiest place to rebuild source data, but it should no longer be treated as the runtime source of truth**.

### What should stay in the single D1

Keep these in the same D1 for the first open-testing phase:

- public catalog tables
- regulation/program tables
- progress visualization metadata
- user accounts
- favorites
- completed courses
- transcript-issue review state
- semester plans

This is operationally simpler than splitting catalog and user data before open testing.

### Trade-offs of the single-D1 approach

Benefits:

- smallest operational footprint
- no cross-database joins or sync concerns
- easiest Worker configuration
- simplest first open-testing deployment story

Costs:

- resets become more sensitive because public and private data share one database
- import hygiene matters more during test refreshes
- account-backed privacy boundaries rely on Worker/API behavior rather than physical database separation

### Naming direction

The repo already behaves like there is only **one active remote D1**.

Target naming should therefore be production-like and no longer suggest an isolated migration sandbox. The desired end state is:

- D1: `studyplaner-db`
- Worker: `studyplaner-api`
- Pages: `studyplaner-web`

However, the repo currently still points at `studyplaner-db-test` in `backend/wrangler.toml`. Because the live Cloudflare account is not available from the repo alone, the safe repo-side conclusion is:

- **current configured remote name:** `studyplaner-db-test`
- **target normalized name:** `studyplaner-db`
- **required live follow-up:** rename or recreate the D1 resource in Cloudflare, then update `backend/wrangler.toml`, helper scripts, and docs together

### Architecture decision summary

For first open testing, the recommended architecture is:

- keep the current local scraper and SQLite refresh flow
- keep the SQL export step as a temporary bridge
- run the application from one D1 only
- avoid adding a second database, queue, or ingestion service before open testing proves necessary

## Public ALMA scrape-data contract

### Scope

The scrape contract is limited to **public ALMA catalog data**. It should not assume access to private student records, login-only views, or non-public examination data.

### Format rules

| Field type | Canonical rule |
| --- | --- |
| stable identifiers | prefer ALMA text ids (`unit_id`, `period_id`, `node_id`, module codes) plus local numeric surrogate ids where the schema already uses them |
| dates | ISO `YYYY-MM-DD` |
| times | `HH:MM` |
| booleans | `0/1` in SQL, boolean in JSON responses |
| lifecycle timestamps | unix timestamps only for operational/import metadata such as `fetched_at_unix`, `finished_at_unix`, `imported_at_unix` |
| free-text leftovers | keep as text |
| structured leftovers | JSON text only when normalization would add complexity without immediate query value |
| user-facing API ids | keep current stringified ids in JSON where the frontend already expects them |

### Minimum scrape entities

#### 1. Scrape run metadata

Required:

- source start URL
- branch title filter if used
- latest-version filter flag
- partial/full flag
- fetch start/end timestamps

Storage today:

- `scrape_runs`

#### 2. Catalog nodes and paths

Required:

- node id
- parent node id
- node level
- title
- kind
- permalink
- detail URL where present
- path titles / catalog path
- expansion flags

Storage today:

- `catalog_nodes`
- `catalog_node_paths`

#### 3. Courses

Required normalized fields:

- internal numeric `id`
- `unit_id`
- `period_id`
- course number when present
- title
- organisation
- course type
- offering frequency
- registration period
- short comment
- semester hours
- detail URL and final detail-page URL

Optional normalized fields:

- catalog title
- extracted ECTS when a stable source exists

Storage today:

- `courses`

#### 4. Lecturers

Required normalized fields:

- lecturer id
- display name

Useful optional fields:

- title
- name parts / raw name
- email
- department

Storage today:

- `lecturers`
- `course_lecturers`
- `parallel_group_lecturers`
- `appointment_lecturers`

#### 5. Parallel groups

Required normalized fields:

- parallel-group id
- course id
- position
- title
- group type
- language
- semester hours when present

Useful optional fields:

- responsible text
- participant limits

Storage today:

- `parallel_groups`

#### 6. Appointments

Required normalized fields:

- appointment id
- parallel-group id
- weekday and weekday index when present
- human-readable time text
- normalized start/end times when present
- human-readable date text when present
- normalized start/end dates when present
- room text

Useful optional fields:

- instructors text
- expected participants
- note
- cancellation text
- explicit cancellation dates

Storage today:

- `appointments`
- `appointment_cancellations`

#### 7. Assessment dates

Required normalized fields:

- course id
- date value when a normalized date is available
- kind/source labels
- raw source text

Storage today:

- `assessment_dates`

#### 8. Content sections and key/value fields

Required normalized fields:

- ordered content sections with title and text
- stable course key/value fields needed for the current API

Optional raw capture:

- any remaining content tab fields not yet worth first-class normalization

Storage today:

- `content_sections`
- `course_fields`
- `content_fields`
- `parallel_group_fields`

#### 9. Curriculum/regulation mapping support

Required for current app features:

- course-to-module matches
- module-to-study-area options
- supported study programs
- regulation versions
- rule groups and course mappings

Storage today:

- `course_curriculum_matches`
- `curriculum_modules`
- `module_study_area_options`
- `study_programs`
- `regulation_versions`
- `regulation_rule_groups`
- `regulation_course_mappings`

### Queryability rules

These should stay directly queryable in D1 for first open testing:

- courses
- lecturers and course lecturer links
- parallel groups
- appointments
- assessment dates
- content sections
- study programs
- regulation versions
- rule groups
- regulation course mappings
- user favorites/completed courses/semester plans/transcript issues

These can stay primarily as raw or traceability storage for now:

- `raw_json` and `raw_fields_json` columns
- `content_fields`
- `parallel_group_fields`
- `appointment_lecturers`
- `parallel_group_lecturers`
- `appointment_cancellations`
- `catalog_nodes` and `catalog_node_paths` once imports are complete, unless catalog-tree browsing becomes a product need

These are valid derived/API convenience outputs rather than canonical scrape fields:

- merged lecturer strings
- derived schedule summaries
- extracted prerequisite lists
- picked description text
- dashboard progress ratios
- planner regulation assignment suggestions

### Data-contract guidance for future ingestion work

When the scraper/importer evolves, prefer this order:

1. normalize fields that are already queried by the Worker or frontend
2. keep everything else as raw text/JSON only if it preserves traceability
3. only add new tables when they remove real ambiguity or repeated parsing
4. avoid storing duplicate derived frontend payloads inside D1 when the Worker can derive them cheaply

## Current vs target summary

| Topic | Current repo-confirmed state | Target state |
| --- | --- | --- |
| runtime database | one D1 binding, currently configured as `studyplaner-db-test` | one D1 with normalized production-like naming |
| source-of-truth model | D1 at runtime, SQLite still used as import/bootstrap source | D1 canonical for app data, ingestion path can remain transitional |
| public data surface | public catalog endpoints already available | keep public catalog as the only open-testing surface |
| account-backed features | deployed in the Worker and backed by D1 | keep internal-only during first open testing |
| docs | mixed migration/test-era wording | one canonical audit plus aligned Cloudflare docs |
| legacy tracked data | old JSON/reference assets still present | remove verified low-risk clutter |

## Repo cleanup candidates

### Low-risk removals once references are rechecked

| Path | Current reading | Recommendation |
| --- | --- | --- |
| `backend/data/courses.json` | legacy tracked catalog export; no active runtime references found | Remove |
| `backend/data/Alma_courses.json` | legacy tracked catalog export; no active runtime references found | Remove |
| `backend/data/regulations/` | no active runtime/build references found; superseded by `einzupflegene_po/` and D1 seed logic | Remove after one last reference check |

### Keep for now

| Path | Why it stays |
| --- | --- |
| `backend/data/alma.sqlite` | still required for the current scraper -> SQLite -> D1 bootstrap flow |
| `einzupflegene_po/` | current official PO 2021 seed source used by `backend/scripts/export_sqlite_to_d1.py` |
| `docs/cloudflare-test-plan.md` | can stay as historical/operator context if rewritten to point at this audit |

### Naming and migration hygiene follow-ups

- resolve the duplicate `0009_*.sql` migration numbering before more migrations accumulate
- align repo helper commands with the checked-in D1 binding name until the live D1 can be renamed safely
- keep raw JSON columns only where they preserve real traceability or reduce reparsing cost

## First open-testing readiness checklist

### Repo/config

- [ ] Canonical audit doc exists and is linked from the main Cloudflare docs
- [ ] `backend/wrangler.toml`, helper scripts, and docs use consistent D1 naming
- [ ] stale migration-test wording is removed or clearly marked historical
- [ ] low-risk legacy tracked data is removed

### Data and schema

- [ ] migration set still builds **39 tables + 2 views**
- [ ] local export/import flow still works from `backend/data/alma.sqlite`
- [ ] D1 still contains the required public catalog and regulation tables
- [ ] account tables stay in the same D1 and remain Worker-protected

### Runtime smoke tests

- [ ] `GET /health`
- [ ] `GET /api/catalog/courses?limit=2`
- [ ] `GET /api/catalog/courses/<id>`
- [ ] `GET /api/study-programs`
- [ ] `GET /api/regulation-versions`

### Product boundary

- [ ] public catalog browsing is stable for signed-out users
- [ ] auth/profile/favorites/progress/planner features are not treated as public open-testing promises yet
- [ ] reset/support expectations are documented for the single shared D1

## Canonical use of this document

Use this file as the main reference for follow-up Cloudflare work.

Other repo docs should summarize, link here, and avoid reintroducing conflicting statements about:

- the active D1 setup
- the temporary SQLite bootstrap role
- the public catalog vs internal account-feature boundary
- legacy data files that are no longer part of the runtime path
