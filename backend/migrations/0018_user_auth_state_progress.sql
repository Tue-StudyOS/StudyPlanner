PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS user_auth (
    username TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at_unix INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_state (
    username TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    study_program_id INTEGER,
    regulation_version_id INTEGER,
    current_semester_label TEXT,
    planner_mobile_mode TEXT NOT NULL DEFAULT 'auto',
    planner_mobile_layout TEXT NOT NULL DEFAULT 'compact-grid',
    favorites_json TEXT NOT NULL DEFAULT '[]',
    semester_plans_json TEXT NOT NULL DEFAULT '{}',
    settings_json TEXT NOT NULL DEFAULT '{}',
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (username) REFERENCES user_auth(username) ON DELETE CASCADE,
    FOREIGN KEY (study_program_id) REFERENCES study_programs(id) ON DELETE SET NULL,
    FOREIGN KEY (regulation_version_id) REFERENCES regulation_versions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_progress (
    username TEXT PRIMARY KEY,
    completed_courses_json TEXT NOT NULL DEFAULT '[]',
    transcript_review_items_json TEXT NOT NULL DEFAULT '[]',
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (username) REFERENCES user_auth(username) ON DELETE CASCADE
);

INSERT OR IGNORE INTO user_auth (
    username,
    email,
    password_hash,
    password_salt,
    created_at_unix,
    updated_at_unix
)
SELECT
    lower(trim(email)) AS username,
    lower(trim(email)) AS email,
    password_hash,
    password_salt,
    created_at_unix,
    updated_at_unix
FROM users
WHERE trim(email) <> '';

INSERT OR IGNORE INTO user_state (
    username,
    display_name,
    study_program_id,
    regulation_version_id,
    current_semester_label,
    planner_mobile_mode,
    planner_mobile_layout,
    favorites_json,
    semester_plans_json,
    settings_json,
    created_at_unix,
    updated_at_unix
)
SELECT
    lower(trim(u.email)) AS username,
    COALESCE(NULLIF(trim(u.display_name), ''), lower(trim(u.email))) AS display_name,
    up.study_program_id,
    up.regulation_version_id,
    up.current_semester_label,
    COALESCE(NULLIF(up.planner_mobile_mode, ''), 'auto') AS planner_mobile_mode,
    COALESCE(NULLIF(up.planner_mobile_layout, ''), 'compact-grid') AS planner_mobile_layout,
    COALESCE((
        SELECT json_group_array(CAST(f.course_id AS TEXT))
        FROM (
            SELECT course_id
            FROM user_favorites
            WHERE user_id = u.id
            ORDER BY created_at_unix ASC, course_id ASC
        ) AS f
    ), '[]') AS favorites_json,
    COALESCE((
        SELECT json_group_object(plan_rows.semester_label, json(plan_rows.plan_json))
        FROM (
            SELECT
                usp.semester_label,
                json_object(
                    'semesterLabel', usp.semester_label,
                    'title', usp.title,
                    'notes', usp.notes,
                    'courseIds', json(COALESCE((
                        SELECT json_group_array(CAST(pc.course_id AS TEXT))
                        FROM (
                            SELECT course_id
                            FROM user_semester_plan_courses
                            WHERE plan_id = usp.id
                            ORDER BY position ASC, created_at_unix ASC, course_id ASC
                        ) AS pc
                    ), '[]')),
                    'courseAssignments', json(COALESCE((
                        SELECT json_group_object(CAST(pca.course_id AS TEXT), pca.study_area_code)
                        FROM (
                            SELECT course_id, study_area_code
                            FROM user_semester_plan_courses
                            WHERE plan_id = usp.id
                              AND study_area_code IS NOT NULL
                              AND trim(study_area_code) <> ''
                            ORDER BY position ASC, course_id ASC
                        ) AS pca
                    ), '{}')),
                    'hiddenSlotIds', json(
                        CASE
                            WHEN json_valid(COALESCE(NULLIF(usp.hidden_slot_ids, ''), '[]'))
                                THEN COALESCE(NULLIF(usp.hidden_slot_ids, ''), '[]')
                            ELSE '[]'
                        END
                    ),
                    'createdAtUnix', usp.created_at_unix,
                    'updatedAtUnix', usp.updated_at_unix
                ) AS plan_json
            FROM user_semester_plans AS usp
            WHERE usp.user_id = u.id
            ORDER BY usp.updated_at_unix ASC, usp.semester_label ASC
        ) AS plan_rows
    ), '{}') AS semester_plans_json,
    '{}' AS settings_json,
    u.created_at_unix,
    COALESCE(up.updated_at_unix, u.updated_at_unix) AS updated_at_unix
FROM users AS u
LEFT JOIN user_profiles AS up ON up.user_id = u.id
WHERE trim(u.email) <> '';

INSERT OR IGNORE INTO user_progress (
    username,
    completed_courses_json,
    transcript_review_items_json,
    created_at_unix,
    updated_at_unix
)
SELECT
    lower(trim(u.email)) AS username,
    COALESCE((
        SELECT json_group_array(json_object(
            'id', CAST(cc.id AS TEXT),
            'courseId', cc.course_id,
            'externalCourseCode', cc.external_course_code,
            'title', cc.title,
            'ects', cc.ects,
            'masterCat', CASE cc.master_cat WHEN 'FOKUS' THEN 'BASIS' ELSE cc.master_cat END,
            'studyAreaCode', cc.study_area_code,
            'grade', cc.grade,
            'semester', cc.semester,
            'source', cc.source,
            'createdAtUnix', cc.created_at_unix,
            'updatedAtUnix', cc.updated_at_unix
        ))
        FROM (
            SELECT *
            FROM user_completed_courses
            WHERE user_id = u.id
            ORDER BY created_at_unix ASC, id ASC
        ) AS cc
    ), '[]') AS completed_courses_json,
    COALESCE((
        SELECT json_group_array(json_object(
            'id', ti.issue_key,
            'candidate', json(
                CASE
                    WHEN json_valid(ti.candidate_json) THEN ti.candidate_json
                    ELSE '{}'
                END
            ),
            'updatedAtUnix', ti.updated_at_unix
        ))
        FROM (
            SELECT *
            FROM user_transcript_issues
            WHERE user_id = u.id
            ORDER BY updated_at_unix DESC, id ASC
        ) AS ti
    ), '[]') AS transcript_review_items_json,
    u.created_at_unix,
    COALESCE((
        SELECT MAX(updated_at_unix)
        FROM user_completed_courses
        WHERE user_id = u.id
    ), u.updated_at_unix) AS updated_at_unix
FROM users AS u
WHERE trim(u.email) <> '';

DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS user_transcript_issues;
DROP TABLE IF EXISTS user_semester_plan_courses;
DROP TABLE IF EXISTS user_semester_plans;
DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS user_completed_courses;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS users;

CREATE INDEX IF NOT EXISTS idx_user_auth_email
    ON user_auth(email);

CREATE INDEX IF NOT EXISTS idx_user_state_study_program
    ON user_state(study_program_id);

CREATE INDEX IF NOT EXISTS idx_user_state_regulation_version
    ON user_state(regulation_version_id);

PRAGMA foreign_keys = ON;
