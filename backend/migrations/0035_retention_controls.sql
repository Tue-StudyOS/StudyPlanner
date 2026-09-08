PRAGMA foreign_keys = ON;

-- A hold must be an explicit exceptional decision for an active dispute. It is
-- never set by the normal hide/restore moderation path.
ALTER TABLE course_reviews
    ADD COLUMN retention_hold INTEGER NOT NULL DEFAULT 0
    CHECK (retention_hold IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_course_reviews_hidden_retention
    ON course_reviews(is_hidden, retention_hold, updated_at_unix);

CREATE INDEX IF NOT EXISTS idx_request_rate_limits_window
    ON request_rate_limits(window_started_at_unix);
