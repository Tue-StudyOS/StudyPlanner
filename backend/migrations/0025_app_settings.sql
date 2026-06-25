PRAGMA foreign_keys = ON;

-- Runtime key/value settings. First use case: a deploy-time "simulated current
-- semester" toggle (key 'simulated_current_semester_label') so the new-user
-- onboarding flow can be live-tested against an upcoming-winter catalog without
-- touching the real calendar. Set/clear it with the sim:on / sim:off scripts.
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at_unix INTEGER NOT NULL DEFAULT (unixepoch())
);
