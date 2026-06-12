PRAGMA foreign_keys = ON;

-- The multi-tag demo courses from 0019 are no longer needed. Deleting the
-- test scrape run cascades to its catalog nodes, courses, parallel groups,
-- appointments, and curriculum matches.
DELETE FROM scrape_runs
WHERE source_url = 'test://testdata/multi-tag-catalog-2025';

-- The isolated test study program cascades to its study areas and their
-- module/study-area options.
DELETE FROM study_programs WHERE code = 'TEST_DEMO_2025';

-- The test curriculum modules have no FK back to the test program.
DELETE FROM curriculum_modules
WHERE module_code LIKE 'TEST-MOD-%'
  AND source_note = 'Test data — non-official.';
