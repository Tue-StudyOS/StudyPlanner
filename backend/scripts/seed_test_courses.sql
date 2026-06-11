-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-tag catalog test courses (restored from migration 0019 for the
-- multi-period ALMA catalog, now including weekly schedule slots).
--
-- Eight clearly-marked demo courses ("000 Test Course NN", numbers
-- "INFO000N-TEST") inserted into EVERY catalog period so they are visible
-- regardless of the selected semester. Each course has one or two weekly
-- appointments so the semester planner grid can be tested, including an
-- intentional Tuesday overlap between courses 03 and 08.
--
-- The test study program (TEST_DEMO_2025) is isolated: its study areas are
-- never part of a real PO, so the courses cannot contaminate official
-- regulation progress. Master categories derive from the TEST-* area codes
-- via _study_area_to_master_cat in course_catalog.py.
--
-- Idempotent: safe to run multiple times (INSERT OR IGNORE / NOT EXISTS).
-- Apply:   cd backend && npx wrangler d1 execute DB --remote --file scripts/seed_test_courses.sql
-- Remove:  DELETE FROM scrape_runs WHERE source_url = 'test://testdata/multi-tag-catalog-2025';
--          DELETE FROM study_programs WHERE code = 'TEST_DEMO_2025';
--          DELETE FROM curriculum_modules WHERE module_code LIKE 'TEST-MOD-%';
--          (ON DELETE CASCADE cleans up all derived rows.)
-- ─────────────────────────────────────────────────────────────────────────────

PRAGMA foreign_keys = ON;

-- ── 1. Test scrape run ───────────────────────────────────────────────────────
INSERT INTO scrape_runs (source_url, raw_source_json)
SELECT 'test://testdata/multi-tag-catalog-2025', '{}'
WHERE NOT EXISTS (
    SELECT 1 FROM scrape_runs
    WHERE source_url = 'test://testdata/multi-tag-catalog-2025'
);

-- ── 2. Test catalog node ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO catalog_nodes (run_id, node_id, level, title, kind, raw_json)
VALUES (
    (SELECT id FROM scrape_runs WHERE source_url = 'test://testdata/multi-tag-catalog-2025'),
    'test-multi-tag-root',
    0,
    'Test Data Catalog',
    'catalog',
    '{}'
);

-- ── 3. Test study program (isolated — no overlap with real PO programs) ──────
INSERT OR IGNORE INTO study_programs (code, name, degree, source_status)
VALUES ('TEST_DEMO_2025', 'Test Demo Program (non-official)', 'test', 'test');

-- ── 4. Test study areas (codes map via _study_area_to_master_cat) ────────────
INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-TECH',  'Test Technical Area',   'elective', 10 FROM study_programs WHERE code = 'TEST_DEMO_2025';
INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-THEO',  'Test Theory Area',      'elective', 20 FROM study_programs WHERE code = 'TEST_DEMO_2025';
INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-PRAK',  'Test Practical Area',   'elective', 30 FROM study_programs WHERE code = 'TEST_DEMO_2025';
INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-INFO',  'Test Informatics Area', 'elective', 40 FROM study_programs WHERE code = 'TEST_DEMO_2025';
INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-BASIS', 'Test Foundations Area', 'elective', 50 FROM study_programs WHERE code = 'TEST_DEMO_2025';

-- ── 5. Test curriculum modules (one per master category) ─────────────────────
INSERT OR IGNORE INTO curriculum_modules (module_code, title, ects, module_type, level, source_note, raw_json)
VALUES
    ('TEST-MOD-TECH',  'Test Module: Technical Systems',  6.0, 'lecture', 'master', 'Test data — non-official.', '{}'),
    ('TEST-MOD-THEO',  'Test Module: Theory',             6.0, 'lecture', 'master', 'Test data — non-official.', '{}'),
    ('TEST-MOD-PRAK',  'Test Module: Practical Projects', 6.0, 'lecture', 'master', 'Test data — non-official.', '{}'),
    ('TEST-MOD-INFO',  'Test Module: Informatics Depth',  6.0, 'lecture', 'master', 'Test data — non-official.', '{}'),
    ('TEST-MOD-BASIS', 'Test Module: Foundations',        6.0, 'lecture', 'master', 'Test data — non-official.', '{}');

