PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS progress_categories (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    reference_ects REAL NOT NULL,
    color_token TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS course_progress_category_mappings (
    id INTEGER PRIMARY KEY,
    progress_category_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    regulation_version_id INTEGER,
    weight REAL NOT NULL DEFAULT 1.0,
    source_note TEXT,
    UNIQUE (progress_category_id, course_id, regulation_version_id),
    FOREIGN KEY (progress_category_id) REFERENCES progress_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (regulation_version_id) REFERENCES regulation_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_progress_category_mappings_category
    ON course_progress_category_mappings(progress_category_id);

CREATE INDEX IF NOT EXISTS idx_course_progress_category_mappings_course
    ON course_progress_category_mappings(course_id);

CREATE INDEX IF NOT EXISTS idx_course_progress_category_mappings_regulation
    ON course_progress_category_mappings(regulation_version_id);
