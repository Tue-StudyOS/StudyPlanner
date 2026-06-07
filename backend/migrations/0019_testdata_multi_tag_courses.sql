PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────────────
-- Group F: Multi-tag catalog test courses
--
-- Eight clearly-marked demo courses that sort to the top of the catalog list.
-- Names prefixed "000 Test Course NN" and numbers "INFO0001-TEST" ensure they
-- appear before all real INFO4xxx entries in both the number sort and
-- alphabetical title fallback.
--
-- These courses are NEVER mapped to any real regulation area, so they cannot
-- contaminate official progress tracking. The test study program
-- (TEST_DEMO_2025) is isolated and used only for masterCat derivation via
-- the _study_area_to_master_cat helper in course_catalog.py.
--
-- To remove this test data: DELETE FROM scrape_runs WHERE source_url =
-- 'test://testdata/multi-tag-catalog-2025'. The ON DELETE CASCADE constraints
-- will propagate and clean up all derived rows automatically.
-- ─────────────────────────────────────────────────────────────────────────────


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


-- ── 3. Test study program (isolated — no overlap with real PO programs) ───────
INSERT OR IGNORE INTO study_programs (code, name, degree, source_status)
VALUES ('TEST_DEMO_2025', 'Test Demo Program (non-official)', 'test', 'test');


-- ── 4. Test study areas (codes chosen so _study_area_to_master_cat maps them) ─
--   TEST-TECH  → endswith("TECH")  → TECH
--   TEST-THEO  → endswith("THEO")  → THEO
--   TEST-PRAK  → endswith("PRAK")  → PRAK
--   TEST-INFO  → endswith("-INFO") → INFO
--   TEST-BASIS → endswith("BASIS") → BASIS
INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-TECH',  'Test Technical Area',    'elective', 10 FROM study_programs WHERE code = 'TEST_DEMO_2025';

INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-THEO',  'Test Theory Area',        'elective', 20 FROM study_programs WHERE code = 'TEST_DEMO_2025';

INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-PRAK',  'Test Practical Area',     'elective', 30 FROM study_programs WHERE code = 'TEST_DEMO_2025';

INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-INFO',  'Test Informatics Area',   'elective', 40 FROM study_programs WHERE code = 'TEST_DEMO_2025';

INSERT OR IGNORE INTO study_areas (program_id, code, name, area_type, sort_order)
SELECT id, 'TEST-BASIS', 'Test Foundations Area',   'elective', 50 FROM study_programs WHERE code = 'TEST_DEMO_2025';


-- ── 5. Test curriculum modules (one per master category) ─────────────────────
INSERT OR IGNORE INTO curriculum_modules (module_code, title, ects, module_type, level, source_note, raw_json)
VALUES
    ('TEST-MOD-TECH',  'Test Module: Technical Systems',  6.0, 'lecture', 'master', 'Test data — non-official.', '{}'),
    ('TEST-MOD-THEO',  'Test Module: Theory',             6.0, 'lecture', 'master', 'Test data — non-official.', '{}'),
    ('TEST-MOD-PRAK',  'Test Module: Practical Projects', 6.0, 'lecture', 'master', 'Test data — non-official.', '{}'),
    ('TEST-MOD-INFO',  'Test Module: Informatics Depth',  6.0, 'lecture', 'master', 'Test data — non-official.', '{}'),
    ('TEST-MOD-BASIS', 'Test Module: Foundations',        6.0, 'lecture', 'master', 'Test data — non-official.', '{}');


-- ── 6. Link test modules → test study areas ───────────────────────────────────
INSERT OR IGNORE INTO module_study_area_options (module_id, study_area_id, ects_counted, status, source_note)
SELECT cm.id, sa.id, 6.0, 'allowed', 'Test data mapping.'
FROM curriculum_modules cm
JOIN study_areas sa ON sa.code = 'TEST-TECH'
JOIN study_programs sp ON sp.id = sa.program_id AND sp.code = 'TEST_DEMO_2025'
WHERE cm.module_code = 'TEST-MOD-TECH';

INSERT OR IGNORE INTO module_study_area_options (module_id, study_area_id, ects_counted, status, source_note)
SELECT cm.id, sa.id, 6.0, 'allowed', 'Test data mapping.'
FROM curriculum_modules cm
JOIN study_areas sa ON sa.code = 'TEST-THEO'
JOIN study_programs sp ON sp.id = sa.program_id AND sp.code = 'TEST_DEMO_2025'
WHERE cm.module_code = 'TEST-MOD-THEO';

