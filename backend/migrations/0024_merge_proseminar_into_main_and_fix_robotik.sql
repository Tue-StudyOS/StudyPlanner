PRAGMA foreign_keys = ON;

-- 1) Fold the standalone Proseminar area into the compulsory Informatik (MAIN)
--    block: a Proseminar is mandatory anyway, so it no longer needs its own
--    selectable area / progress bar.

-- Reassign any Proseminar course mappings to the INF (MAIN) rule group.
UPDATE regulation_course_mappings
SET rule_group_id = (
    SELECT id FROM regulation_rule_groups
    WHERE regulation_version_id = (SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021')
      AND code = 'INF'
)
WHERE rule_group_id = (
    SELECT id FROM regulation_rule_groups
    WHERE regulation_version_id = (SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021')
      AND code = 'PROSEM'
);

-- INF now also carries the 3 ECTS Proseminar requirement (111 + 3).
UPDATE regulation_rule_groups
SET required_ects = 114
WHERE code = 'INF'
  AND regulation_version_id = (SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021');

-- Drop the standalone Proseminar rule group.
DELETE FROM regulation_rule_groups
WHERE code = 'PROSEM'
  AND regulation_version_id = (SELECT id FROM regulation_versions WHERE code = 'BSC_INFO_2021');

-- Link every Proseminar catalog course to the INF study area so it becomes
-- assignable to (and counts in) MAIN. Capacity (114) keeps exactly one 3 ECTS
-- Proseminar countable on top of the 111 ECTS mandatory modules.
INSERT OR IGNORE INTO course_study_area_links (course_id, study_area_id, source_code)
SELECT c.id,
       (SELECT id FROM study_areas
         WHERE code = 'INF'
           AND program_id = (SELECT id FROM study_programs WHERE code = 'BSC_INFO_2021')),
       'PROSEM_MERGE'
FROM courses c
WHERE c.course_type = 'Proseminar';

-- 2) "Grundlagen der Robotik" (INF3351) only carried general-Informatik tags
--    (INFO-INFO / INFO-BASIS), so it never counted toward Technische Informatik.
--    Add the Technische-Informatik study area for both BSc (TECH) and
--    MSc (INFO-TECH); existing links stay so the general option remains.
INSERT OR IGNORE INTO course_study_area_links (course_id, study_area_id, source_code)
SELECT c.id,
       (SELECT id FROM study_areas
         WHERE code = 'TECH'
           AND program_id = (SELECT id FROM study_programs WHERE code = 'BSC_INFO_2021')),
       'ROBOTIK_TECH_FIX'
FROM courses c
WHERE c.number = 'INF3351';

INSERT OR IGNORE INTO course_study_area_links (course_id, study_area_id, source_code)
SELECT c.id,
       (SELECT id FROM study_areas
         WHERE code = 'INFO-TECH'
           AND program_id = (SELECT id FROM study_programs WHERE code = 'MSC_INFO_2021')),
       'ROBOTIK_TECH_FIX'
FROM courses c
WHERE c.number = 'INF3351';
