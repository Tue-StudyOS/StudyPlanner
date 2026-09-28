-- Guest reviews have no user_auth row. The username foreign key rejected those
-- authors, so the table is rebuilt without it. Account deletion deletes the
-- author's rows explicitly instead of relying on ON DELETE CASCADE.
PRAGMA foreign_keys = OFF;

CREATE TABLE course_reviews_rebuilt (
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
    retention_hold INTEGER NOT NULL DEFAULT 0 CHECK (retention_hold IN (0, 1)),
    moderation_status TEXT NOT NULL DEFAULT 'published'
        CHECK (moderation_status IN ('published', 'reviewed', 'hidden', 'restored')),
    moderation_category TEXT,
    moderation_reason TEXT,
    moderation_action TEXT,
    moderated_by TEXT,
    moderated_at_unix INTEGER,
    UNIQUE (course_key, username)
);

INSERT INTO course_reviews_rebuilt (
    id, course_key, username, overall_rating, exam_rating, content_rating,
    tutorial_rating, comment, taken_period_label, lecturer_name, lecturer_custom_name,
    is_hidden, created_at_unix, updated_at_unix, retention_hold, moderation_status,
    moderation_category, moderation_reason, moderation_action, moderated_by, moderated_at_unix
)
SELECT
    id, course_key, username, overall_rating, exam_rating, content_rating,
    tutorial_rating, comment, taken_period_label, lecturer_name, lecturer_custom_name,
    is_hidden, created_at_unix, updated_at_unix, retention_hold, moderation_status,
    moderation_category, moderation_reason, moderation_action, moderated_by, moderated_at_unix
FROM course_reviews;

DROP TABLE course_reviews;
ALTER TABLE course_reviews_rebuilt RENAME TO course_reviews;

CREATE INDEX IF NOT EXISTS idx_course_reviews_course_key
    ON course_reviews(course_key, is_hidden);
CREATE INDEX IF NOT EXISTS idx_course_reviews_hidden_retention
    ON course_reviews(is_hidden, retention_hold, updated_at_unix);

PRAGMA foreign_keys = ON;
