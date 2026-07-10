PRAGMA foreign_keys = ON;

-- user_id refers to the removed numeric-account model. Current authentication
-- uses stable usernames, so retain old rows and store new log ownership here.
ALTER TABLE client_error_log ADD COLUMN user_username TEXT;
CREATE INDEX IF NOT EXISTS idx_client_error_log_user_username_created_at
    ON client_error_log(user_username, created_at_unix);

-- One row per anonymous client and endpoint scope. The client value is a
-- SHA-256 digest in application code; no raw IP addresses are persisted.
CREATE TABLE IF NOT EXISTS request_rate_limits (
    scope TEXT NOT NULL,
    client_key TEXT NOT NULL,
    window_started_at_unix INTEGER NOT NULL,
    request_count INTEGER NOT NULL,
    PRIMARY KEY (scope, client_key)
);
