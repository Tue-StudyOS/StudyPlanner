PRAGMA foreign_keys = ON;

-- Reassign all course mappings from MATH rule group to INF rule group for BSC_INFO_2021
UPDATE regulation_course_mappings
SET rule_group_id = (
    SELECT id FROM regulation_rule_groups
    WHERE regulation_version_id = (SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021')
    AND code = 'INF'
)
WHERE rule_group_id = (
    SELECT id FROM regulation_rule_groups
    WHERE regulation_version_id = (SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021')
    AND code = 'MATH'
);

-- Update INF required_ects to 111 (78 + 33)
UPDATE regulation_rule_groups
SET required_ects = 111
WHERE code = 'INF'
AND regulation_version_id = (SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021');

-- Delete MATH rule group for BSC_INFO_2021
DELETE FROM regulation_rule_groups
WHERE code = 'MATH'
AND regulation_version_id = (SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021');
