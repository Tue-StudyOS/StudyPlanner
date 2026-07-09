PRAGMA foreign_keys = ON;

-- curriculum_modules was populated once from db_frontend\curriculum\informatik_curriculum.json,
-- a source file that no longer exists in the repo, so the B.Sc. Pflichtmodul
-- "Mathematik fuer Informatik 4" (INFM2020) was never seeded. The cross-listed
-- MAT-95-41/MAT-95-42 courses carry the scraped INFM2020 category code but had no
-- module row to match against. Manual seed until curriculum_modules is derived
-- from the scraped program tree (planned follow-up; see
-- backend/scripts/import_alma_json_to_d1.py, CURRICULUM_LINK_REBUILD_STATEMENTS).
-- ECTS: MATH area totals 33 = Mathe 1-3 (9 each) + Mathe 4 (6).

INSERT OR IGNORE INTO curriculum_modules (module_code, title, ects, module_type, level, source_note, raw_json)
VALUES (
    'INFM2020',
    'Mathematik fuer Informatik 4: Numerik oder Stochastik',
    6.0,
    'lecture_tutorial',
    'bachelor',
    'Manual seed (migration 0030); PO 2021 B.Sc. Informatik Pflichtmodul Mathe 4.',
    '{}'
);

INSERT OR IGNORE INTO module_study_area_options (module_id, study_area_id, ects_counted, status, source_note)
SELECT cm.id, sa.id, 6.0, 'required', 'Manual seed (migration 0030).'
FROM curriculum_modules cm
JOIN study_programs sp ON sp.code = 'BSC_INFO_2021'
JOIN study_areas sa ON sa.program_id = sp.id AND sa.code = 'MATH'
WHERE cm.module_code = 'INFM2020';

-- Backfill matches for courses already in the DB; future reseeds recreate these
-- automatically via the importer's category_code rebuild rule.
INSERT OR IGNORE INTO course_curriculum_matches (course_id, module_id, match_type, confidence)
SELECT f.course_id, cm.id, 'category_code', 0.9
FROM course_fields AS f
JOIN json_each(f.value) AS je
JOIN curriculum_modules AS cm ON cm.module_code = je.value
WHERE f."key" = '_categories_json' AND je.value = 'INFM2020';
