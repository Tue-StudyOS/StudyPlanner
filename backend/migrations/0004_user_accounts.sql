PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at_unix INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY,
    study_program_id INTEGER,
    regulation_version_id INTEGER,
    current_semester_label TEXT,
    notes TEXT,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (study_program_id) REFERENCES study_programs(id) ON DELETE SET NULL,
    FOREIGN KEY (regulation_version_id) REFERENCES regulation_versions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at_unix INTEGER NOT NULL,
    last_seen_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    revoked_at_unix INTEGER,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_favorites (
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_completed_courses (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    course_id INTEGER,
    external_course_code TEXT,
    title TEXT NOT NULL,
    ects REAL NOT NULL,
    master_cat TEXT NOT NULL,
    grade REAL,
    semester TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_study_program
    ON user_profiles(study_program_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_regulation_version
    ON user_profiles(regulation_version_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
    ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry
    ON user_sessions(expires_at_unix);

CREATE INDEX IF NOT EXISTS idx_user_completed_courses_user
    ON user_completed_courses(user_id);

CREATE INDEX IF NOT EXISTS idx_user_completed_courses_course
    ON user_completed_courses(course_id);
