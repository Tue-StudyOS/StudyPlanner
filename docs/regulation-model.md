# Examination Regulation Model

This note defines the minimum backend model needed to match study programs and students to the correct examination regulations.

The [official-source audit](official-po-audit-2026-10.md) identifies confirmed
curriculum and validation gaps. This schema description is not evidence that the
seeded rule values fully implement the official POs.

## Goals

- store one regulation independently from a concrete study-program row
- support versioned regulations, for example `2021`
- keep rule groups explicit so course assignments can drive catalog badges and progress views
- stay compatible with the existing `study_programs`, `study_areas`, `curriculum_modules`, and `course_curriculum_matches` tables

## Minimum tables

### `examination_regulations`

One logical regulation family.

Fields:

- `code`
- `name`
- `degree`
- `subject`
- `notes`

Examples:

- `BSC_INFO`
- `MSC_INFO`
- `MSC_ML`

### `regulation_versions`

One concrete published version of a regulation.

Fields:

- `regulation_id`
- `code` – stable API / matching code, for example `MSC_INFO_2021`
- `version_label` – human-readable version such as `2021`
- `total_ects`
- `language`
- `source_status`
- `notes`

### `study_program_regulation_versions`

Bridges existing study programs to one or more regulation versions.

Fields:

- `study_program_id`
- `regulation_version_id`
- `is_default`
- `enrollment_match` – explains how a student profile is matched later

This keeps the model open for future cases where one program can map to multiple regulation versions.

### `regulation_rule_groups`

The progress-relevant buckets inside one regulation version.

Fields:

- `regulation_version_id`
- `study_area_id` – optional bridge to the existing normalized study-area table
- `code`
- `name`
- `group_type`
- `required_ects`
- `min_ects`
- `max_ects`
- `sort_order`
- `notes`

In the initial seed, each rule group mirrors one existing `study_areas` row.

### `regulation_course_mappings`

A denormalized, API-friendly table that says which course can count for which rule group.

Fields:

- `regulation_version_id`
- `course_id`
- `module_id`
- `rule_group_id`
- `status`
- `ects_counted`
- `match_type`
- `source_note`

## Why this is the minimum useful model

- `study_programs` alone do not model versioned regulations explicitly enough.
- `study_areas` describe areas, but not the regulation/version boundary cleanly.
- `course_curriculum_matches` plus `module_study_area_options` are useful source data, but they are not shaped for direct frontend/API consumption.
- `regulation_course_mappings` gives the API one stable lookup table for course categorization and later progress calculation.

## Initial strategy

- the initial seed used the PO-2021 JSON files in `einzupflegene_po/`; these are derived transcriptions with confirmed errors, not authoritative legal sources
- use the official statutes, amendments and handbooks in the [source register](official-po-sources.json) to validate corrections; retain the original JSON for traceability rather than silently treating it as verified
- seed these six study programs / regulation versions:
  - `BSC_BIOINFO_2021`
  - `BSC_INFO_2021`
  - `BSC_MEDIENINFO_2021`
  - `BSC_MEDIZININFO_2021`
  - `MSC_INFO_2021`
  - `MSC_ML_2021`
- keep the richer SQLite-derived `study_areas` / `course_curriculum_matches` bridge for `BSC_INFO_2021`, `MSC_INFO_2021`, and `MSC_ML_2021`
- Bioinformatik, Medieninformatik, and Medizininformatik use the same catalog link table: migration `0038` mirrors their rule groups into `study_areas`, and the ALMA importer aliases module codes onto those areas

## Study-program to regulation matching rule

For the current backend model, the matching rule is intentionally simple:

1. each `study_programs` row is linked to one default `regulation_versions` row through `study_program_regulation_versions`
2. the `enrollment_match` field records how that link should be interpreted later for a user profile
3. the current seed uses `program_code`, which means a student profile can be matched by the selected study-program code alone
4. the frontend currently exposes one default PO-2021 selection per program; this does not establish that later amendments (notably ML in 2026) or individual admission requirements are fully represented
5. if the product later needs multiple active regulation versions for one program, the same bridge table can hold multiple rows and still keep one `is_default = 1` mapping