-- ── 6. Link test modules → test study areas ──────────────────────────────────
INSERT OR IGNORE INTO module_study_area_options (module_id, study_area_id, ects_counted, status, source_note)
SELECT cm.id, sa.id, 6.0, 'allowed', 'Test data mapping.'
FROM curriculum_modules cm
JOIN study_areas sa ON sa.code = 'TEST-' || SUBSTR(cm.module_code, 10)
JOIN study_programs sp ON sp.id = sa.program_id AND sp.code = 'TEST_DEMO_2025'
WHERE cm.module_code LIKE 'TEST-MOD-%';

-- ── 7. Eight test courses, inserted into every catalog period ────────────────
-- raw_json carries the period_label so the catalog UI shows the proper
-- semester name instead of the numeric ALMA period id.

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-001', p.period_id,
    '000 Test Course 01 — Cloud Security Lab', 'INFO0001-TEST',
    '000 Test Course 01 — Cloud Security Lab',
    'Fachbereich Informatik (Test Data)', 'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Cloud infrastructure security with hands-on lab work.',
    'test://course/001', json_object('period_label', p.label, 'testdata', 1)
FROM scrape_runs sr,
     (SELECT period_id, MAX(json_extract(raw_json, '$.period_label')) AS label
      FROM courses WHERE number NOT LIKE '%-TEST' GROUP BY period_id) AS p
WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-002', p.period_id,
    '000 Test Course 02 — UX for AI Study Tools', 'INFO0002-TEST',
    '000 Test Course 02 — UX for AI Study Tools',
    'Fachbereich Informatik (Test Data)', 'Seminar',
    'TEST DATA — non-official demo course. 6 ECTS. Human-centered design of AI-powered learning applications.',
    'test://course/002', json_object('period_label', p.label, 'testdata', 1)
FROM scrape_runs sr,
     (SELECT period_id, MAX(json_extract(raw_json, '$.period_label')) AS label
      FROM courses WHERE number NOT LIKE '%-TEST' GROUP BY period_id) AS p
WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-003', p.period_id,
    '000 Test Course 03 — Vision Robotics Project', 'INFO0003-TEST',
    '000 Test Course 03 — Vision Robotics Project',
    'Fachbereich Informatik (Test Data)', 'Lab',
    'TEST DATA — non-official demo course. 6 ECTS. Integration of visual perception algorithms in robotic systems.',
    'test://course/003', json_object('period_label', p.label, 'testdata', 1)
FROM scrape_runs sr,
     (SELECT period_id, MAX(json_extract(raw_json, '$.period_label')) AS label
      FROM courses WHERE number NOT LIKE '%-TEST' GROUP BY period_id) AS p
WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-004', p.period_id,
    '000 Test Course 04 — Data Engineering Systems', 'INFO0004-TEST',
    '000 Test Course 04 — Data Engineering Systems',
    'Fachbereich Informatik (Test Data)', 'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Batch and stream processing pipelines, data lakehouse design.',
    'test://course/004', json_object('period_label', p.label, 'testdata', 1)
FROM scrape_runs sr,
     (SELECT period_id, MAX(json_extract(raw_json, '$.period_label')) AS label
      FROM courses WHERE number NOT LIKE '%-TEST' GROUP BY period_id) AS p
WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-005', p.period_id,
    '000 Test Course 05 — Formal Methods for ML', 'INFO0005-TEST',
    '000 Test Course 05 — Formal Methods for ML',
    'Fachbereich Informatik (Test Data)', 'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Verification and probabilistic guarantees for ML systems.',
    'test://course/005', json_object('period_label', p.label, 'testdata', 1)
FROM scrape_runs sr,
     (SELECT period_id, MAX(json_extract(raw_json, '$.period_label')) AS label
      FROM courses WHERE number NOT LIKE '%-TEST' GROUP BY period_id) AS p
WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-006', p.period_id,
    '000 Test Course 06 — Human-Centered Security', 'INFO0006-TEST',
    '000 Test Course 06 — Human-Centered Security',
    'Fachbereich Informatik (Test Data)', 'Seminar',
    'TEST DATA — non-official demo course. 6 ECTS. Intersection of usability research and applied security engineering.',
    'test://course/006', json_object('period_label', p.label, 'testdata', 1)
FROM scrape_runs sr,
     (SELECT period_id, MAX(json_extract(raw_json, '$.period_label')) AS label
      FROM courses WHERE number NOT LIKE '%-TEST' GROUP BY period_id) AS p
WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-007', p.period_id,
    '000 Test Course 07 — Scalable Software Architecture', 'INFO0007-TEST',
    '000 Test Course 07 — Scalable Software Architecture',
    'Fachbereich Informatik (Test Data)', 'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Design patterns, microservices, and distributed system tradeoffs.',
    'test://course/007', json_object('period_label', p.label, 'testdata', 1)
FROM scrape_runs sr,
     (SELECT period_id, MAX(json_extract(raw_json, '$.period_label')) AS label
      FROM courses WHERE number NOT LIKE '%-TEST' GROUP BY period_id) AS p
WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-008', p.period_id,
    '000 Test Course 08 — Autonomous Data Platforms', 'INFO0008-TEST',
    '000 Test Course 08 — Autonomous Data Platforms',
    'Fachbereich Informatik (Test Data)', 'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Self-managing databases and ML-integrated data infrastructure.',
    'test://course/008', json_object('period_label', p.label, 'testdata', 1)
FROM scrape_runs sr,
     (SELECT period_id, MAX(json_extract(raw_json, '$.period_label')) AS label
      FROM courses WHERE number NOT LIKE '%-TEST' GROUP BY period_id) AS p
WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

-- ── 8. Parallel groups (one main group per course, exercise group for 01/08) ─
INSERT OR IGNORE INTO parallel_groups (course_id, position, group_type, raw_json)
SELECT c.id, 1, c.course_type, '{}'
FROM courses c WHERE c.number LIKE 'INFO000_-TEST';

INSERT OR IGNORE INTO parallel_groups (course_id, position, group_type, raw_json)
SELECT c.id, 2, 'Exercise', '{}'
FROM courses c WHERE c.number IN ('INFO0001-TEST', 'INFO0008-TEST');

-- ── 9. Weekly appointments (planner schedule slots) ──────────────────────────
-- Courses 03 and 08 overlap on Tuesday 10:00–12:00 on purpose so planner
-- conflict handling can be tested.

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Mon', 1, '10:00 - 12:00', '10:00', '12:00', 'Test Room A1 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0001-TEST' AND pg.position = 1;

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Thu', 4, '08:00 - 10:00', '08:00', '10:00', 'Test Room A2 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0001-TEST' AND pg.position = 2;

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Mon', 1, '14:00 - 16:00', '14:00', '16:00', 'Test Room B1 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0002-TEST' AND pg.position = 1;

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Tue', 2, '10:00 - 12:00', '10:00', '12:00', 'Test Room C1 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0003-TEST' AND pg.position = 1;

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Wed', 3, '08:00 - 10:00', '08:00', '10:00', 'Test Room D1 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0004-TEST' AND pg.position = 1;

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Wed', 3, '10:00 - 12:00', '10:00', '12:00', 'Test Room D2 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0005-TEST' AND pg.position = 1;

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Thu', 4, '14:00 - 16:00', '14:00', '16:00', 'Test Room E1 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0006-TEST' AND pg.position = 1;

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Fri', 5, '10:00 - 12:00', '10:00', '12:00', 'Test Room F1 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0007-TEST' AND pg.position = 1;

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Tue', 2, '10:00 - 12:00', '10:00', '12:00', 'Test Room G1 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0008-TEST' AND pg.position = 1;

INSERT OR IGNORE INTO appointments
    (parallel_group_id, position, rhythm, weekday, weekday_index, time_text, start_time, end_time, room_text, raw_json)
