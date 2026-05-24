PRAGMA foreign_keys = ON;

-- BSC_INFO_2021 study_areas were seeded with NULL required_ects.
-- Set correct values derived from the official Prüfungsordnung 2021.
UPDATE regulation_rule_groups
SET required_ects = CASE code
    WHEN 'MATH'  THEN 33
    WHEN 'INF'   THEN 78
    WHEN 'PRAK'  THEN 6
    WHEN 'TECH'  THEN 6
    WHEN 'THEO'  THEN 6
    WHEN 'INFO'  THEN 15
    WHEN 'UEBK'  THEN 18
    ELSE required_ects
END
WHERE regulation_version_id = (
    SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021'
);
