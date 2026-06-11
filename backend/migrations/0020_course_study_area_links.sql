-- Direct course -> study-area assignments from the scraped ALMA
-- 'Module / Studiengaenge' category codes (stored per course as the
-- _categories_json course field). course_curriculum_matches requires a
-- curriculum module, but most catalog courses only carry study-area codes
-- (INFO-BASIS, INFO-INFO, ML-CS, ...), so they need their own link table.
CREATE TABLE IF NOT EXISTS course_study_area_links (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    study_area_id INTEGER NOT NULL,
    source_code TEXT NOT NULL,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (course_id, study_area_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (study_area_id) REFERENCES study_areas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_study_area_links_course
    ON course_study_area_links(course_id);
