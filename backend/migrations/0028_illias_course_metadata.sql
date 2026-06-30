CREATE TABLE IF NOT EXISTS illias_scrape_runs (
    id INTEGER PRIMARY KEY,
    source_url TEXT NOT NULL,
    fetched_at_unix INTEGER NOT NULL,
    raw_source_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS illias_courses (
    ref_id TEXT PRIMARY KEY,
    run_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    object_type TEXT,
    description TEXT,
    availability TEXT,
    registration TEXT,
    deadline TEXT,
    max_participants INTEGER,
    tags_json TEXT NOT NULL DEFAULT '[]',
    instructors_json TEXT NOT NULL DEFAULT '[]',
    raw_fields_json TEXT NOT NULL DEFAULT '{}',
    raw_text TEXT NOT NULL DEFAULT '',
    imported_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (run_id) REFERENCES illias_scrape_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS illias_course_fields (
    course_ref_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (course_ref_id, key),
    FOREIGN KEY (course_ref_id) REFERENCES illias_courses(ref_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS illias_alma_matches (
    illias_course_ref_id TEXT PRIMARY KEY,
    alma_course_id INTEGER,
    confidence REAL NOT NULL,
    match_type TEXT NOT NULL,
    notes TEXT NOT NULL,
    candidate_count INTEGER NOT NULL,
    matched_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (illias_course_ref_id) REFERENCES illias_courses(ref_id) ON DELETE CASCADE,
    FOREIGN KEY (alma_course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_illias_courses_title
    ON illias_courses(title);

CREATE INDEX IF NOT EXISTS idx_illias_alma_matches_alma
    ON illias_alma_matches(alma_course_id);
