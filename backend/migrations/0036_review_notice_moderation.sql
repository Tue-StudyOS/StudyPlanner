PRAGMA foreign_keys = ON;

ALTER TABLE course_reviews
    ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'published'
    CHECK (moderation_status IN ('published', 'reviewed', 'hidden', 'restored'));
ALTER TABLE course_reviews ADD COLUMN moderation_category TEXT;
ALTER TABLE course_reviews ADD COLUMN moderation_reason TEXT;
ALTER TABLE course_reviews ADD COLUMN moderation_action TEXT;
ALTER TABLE course_reviews ADD COLUMN moderated_by TEXT;
ALTER TABLE course_reviews ADD COLUMN moderated_at_unix INTEGER;

CREATE TABLE review_notices (
    id INTEGER PRIMARY KEY,
    review_id INTEGER NOT NULL,
    course_key TEXT NOT NULL,
    review_snapshot_json TEXT NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN (
            'illegal_content', 'privacy', 'harassment', 'defamation',
            'off_topic', 'moderation_redress', 'other'
        )
    ),
    allegation TEXT NOT NULL,
    explanation TEXT NOT NULL,
    notifier_email TEXT NOT NULL,
    good_faith INTEGER NOT NULL CHECK (good_faith = 1),
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'reviewing', 'resolved')),
    decision_action TEXT,
    decision_category TEXT,
    decision_reason TEXT,
    moderator_username TEXT,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    decided_at_unix INTEGER,
    retention_hold INTEGER NOT NULL DEFAULT 0
        CHECK (retention_hold IN (0, 1))
);

CREATE INDEX idx_review_notices_status_created
    ON review_notices(status, created_at_unix);
CREATE INDEX idx_review_notices_retention
    ON review_notices(status, retention_hold, decided_at_unix);
CREATE INDEX idx_review_notices_review_id
    ON review_notices(review_id);
