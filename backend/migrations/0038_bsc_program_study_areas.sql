-- Bioinformatik, Medieninformatik and Medizininformatik already have PO rule
-- groups, but no study_areas rows. Catalog tags are course_study_area_links
-- against study_areas, so ALMA module codes could not be attached.

INSERT OR IGNORE INTO study_areas (
    program_id,
    code,
    name,
    required_ects,
    area_type,
    sort_order,
    source_note
)
SELECT
    sp.id,
    rrg.code,
    rrg.name,
    rrg.required_ects,
    rrg.group_type,
    rrg.sort_order,
    'Mirrored from the PO 2021 rule group so ALMA module codes can tag catalog courses.'
FROM study_programs AS sp
JOIN regulation_versions AS rv ON rv.code = sp.code
JOIN regulation_rule_groups AS rrg ON rrg.regulation_version_id = rv.id
WHERE sp.code IN ('BSC_BIOINFO_2021', 'BSC_MEDIENINFO_2021', 'BSC_MEDIZININFO_2021')
  AND rrg.code <> 'THESIS';

UPDATE regulation_rule_groups
SET study_area_id = (
    SELECT sa.id
    FROM study_areas AS sa
    JOIN regulation_versions AS rv ON rv.id = regulation_rule_groups.regulation_version_id
    JOIN study_programs AS sp ON sp.code = rv.code AND sp.id = sa.program_id
    WHERE sa.code = regulation_rule_groups.code
)
WHERE study_area_id IS NULL
  AND code <> 'THESIS'
  AND regulation_version_id IN (
      SELECT id
      FROM regulation_versions
      WHERE code IN ('BSC_BIOINFO_2021', 'BSC_MEDIENINFO_2021', 'BSC_MEDIZININFO_2021')
  );
