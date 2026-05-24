# Examination Regulation Model

This note defines the minimum backend model needed to match study programs and students to the correct examination regulations.

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

- seed the first supported regulation versions from the already tracked study programs:
  - `BSC_INFO_2021`
  - `MSC_INFO_2021`
  - `MSC_ML_2021`
- mirror each seeded `study_areas` row into one `regulation_rule_groups` row
- derive `regulation_course_mappings` from the existing curriculum-match tables

## Study-program to regulation matching rule

For the current backend model, the matching rule is intentionally simple:

1. each `study_programs` row is linked to one default `regulation_versions` row through `study_program_regulation_versions`
2. the `enrollment_match` field records how that link should be interpreted later for a user profile
3. the current seed uses `program_code`, which means a student profile can be matched by the selected study-program code alone
4. if the product later needs multiple active regulation versions for one program, the same bridge table can hold multiple rows and still keep one `is_default = 1` mapping

This rule is now exposed through the study-program API so the frontend can load the default regulation together with the program.
