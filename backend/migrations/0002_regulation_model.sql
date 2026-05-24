PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS examination_regulations (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    degree TEXT,
    subject TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS regulation_versions (
    id INTEGER PRIMARY KEY,
    regulation_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    version_label TEXT NOT NULL,
    total_ects REAL,
    language TEXT,
    source_status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    FOREIGN KEY (regulation_id) REFERENCES examination_regulations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_program_regulation_versions (
    study_program_id INTEGER NOT NULL,
    regulation_version_id INTEGER NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    enrollment_match TEXT NOT NULL DEFAULT 'program_code',
    PRIMARY KEY (study_program_id, regulation_version_id),
    FOREIGN KEY (study_program_id) REFERENCES study_programs(id) ON DELETE CASCADE,
    FOREIGN KEY (regulation_version_id) REFERENCES regulation_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS regulation_rule_groups (
    id INTEGER PRIMARY KEY,
    regulation_version_id INTEGER NOT NULL,
    study_area_id INTEGER,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    group_type TEXT NOT NULL DEFAULT 'study_area',
    required_ects REAL,
    min_ects REAL,
    max_ects REAL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    UNIQUE (regulation_version_id, code),
    FOREIGN KEY (regulation_version_id) REFERENCES regulation_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (study_area_id) REFERENCES study_areas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS regulation_course_mappings (
    id INTEGER PRIMARY KEY,
    regulation_version_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    module_id INTEGER,
    rule_group_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'allowed',
    ects_counted REAL,
    match_type TEXT NOT NULL DEFAULT 'curriculum_match',
    source_note TEXT,
    UNIQUE (regulation_version_id, course_id, rule_group_id, status),
    FOREIGN KEY (regulation_version_id) REFERENCES regulation_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES curriculum_modules(id) ON DELETE SET NULL,
    FOREIGN KEY (rule_group_id) REFERENCES regulation_rule_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_regulation_versions_regulation
    ON regulation_versions(regulation_id);

CREATE INDEX IF NOT EXISTS idx_study_program_regulation_versions_program
    ON study_program_regulation_versions(study_program_id);

CREATE INDEX IF NOT EXISTS idx_study_program_regulation_versions_version
    ON study_program_regulation_versions(regulation_version_id);

CREATE INDEX IF NOT EXISTS idx_regulation_rule_groups_version
    ON regulation_rule_groups(regulation_version_id);

CREATE INDEX IF NOT EXISTS idx_regulation_rule_groups_area
    ON regulation_rule_groups(study_area_id);

CREATE INDEX IF NOT EXISTS idx_regulation_course_mappings_version
    ON regulation_course_mappings(regulation_version_id);

CREATE INDEX IF NOT EXISTS idx_regulation_course_mappings_course
    ON regulation_course_mappings(course_id);

CREATE INDEX IF NOT EXISTS idx_regulation_course_mappings_rule_group
    ON regulation_course_mappings(rule_group_id);
