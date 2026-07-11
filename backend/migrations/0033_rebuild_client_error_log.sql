-- The legacy user_id foreign key still referenced the removed users table.
-- SQLite validates that parent table even when user_id is NULL, so every client
-- error report failed with HTTP 500. Rebuild the table around username ownership.
PRAGMA foreign_keys = OFF;

CREATE TABLE client_error_log_rebuilt (
    id INTEGER PRIMARY KEY,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    status INTEGER NOT NULL,
    code TEXT,
    message TEXT NOT NULL,
    detail TEXT,
    duration_ms INTEGER,
    page_path TEXT,
    user_username TEXT,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO client_error_log_rebuilt (
    id,
    method,
    url,
    status,
    code,
    message,
    detail,
    duration_ms,
    page_path,
    user_username,
    created_at_unix
)
SELECT
    id,
    method,
    url,
    status,
    code,
    message,
    detail,
    duration_ms,
    page_path,
    user_username,
    created_at_unix
FROM client_error_log;

DROP TABLE client_error_log;
ALTER TABLE client_error_log_rebuilt RENAME TO client_error_log;

CREATE INDEX idx_client_error_log_created_at
    ON client_error_log(created_at_unix);
CREATE INDEX idx_client_error_log_user_username_created_at
    ON client_error_log(user_username, created_at_unix);

PRAGMA foreign_keys = ON;
