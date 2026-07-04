PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS client_error_log (
    id INTEGER PRIMARY KEY,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    status INTEGER NOT NULL,
    code TEXT,
    message TEXT NOT NULL,
    detail TEXT,
    duration_ms INTEGER,
    page_path TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_client_error_log_created_at
    ON client_error_log(created_at_unix);
