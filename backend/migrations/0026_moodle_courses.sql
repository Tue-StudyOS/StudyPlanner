PRAGMA foreign_keys = ON;

-- Public Moodle category scrape snapshots. Moodle is supplemental metadata:
-- ALMA remains the authority for schedules, lecturers, and participant limits.
CREATE TABLE IF NOT EXISTS moodle_scrape_runs (
    id INTEGER PRIMARY KEY,
    source_url TEXT NOT NULL,
    category_id TEXT NOT NULL,
    category_title TEXT,
    fetched_at_unix INTEGER NOT NULL,
    finished_at_unix INTEGER,
    page_count INTEGER NOT NULL DEFAULT 0,
    course_count INTEGER NOT NULL DEFAULT 0,
    raw_json TEXT NOT NULL DEFAULT '{}',
    imported_at_unix INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS moodle_courses (
    id INTEGER PRIMARY KEY,
    run_id INTEGER NOT NULL,
    moodle_course_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    course_url TEXT NOT NULL,
    enrol_url TEXT,
    summary_text TEXT,
    summary_html TEXT,
    teachers_json TEXT NOT NULL DEFAULT '[]',
    detected_codes_json TEXT NOT NULL DEFAULT '[]',
    detected_terms_json TEXT NOT NULL DEFAULT '[]',
    self_enrol_available INTEGER,
    guest_access INTEGER,
    limit_mentioned INTEGER NOT NULL DEFAULT 0,
    limit_text TEXT,
    participant_limit_value INTEGER,
    raw_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE (run_id, moodle_course_id),
    FOREIGN KEY (run_id) REFERENCES moodle_scrape_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS moodle_course_matches (
    id INTEGER PRIMARY KEY,
    moodle_course_row_id INTEGER NOT NULL,
    course_id INTEGER,
    course_number TEXT,
    period_id TEXT,
    match_method TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'candidate',
    evidence_json TEXT NOT NULL DEFAULT '{}',
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (moodle_course_row_id) REFERENCES moodle_courses(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- Course-id scoped learning links produced by source scrapes/matches. This is
-- more precise than course_external_links, which is keyed only by course number.
CREATE TABLE IF NOT EXISTS course_learning_links (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    external_id TEXT,
    url TEXT NOT NULL,
    label TEXT,
    source TEXT NOT NULL,
    confidence REAL,
    matched_by TEXT,
    fetched_at_unix INTEGER,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (course_id, platform, external_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_moodle_courses_course_id
    ON moodle_courses(moodle_course_id);

CREATE INDEX IF NOT EXISTS idx_moodle_courses_run
    ON moodle_courses(run_id);

CREATE INDEX IF NOT EXISTS idx_moodle_course_matches_course
    ON moodle_course_matches(course_id);

CREATE INDEX IF NOT EXISTS idx_moodle_course_matches_status
    ON moodle_course_matches(status, confidence);

CREATE INDEX IF NOT EXISTS idx_course_learning_links_course
    ON course_learning_links(course_id);
