PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_semester_plans (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    semester_label TEXT NOT NULL,
    title TEXT,
    notes TEXT,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (user_id, semester_label),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_semester_plan_courses (
    plan_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (plan_id, course_id),
    FOREIGN KEY (plan_id) REFERENCES user_semester_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_semester_plans_user
    ON user_semester_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_user_semester_plans_updated
    ON user_semester_plans(updated_at_unix);

CREATE INDEX IF NOT EXISTS idx_user_semester_plan_courses_course
    ON user_semester_plan_courses(course_id);

CREATE INDEX IF NOT EXISTS idx_user_semester_plan_courses_position
    ON user_semester_plan_courses(plan_id, position);
