-- Generated from backend/data/alma.sqlite for Cloudflare D1.
-- Full-text search virtual tables are intentionally excluded for the first D1 migration.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS curriculum_modules (
    id INTEGER PRIMARY KEY,
    module_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    ects REAL,
    module_type TEXT,
    level TEXT,
    language TEXT,
    frequency TEXT,
    exam_form TEXT,
    source_note TEXT,
    raw_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS lecturers (
    id INTEGER PRIMARY KEY,
    display_name TEXT NOT NULL UNIQUE,
    title TEXT,
    name TEXT NOT NULL,
    email TEXT,
    department TEXT,
    raw_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scrape_runs (
    id INTEGER PRIMARY KEY,
    source_url TEXT NOT NULL,
    branch_title TEXT,
    latest_versions_only INTEGER NOT NULL DEFAULT 1,
    partial INTEGER NOT NULL DEFAULT 0,
    fetched_at_unix INTEGER,
    finished_at_unix INTEGER,
    raw_source_json TEXT NOT NULL,
    imported_at_unix INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS study_programs (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    degree TEXT,
    subject TEXT,
    po_version TEXT,
    total_ects REAL,
    language TEXT,
    source_status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS catalog_nodes (
    run_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    parent_node_id TEXT,
    level INTEGER NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    permalink TEXT,
    detail_url TEXT,
    unit_id TEXT,
    period_id TEXT,
    expandable INTEGER NOT NULL DEFAULT 0,
    expanded INTEGER NOT NULL DEFAULT 0,
    catalog_path TEXT,
    path_titles_json TEXT NOT NULL DEFAULT '[]',
    raw_schedule_json TEXT NOT NULL DEFAULT '[]',
    raw_json TEXT NOT NULL,
    PRIMARY KEY (run_id, node_id),
    FOREIGN KEY (run_id) REFERENCES scrape_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY,
    run_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    period_id TEXT NOT NULL,
    title TEXT NOT NULL,
    number TEXT,
    catalog_title TEXT NOT NULL,
    organisation TEXT,
    course_type TEXT,
    offering_frequency TEXT,
    registration_period TEXT,
    short_comment TEXT,
    semester_hours REAL,
    detail_url TEXT,
    detail_page_url TEXT,
    raw_fields_json TEXT NOT NULL DEFAULT '{}',
    raw_json TEXT NOT NULL,
    UNIQUE (run_id, unit_id, period_id, detail_url),
    FOREIGN KEY (run_id) REFERENCES scrape_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id, node_id) REFERENCES catalog_nodes(run_id, node_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum_module_aliases (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,
    alias_type TEXT NOT NULL DEFAULT 'display_number',
    notes TEXT,
    UNIQUE (module_id, normalized_alias),
    FOREIGN KEY (module_id) REFERENCES curriculum_modules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parallel_groups (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    title TEXT,
    group_type TEXT,
    language TEXT,
    responsible_text TEXT,
    max_participants INTEGER,
    min_participants INTEGER,
    semester_hours REAL,
    raw_fields_json TEXT NOT NULL DEFAULT '{}',
    raw_json TEXT NOT NULL,
    UNIQUE (course_id, position),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_areas (
    id INTEGER PRIMARY KEY,
    program_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    required_ects REAL,
    min_ects REAL,
    max_ects REAL,
    area_type TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    source_note TEXT,
    UNIQUE (program_id, code),
    FOREIGN KEY (program_id) REFERENCES study_programs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY,
    parallel_group_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    rhythm TEXT,
    weekday TEXT,
    weekday_index INTEGER,
    time_text TEXT,
    start_time TEXT,
    end_time TEXT,
    time_note TEXT,
    date_text TEXT,
    starts_on TEXT,
    ends_on TEXT,
    room_text TEXT,
    instructors_text,
    expected_participants INTEGER,
    note TEXT,
    cancellation_text TEXT,
    raw_json TEXT NOT NULL,
    UNIQUE (parallel_group_id, position),
    FOREIGN KEY (parallel_group_id) REFERENCES parallel_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assessment_dates (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    date_value TEXT NOT NULL,
    kind TEXT NOT NULL,
    source TEXT NOT NULL,
    source_title TEXT,
    context TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    UNIQUE (course_id, date_value, kind, source, context),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS catalog_node_paths (
    run_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    ancestor_node_id TEXT NOT NULL,
    depth INTEGER NOT NULL,
    PRIMARY KEY (run_id, node_id, ancestor_node_id),
    FOREIGN KEY (run_id, node_id) REFERENCES catalog_nodes(run_id, node_id) ON DELETE CASCADE,
    FOREIGN KEY (run_id, ancestor_node_id) REFERENCES catalog_nodes(run_id, node_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_fields (
    course_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (course_id, key),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_sections (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    UNIQUE (course_id, position),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_curriculum_matches (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    module_id INTEGER NOT NULL,
    match_type TEXT NOT NULL,
    confidence REAL NOT NULL,
    notes TEXT,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (course_id, module_id, match_type),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES curriculum_modules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_fields (
    course_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (course_id, key),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_lecturers (
    course_id INTEGER NOT NULL,
    lecturer_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    source_text TEXT NOT NULL,
    PRIMARY KEY (course_id, lecturer_id, source),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_placements (
    course_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    PRIMARY KEY (course_id, node_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id, node_id) REFERENCES catalog_nodes(run_id, node_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS module_study_area_options (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL,
    study_area_id INTEGER NOT NULL,
    ects_counted REAL,
    status TEXT NOT NULL DEFAULT 'allowed',
    rule_text TEXT,
    source_note TEXT,
    UNIQUE (module_id, study_area_id, status),
    FOREIGN KEY (module_id) REFERENCES curriculum_modules(id) ON DELETE CASCADE,
    FOREIGN KEY (study_area_id) REFERENCES study_areas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parallel_group_fields (
    parallel_group_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (parallel_group_id, key),
    FOREIGN KEY (parallel_group_id) REFERENCES parallel_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parallel_group_lecturers (
    parallel_group_id INTEGER NOT NULL,
    lecturer_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    source_text TEXT NOT NULL,
    PRIMARY KEY (parallel_group_id, lecturer_id, source),
    FOREIGN KEY (parallel_group_id) REFERENCES parallel_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_area_inclusion_rules (
    id INTEGER PRIMARY KEY,
    target_study_area_id INTEGER NOT NULL,
    included_study_area_id INTEGER NOT NULL,
    rule_type TEXT NOT NULL,
    rule_text TEXT,
    source_note TEXT,
    UNIQUE (target_study_area_id, included_study_area_id, rule_type),
    FOREIGN KEY (target_study_area_id) REFERENCES study_areas(id) ON DELETE CASCADE,
    FOREIGN KEY (included_study_area_id) REFERENCES study_areas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointment_cancellations (
    appointment_id INTEGER NOT NULL,
    cancelled_on TEXT NOT NULL,
    PRIMARY KEY (appointment_id, cancelled_on),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointment_lecturers (
    appointment_id INTEGER NOT NULL,
    lecturer_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    source_text TEXT NOT NULL,
    PRIMARY KEY (appointment_id, lecturer_id, source),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_appointments_dates ON appointments(starts_on, ends_on);

CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(weekday_index, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_assessment_dates_course ON assessment_dates(course_id);

CREATE INDEX IF NOT EXISTS idx_assessment_dates_date ON assessment_dates(date_value);

CREATE INDEX IF NOT EXISTS idx_catalog_node_paths_ancestor ON catalog_node_paths(run_id, ancestor_node_id);

CREATE INDEX IF NOT EXISTS idx_catalog_nodes_kind ON catalog_nodes(run_id, kind);

CREATE INDEX IF NOT EXISTS idx_catalog_nodes_parent ON catalog_nodes(run_id, parent_node_id);

CREATE INDEX IF NOT EXISTS idx_course_curriculum_matches_course ON course_curriculum_matches(course_id);

CREATE INDEX IF NOT EXISTS idx_course_curriculum_matches_module ON course_curriculum_matches(module_id);

CREATE INDEX IF NOT EXISTS idx_course_lecturers_course ON course_lecturers(course_id);

CREATE INDEX IF NOT EXISTS idx_course_lecturers_lecturer ON course_lecturers(lecturer_id);

CREATE INDEX IF NOT EXISTS idx_course_placements_node ON course_placements(run_id, node_id);

CREATE INDEX IF NOT EXISTS idx_courses_number ON courses(number);

CREATE INDEX IF NOT EXISTS idx_courses_run_period ON courses(run_id, period_id);

CREATE INDEX IF NOT EXISTS idx_courses_type ON courses(course_type);

CREATE INDEX IF NOT EXISTS idx_curriculum_module_aliases_normalized ON curriculum_module_aliases(normalized_alias);

CREATE INDEX IF NOT EXISTS idx_lecturers_name ON lecturers(name);

CREATE INDEX IF NOT EXISTS idx_module_study_area_options_area ON module_study_area_options(study_area_id);

CREATE INDEX IF NOT EXISTS idx_parallel_groups_course ON parallel_groups(course_id);

CREATE INDEX IF NOT EXISTS idx_study_areas_program ON study_areas(program_id);

CREATE VIEW IF NOT EXISTS v_course_curriculum_options AS
SELECT
    c.id AS course_id,
    c.number AS course_number,
    c.title AS course_title,
    cm.id AS module_id,
    cm.module_code,
    cm.title AS module_title,
    cm.ects AS module_ects,
    sp.code AS program_code,
    sp.name AS program_name,
    sa.code AS study_area_code,
    sa.name AS study_area_name,
    sa.required_ects,
    opt.ects_counted,
    opt.status AS option_status,
    opt.rule_text,
    m.match_type,
    m.confidence,
    m.notes AS match_notes
FROM course_curriculum_matches m
JOIN courses c ON c.id = m.course_id
JOIN curriculum_modules cm ON cm.id = m.module_id
LEFT JOIN module_study_area_options opt ON opt.module_id = cm.id
LEFT JOIN study_areas sa ON sa.id = opt.study_area_id
LEFT JOIN study_programs sp ON sp.id = sa.program_id;

CREATE VIEW IF NOT EXISTS v_course_schedule AS
SELECT
    c.id AS course_id,
    c.unit_id,
    c.period_id,
    c.number,
    c.title AS course_title,
    c.course_type,
    pg.id AS parallel_group_id,
    pg.title AS parallel_group_title,
    pg.language,
    pg.responsible_text,
    a.id AS appointment_id,
    a.rhythm,
    a.weekday,
    a.weekday_index,
    a.start_time,
    a.end_time,
    a.starts_on,
    a.ends_on,
    a.room_text,
    a.instructors_text,
    a.note,
    a.cancellation_text
FROM courses c
JOIN parallel_groups pg ON pg.course_id = c.id
LEFT JOIN appointments a ON a.parallel_group_id = pg.id;