This rule is now exposed through the study-program API so the frontend can load the study program, show the embedded PO label, and let the backend resolve the default regulation automatically.

## Verified PO policy and computed credits

`GET /api/regulation-versions/{code}` exposes `creditPolicy` from the official-source audit. The forward-only, data-only migration `0040_official_po_credit_policies.sql` replaces stale aggregate areas and module aliases while retaining them as `legacy_review` for existing assignments. Catalog import rebuilds course-to-module matches from those explicit aliases.

Credit/accounting values are read-time projections, never trusted persisted fields. Completed-course responses include `earnedEcts`, `uniqueEarnedEcts`, `degreeCountedEcts`, `gradeCountedEcts`, `gradeUsedForAverage`, `creditReviewReasons`, `canonicalModuleCode`, and `isGradeCounted`; `/api/me/progress.summary` publishes recorded, unique-earned, degree-counted and grade-counted ECTS. Raw stored course evidence is not rewritten to store these calculations. Confirmed recognition uses `{confirmed, moduleCode?, areaCode?, componentKey?, componentKind?, assessmentType?, countedEcts?}`; unknown external master's achievements require an explicit `assessmentType` (`lecture`, `seminar`, `practical`, `research_project`, `exam`, or `other`). Catalog assessment types remain authoritative. Optional `countedEcts` records a declared examination-board allocation, not a computed total: it must be between zero and the raw credits and cannot partially exclude the completion module. Additional achievements remain stored but do not enter degree or grade totals. Component grades are CP-weighted and truncated to two decimals for a module grade; the degree grade is truncated to one decimal. `creditReviewReasons` uses stable codes such as `duplicate_achievement`, `duplicate_conflicting_grades`, `module_not_in_regulation`, `module_area_mismatch`, `area_not_in_regulation`, and `assignment_needs_review`.

The existing `user_state.settings_json` stores the optional preference `regulationPreferences.mscInfoBasisAdmissionConfirmed` as a boolean, updated through `PUT /api/me/profile` and returned in the profile. The false/default state enables the regular `INFO-FOKUS` area and keeps `INFO-BASIS` conditional; true declares that the student's Zulassungsbescheid requires/approves BASIS and enables `INFO-BASIS` instead of FOKUS. This is a self-declaration only, not verification of the Bescheid. Unmatched legacy BASIS/FOKUS evidence stays stored and is returned with a review reason; the UI must not choose a placement from credit totals. Suggested text: „Mein Zulassungsbescheid schreibt BASIS vor / erkennt diese BASIS-Module an.“ The examination office remains authoritative.

## Correction release verification

- Backend: 325 tests, including complete 180/120-CP fixtures for all six profiles,
  module/assessment aliases, component budgets, explicit overflow decisions and
  exact grade weighting. ML-EXP contributes credits but not degree-grade weight.
- Frontend: 461 passing Node tests; five transcript-PDF reference cases require
  absent local reference PDFs and are explicitly skipped. Lint and production
  build pass.
- Public-catalog migration check: all 1,525 course rows and synthetic user
  auth/state/progress evidence remain unchanged; no additional foreign-key errors.
  Actual API serialization covers six profiles and 481 catalog entries.
- Browser checks cover 320, 375, 768 and desktop widths in both themes, including
  expanded recognition controls; calendar checks also cover 1024px, week/date
  navigation, block/weekend events, cancellations, fortnightly recurrence,
  date-only exams and full-semester ICS export. No horizontal scrolling is needed.

Apply only the reviewed forward migration to the existing active D1 after an
external backup, then deploy the backend and the matching frontend build. Run
`npm run db:verify-config` first. Do not recreate/reseed the database, change
course IDs, or use a user's private records as release-test fixtures.