INSERT OR IGNORE INTO module_study_area_options (module_id, study_area_id, ects_counted, status, source_note)
SELECT cm.id, sa.id, 6.0, 'allowed', 'Test data mapping.'
FROM curriculum_modules cm
JOIN study_areas sa ON sa.code = 'TEST-PRAK'
JOIN study_programs sp ON sp.id = sa.program_id AND sp.code = 'TEST_DEMO_2025'
WHERE cm.module_code = 'TEST-MOD-PRAK';

INSERT OR IGNORE INTO module_study_area_options (module_id, study_area_id, ects_counted, status, source_note)
SELECT cm.id, sa.id, 6.0, 'allowed', 'Test data mapping.'
FROM curriculum_modules cm
JOIN study_areas sa ON sa.code = 'TEST-INFO'
JOIN study_programs sp ON sp.id = sa.program_id AND sp.code = 'TEST_DEMO_2025'
WHERE cm.module_code = 'TEST-MOD-INFO';

INSERT OR IGNORE INTO module_study_area_options (module_id, study_area_id, ects_counted, status, source_note)
SELECT cm.id, sa.id, 6.0, 'allowed', 'Test data mapping.'
FROM curriculum_modules cm
JOIN study_areas sa ON sa.code = 'TEST-BASIS'
JOIN study_programs sp ON sp.id = sa.program_id AND sp.code = 'TEST_DEMO_2025'
WHERE cm.module_code = 'TEST-MOD-BASIS';


-- ── 7. Eight test courses ─────────────────────────────────────────────────────
-- Numbers INFO0001-TEST … INFO0008-TEST:
--   • Pass the catalog filter (LIKE 'INFO%')
--   • Sort in CASE group 0 (INFO%) before all real INFO4xxx entries
--   • unit_id + detail_url each unique to satisfy the UNIQUE constraint
-- ECTS=6 stored in short_comment ("6 ECTS") as fallback for the extractor;
-- the curriculum_module.ects=6 is the primary source once matches are linked.

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-001', 'TEST-2025',
    '000 Test Course 01 — Cloud Security Lab',
    'INFO0001-TEST',
    '000 Test Course 01 — Cloud Security Lab',
    'Fachbereich Informatik (Test Data)',
    'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Cloud infrastructure security with hands-on lab work.',
    'test://course/001',
    '{}'
FROM scrape_runs sr WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-002', 'TEST-2025',
    '000 Test Course 02 — UX for AI Study Tools',
    'INFO0002-TEST',
    '000 Test Course 02 — UX for AI Study Tools',
    'Fachbereich Informatik (Test Data)',
    'Seminar',
    'TEST DATA — non-official demo course. 6 ECTS. Human-centered design of AI-powered learning applications.',
    'test://course/002',
    '{}'
FROM scrape_runs sr WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-003', 'TEST-2025',
    '000 Test Course 03 — Vision Robotics Project',
    'INFO0003-TEST',
    '000 Test Course 03 — Vision Robotics Project',
    'Fachbereich Informatik (Test Data)',
    'Lab',
    'TEST DATA — non-official demo course. 6 ECTS. Integration of visual perception algorithms in robotic systems.',
    'test://course/003',
    '{}'
FROM scrape_runs sr WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-004', 'TEST-2025',
    '000 Test Course 04 — Data Engineering Systems',
    'INFO0004-TEST',
    '000 Test Course 04 — Data Engineering Systems',
    'Fachbereich Informatik (Test Data)',
    'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Batch and stream processing pipelines, data lakehouse design.',
    'test://course/004',
    '{}'
FROM scrape_runs sr WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-005', 'TEST-2025',
    '000 Test Course 05 — Formal Methods for ML',
    'INFO0005-TEST',
    '000 Test Course 05 — Formal Methods for ML',
    'Fachbereich Informatik (Test Data)',
    'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Verification and probabilistic guarantees for ML systems.',
    'test://course/005',
    '{}'
