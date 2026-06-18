PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_feedback (
    id INTEGER PRIMARY KEY,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    message TEXT NOT NULL,
    page_path TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('auto_prompt', 'feedback_button')),
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at
    ON user_feedback(created_at_unix);
