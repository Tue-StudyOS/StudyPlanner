PRAGMA foreign_keys = ON;

-- Keep only the supported official PO 2021 regulations and clear legacy profile links.
UPDATE user_completed_courses
SET master_cat = 'BASIS'
WHERE master_cat = 'FOKUS';

UPDATE user_profiles
SET study_program_id = NULL,
    updated_at_unix = unixepoch()
WHERE study_program_id IN (
    SELECT id
    FROM study_programs
    WHERE COALESCE(source_status, '') <> 'official'
       OR COALESCE(po_version, '') <> '2021'
);

UPDATE user_profiles
SET regulation_version_id = NULL,
    updated_at_unix = unixepoch()
WHERE regulation_version_id IN (
    SELECT id
    FROM regulation_versions
    WHERE COALESCE(source_status, '') <> 'official'
       OR COALESCE(version_label, '') <> '2021'
);

DELETE FROM course_progress_category_mappings
WHERE regulation_version_id IN (
    SELECT id
    FROM regulation_versions
    WHERE COALESCE(source_status, '') <> 'official'
       OR COALESCE(version_label, '') <> '2021'
);

DELETE FROM study_program_regulation_versions
WHERE study_program_id IN (
    SELECT id
    FROM study_programs
    WHERE COALESCE(source_status, '') <> 'official'
       OR COALESCE(po_version, '') <> '2021'
)
   OR regulation_version_id IN (
    SELECT id
    FROM regulation_versions
    WHERE COALESCE(source_status, '') <> 'official'
       OR COALESCE(version_label, '') <> '2021'
);

DELETE FROM regulation_course_mappings
WHERE regulation_version_id IN (
    SELECT id
    FROM regulation_versions
    WHERE COALESCE(source_status, '') <> 'official'
       OR COALESCE(version_label, '') <> '2021'
);

DELETE FROM regulation_rule_groups
WHERE regulation_version_id IN (
    SELECT id
    FROM regulation_versions
    WHERE COALESCE(source_status, '') <> 'official'
       OR COALESCE(version_label, '') <> '2021'
);

DELETE FROM regulation_versions
WHERE COALESCE(source_status, '') <> 'official'
   OR COALESCE(version_label, '') <> '2021';

DELETE FROM study_programs
WHERE COALESCE(source_status, '') <> 'official'
   OR COALESCE(po_version, '') <> '2021';

DELETE FROM examination_regulations
WHERE id NOT IN (
    SELECT DISTINCT regulation_id
    FROM regulation_versions
    WHERE regulation_id IS NOT NULL
);