SELECT pg.id, 1, 'wöchentlich', 'Fri', 5, '14:00 - 16:00', '14:00', '16:00', 'Test Room G2 (Test Building)', '{}'
FROM parallel_groups pg JOIN courses c ON c.id = pg.course_id
WHERE c.number = 'INFO0008-TEST' AND pg.position = 2;

-- ── 10. Course → curriculum module links (masterCat combinations) ────────────
--   01 Cloud Security Lab         → TECH + PRAK          (2 tags)
--   02 UX for AI Study Tools      → INFO + PRAK + TECH   (3 tags)
--   03 Vision Robotics Project    → THEO + PRAK          (2 tags)
--   04 Data Engineering Systems   → INFO + BASIS         (2 tags)
--   05 Formal Methods for ML      → THEO + BASIS + INFO  (3 tags)
--   06 Human-Centered Security    → INFO + TECH + THEO   (3 tags)
--   07 Scalable Software Arch     → PRAK                 (1 tag — single-tag case)
--   08 Autonomous Data Platforms  → TECH + INFO + THEO   (3 tags)

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0 FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0001-TEST' AND cm.module_code IN ('TEST-MOD-TECH', 'TEST-MOD-PRAK');

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0 FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0002-TEST' AND cm.module_code IN ('TEST-MOD-INFO', 'TEST-MOD-PRAK', 'TEST-MOD-TECH');

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0 FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0003-TEST' AND cm.module_code IN ('TEST-MOD-THEO', 'TEST-MOD-PRAK');

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0 FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0004-TEST' AND cm.module_code IN ('TEST-MOD-INFO', 'TEST-MOD-BASIS');

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0 FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0005-TEST' AND cm.module_code IN ('TEST-MOD-THEO', 'TEST-MOD-BASIS', 'TEST-MOD-INFO');

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0 FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0006-TEST' AND cm.module_code IN ('TEST-MOD-INFO', 'TEST-MOD-TECH', 'TEST-MOD-THEO');

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0 FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0007-TEST' AND cm.module_code = 'TEST-MOD-PRAK';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0 FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0008-TEST' AND cm.module_code IN ('TEST-MOD-TECH', 'TEST-MOD-INFO', 'TEST-MOD-THEO');

-- ── 11. Progress category mappings (visualization radar — no regulation credit)
-- UNIQUE does not deduplicate NULL regulation_version_id rows, so use
-- NOT EXISTS instead of OR IGNORE to stay idempotent.
INSERT INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc
JOIN courses c ON c.number LIKE 'INFO000_-TEST'
WHERE (
        (c.number = 'INFO0001-TEST' AND pc.code IN ('CLOUD_DEV', 'SYSTEMS_SECURITY'))
     OR (c.number = 'INFO0002-TEST' AND pc.code IN ('HCI_UX', 'AI_ML', 'SOFTWARE_ENG'))
     OR (c.number = 'INFO0003-TEST' AND pc.code IN ('VISION', 'ROBOTICS'))
     OR (c.number = 'INFO0004-TEST' AND pc.code IN ('DATA_DATABASES', 'CLOUD_DEV', 'SYSTEMS_SECURITY'))
     OR (c.number = 'INFO0005-TEST' AND pc.code IN ('THEORY', 'AI_ML', 'MATHEMATICS'))
     OR (c.number = 'INFO0006-TEST' AND pc.code IN ('HCI_UX', 'SYSTEMS_SECURITY', 'THEORY'))
     OR (c.number = 'INFO0007-TEST' AND pc.code IN ('SOFTWARE_ENG', 'CLOUD_DEV', 'DATA_DATABASES'))
     OR (c.number = 'INFO0008-TEST' AND pc.code IN ('ROBOTICS', 'DATA_DATABASES', 'AI_ML'))
)
AND NOT EXISTS (
    SELECT 1 FROM course_progress_category_mappings existing
    WHERE existing.progress_category_id = pc.id
      AND existing.course_id = c.id
      AND existing.regulation_version_id IS NULL
);
