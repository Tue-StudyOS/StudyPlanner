PRAGMA foreign_keys = ON;

-- Anonymous course reviews.
--
-- Keyed on the ALMA course number (COALESCE(courses.number, courses.unit_id))
-- rather than courses.id: the catalog importer reassigns course ids from 1 on
-- every in-place re-seed, so an id-keyed review would silently re-point to a
-- different course. This mirrors course_external_links (migration 0021).
--
-- username is stored only to enforce one review per person per course and to
-- let an author edit their own review. It is never returned by the public read.
CREATE TABLE IF NOT EXISTS course_reviews (
    id INTEGER PRIMARY KEY,
    course_key TEXT NOT NULL,
    username TEXT NOT NULL,
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    exam_rating INTEGER CHECK (exam_rating BETWEEN 1 AND 5),
    content_rating INTEGER CHECK (content_rating BETWEEN 1 AND 5),
    tutorial_rating INTEGER CHECK (tutorial_rating BETWEEN 1 AND 5),
    comment TEXT,
    taken_period_label TEXT,
    lecturer_name TEXT,
    lecturer_custom_name TEXT,
    is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (course_key, username),
    FOREIGN KEY (username) REFERENCES user_auth(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_reviews_course_key
    ON course_reviews(course_key, is_hidden);
