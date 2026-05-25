PRAGMA foreign_keys = ON;

CREATE TABLE user_transcript_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    issue_key TEXT NOT NULL,
    candidate_json TEXT NOT NULL,
    created_at_unix INTEGER NOT NULL,
    updated_at_unix INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, issue_key)
);

CREATE INDEX idx_user_transcript_issues_user_id
    ON user_transcript_issues(user_id, updated_at_unix DESC, id ASC);