FROM scrape_runs sr WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-006', 'TEST-2025',
    '000 Test Course 06 — Human-Centered Security',
    'INFO0006-TEST',
    '000 Test Course 06 — Human-Centered Security',
    'Fachbereich Informatik (Test Data)',
    'Seminar',
    'TEST DATA — non-official demo course. 6 ECTS. Intersection of usability research and applied security engineering.',
    'test://course/006',
    '{}'
FROM scrape_runs sr WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-007', 'TEST-2025',
    '000 Test Course 07 — Scalable Software Architecture',
    'INFO0007-TEST',
    '000 Test Course 07 — Scalable Software Architecture',
    'Fachbereich Informatik (Test Data)',
    'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Design patterns, microservices, and distributed system tradeoffs.',
    'test://course/007',
    '{}'
FROM scrape_runs sr WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';

INSERT OR IGNORE INTO courses
    (run_id, node_id, unit_id, period_id, title, number, catalog_title,
     organisation, course_type, short_comment, detail_url, raw_json)
SELECT
    sr.id, 'test-multi-tag-root', 'TEST-008', 'TEST-2025',
    '000 Test Course 08 — Autonomous Data Platforms',
    'INFO0008-TEST',
    '000 Test Course 08 — Autonomous Data Platforms',
    'Fachbereich Informatik (Test Data)',
    'Lecture',
    'TEST DATA — non-official demo course. 6 ECTS. Self-managing databases and ML-integrated data infrastructure.',
    'test://course/008',
    '{}'
FROM scrape_runs sr WHERE sr.source_url = 'test://testdata/multi-tag-catalog-2025';


-- ── 8. Course → curriculum module links (produces masterCats in catalog) ──────
-- Each link contributes one masterCat from the module's study area code.
-- Courses with N links show N distinct CatBadge tags in the catalog card.
--
-- masterCat distribution:
--   01 Cloud Security Lab         → TECH + PRAK          (2 tags)
--   02 UX for AI Study Tools      → INFO + PRAK + TECH   (3 tags)
--   03 Vision Robotics Project    → THEO + PRAK          (2 tags)
--   04 Data Engineering Systems   → INFO + BASIS         (2 tags)
--   05 Formal Methods for ML      → THEO + BASIS + INFO  (3 tags)
--   06 Human-Centered Security    → INFO + TECH + THEO   (3 tags)
--   07 Scalable Software Arch     → PRAK                 (1 tag — single-tag case)
--   08 Autonomous Data Platforms  → TECH + INFO + THEO   (3 tags)

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0001-TEST' AND c.unit_id = 'TEST-001' AND cm.module_code = 'TEST-MOD-TECH';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0001-TEST' AND c.unit_id = 'TEST-001' AND cm.module_code = 'TEST-MOD-PRAK';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0002-TEST' AND c.unit_id = 'TEST-002' AND cm.module_code = 'TEST-MOD-INFO';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0002-TEST' AND c.unit_id = 'TEST-002' AND cm.module_code = 'TEST-MOD-PRAK';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0002-TEST' AND c.unit_id = 'TEST-002' AND cm.module_code = 'TEST-MOD-TECH';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0003-TEST' AND c.unit_id = 'TEST-003' AND cm.module_code = 'TEST-MOD-THEO';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0003-TEST' AND c.unit_id = 'TEST-003' AND cm.module_code = 'TEST-MOD-PRAK';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0004-TEST' AND c.unit_id = 'TEST-004' AND cm.module_code = 'TEST-MOD-INFO';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0004-TEST' AND c.unit_id = 'TEST-004' AND cm.module_code = 'TEST-MOD-BASIS';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0005-TEST' AND c.unit_id = 'TEST-005' AND cm.module_code = 'TEST-MOD-THEO';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0005-TEST' AND c.unit_id = 'TEST-005' AND cm.module_code = 'TEST-MOD-BASIS';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0005-TEST' AND c.unit_id = 'TEST-005' AND cm.module_code = 'TEST-MOD-INFO';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0006-TEST' AND c.unit_id = 'TEST-006' AND cm.module_code = 'TEST-MOD-INFO';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0006-TEST' AND c.unit_id = 'TEST-006' AND cm.module_code = 'TEST-MOD-TECH';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0006-TEST' AND c.unit_id = 'TEST-006' AND cm.module_code = 'TEST-MOD-THEO';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0007-TEST' AND c.unit_id = 'TEST-007' AND cm.module_code = 'TEST-MOD-PRAK';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0008-TEST' AND c.unit_id = 'TEST-008' AND cm.module_code = 'TEST-MOD-TECH';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0008-TEST' AND c.unit_id = 'TEST-008' AND cm.module_code = 'TEST-MOD-INFO';

INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT c.id, cm.id, 'test', 1.0
FROM courses c, curriculum_modules cm
WHERE c.number = 'INFO0008-TEST' AND c.unit_id = 'TEST-008' AND cm.module_code = 'TEST-MOD-THEO';


-- ── 9. Progress category mappings (visualization radar — not regulation credit) ─
-- These do NOT use regulation_version_id=NULL to intentionally avoid counting
-- toward any official regulation. The source_note marks them as test data.
--
--   01 Cloud Security Lab         → CLOUD_DEV, SYSTEMS_SECURITY
--   02 UX for AI Study Tools      → HCI_UX, AI_ML, SOFTWARE_ENG
--   03 Vision Robotics Project    → VISION, ROBOTICS
--   04 Data Engineering Systems   → DATA_DATABASES, CLOUD_DEV, SYSTEMS_SECURITY
--   05 Formal Methods for ML      → THEORY, AI_ML, MATHEMATICS
--   06 Human-Centered Security    → HCI_UX, SYSTEMS_SECURITY, THEORY
--   07 Scalable Software Arch     → SOFTWARE_ENG, CLOUD_DEV, DATA_DATABASES
--   08 Autonomous Data Platforms  → ROBOTICS, DATA_DATABASES, AI_ML

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'CLOUD_DEV' AND c.number = 'INFO0001-TEST' AND c.unit_id = 'TEST-001';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'SYSTEMS_SECURITY' AND c.number = 'INFO0001-TEST' AND c.unit_id = 'TEST-001';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'HCI_UX' AND c.number = 'INFO0002-TEST' AND c.unit_id = 'TEST-002';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'AI_ML' AND c.number = 'INFO0002-TEST' AND c.unit_id = 'TEST-002';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'SOFTWARE_ENG' AND c.number = 'INFO0002-TEST' AND c.unit_id = 'TEST-002';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'VISION' AND c.number = 'INFO0003-TEST' AND c.unit_id = 'TEST-003';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'ROBOTICS' AND c.number = 'INFO0003-TEST' AND c.unit_id = 'TEST-003';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'DATA_DATABASES' AND c.number = 'INFO0004-TEST' AND c.unit_id = 'TEST-004';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'CLOUD_DEV' AND c.number = 'INFO0004-TEST' AND c.unit_id = 'TEST-004';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'SYSTEMS_SECURITY' AND c.number = 'INFO0004-TEST' AND c.unit_id = 'TEST-004';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'THEORY' AND c.number = 'INFO0005-TEST' AND c.unit_id = 'TEST-005';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'AI_ML' AND c.number = 'INFO0005-TEST' AND c.unit_id = 'TEST-005';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'MATHEMATICS' AND c.number = 'INFO0005-TEST' AND c.unit_id = 'TEST-005';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'HCI_UX' AND c.number = 'INFO0006-TEST' AND c.unit_id = 'TEST-006';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'SYSTEMS_SECURITY' AND c.number = 'INFO0006-TEST' AND c.unit_id = 'TEST-006';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'THEORY' AND c.number = 'INFO0006-TEST' AND c.unit_id = 'TEST-006';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'SOFTWARE_ENG' AND c.number = 'INFO0007-TEST' AND c.unit_id = 'TEST-007';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'CLOUD_DEV' AND c.number = 'INFO0007-TEST' AND c.unit_id = 'TEST-007';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'DATA_DATABASES' AND c.number = 'INFO0007-TEST' AND c.unit_id = 'TEST-007';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'ROBOTICS' AND c.number = 'INFO0008-TEST' AND c.unit_id = 'TEST-008';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'DATA_DATABASES' AND c.number = 'INFO0008-TEST' AND c.unit_id = 'TEST-008';

INSERT OR IGNORE INTO course_progress_category_mappings (progress_category_id, course_id, regulation_version_id, source_note)
SELECT pc.id, c.id, NULL, 'Test data: multi-tag catalog course — not counted toward regulation progress.'
FROM progress_categories pc, courses c
WHERE pc.code = 'AI_ML' AND c.number = 'INFO0008-TEST' AND c.unit_id = 'TEST-008';
