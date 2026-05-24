PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO examination_regulations (
    code,
    name,
    degree,
    subject,
    notes
) VALUES
    (
        'BSC_INFO',
        'B.Sc. Informatik',
        'B.Sc.',
        'Informatik',
        'Initial regulation seed derived from the tracked B.Sc. Informatik program.'
    ),
    (
        'MSC_INFO',
        'M.Sc. Informatik',
        'M.Sc.',
        'Informatik',
        'Initial regulation seed derived from the tracked M.Sc. Informatik program.'
    ),
    (
        'MSC_ML',
        'M.Sc. Machine Learning',
        'M.Sc.',
        'Machine Learning',
        'Initial regulation seed derived from the tracked M.Sc. Machine Learning program.'
    );

INSERT OR IGNORE INTO regulation_versions (
    regulation_id,
    code,
    version_label,
    total_ects,
    language,
    source_status,
    notes
)
SELECT
    er.id,
    sp.code,
    COALESCE(sp.po_version, 'unknown'),
    sp.total_ects,
    sp.language,
    sp.source_status,
    sp.notes
FROM study_programs AS sp
JOIN examination_regulations AS er
    ON er.code = CASE sp.code
        WHEN 'BSC_INFO_2021' THEN 'BSC_INFO'
        WHEN 'MSC_INFO_2021' THEN 'MSC_INFO'
        WHEN 'MSC_ML_2021' THEN 'MSC_ML'
    END
WHERE sp.code IN ('BSC_INFO_2021', 'MSC_INFO_2021', 'MSC_ML_2021');

INSERT OR IGNORE INTO study_program_regulation_versions (
    study_program_id,
    regulation_version_id,
    is_default,
    enrollment_match
)
SELECT
    sp.id,
    rv.id,
    1,
    'program_code'
FROM study_programs AS sp
JOIN regulation_versions AS rv ON rv.code = sp.code
WHERE sp.code IN ('BSC_INFO_2021', 'MSC_INFO_2021', 'MSC_ML_2021');

INSERT OR IGNORE INTO regulation_rule_groups (
    regulation_version_id,
    study_area_id,
    code,
    name,
    group_type,
    required_ects,
    min_ects,
    max_ects,
    sort_order,
    notes
)
SELECT
    rv.id,
    sa.id,
    sa.code,
    sa.name,
    COALESCE(sa.area_type, 'study_area'),
    sa.required_ects,
    sa.min_ects,
    sa.max_ects,
    sa.sort_order,
    sa.source_note
FROM study_areas AS sa
JOIN study_programs AS sp ON sp.id = sa.program_id
JOIN regulation_versions AS rv ON rv.code = sp.code
WHERE sp.code IN ('BSC_INFO_2021', 'MSC_INFO_2021', 'MSC_ML_2021');

INSERT OR IGNORE INTO regulation_course_mappings (
    regulation_version_id,
    course_id,
    module_id,
    rule_group_id,
    status,
    ects_counted,
    match_type,
    source_note
)
SELECT DISTINCT
    rv.id,
    m.course_id,
    m.module_id,
    rrg.id,
    COALESCE(opt.status, 'allowed'),
    COALESCE(opt.ects_counted, cm.ects),
    m.match_type,
    COALESCE(opt.rule_text, m.notes)
FROM course_curriculum_matches AS m
JOIN curriculum_modules AS cm ON cm.id = m.module_id
JOIN module_study_area_options AS opt ON opt.module_id = cm.id
JOIN study_areas AS sa ON sa.id = opt.study_area_id
JOIN study_programs AS sp ON sp.id = sa.program_id
JOIN regulation_versions AS rv ON rv.code = sp.code
JOIN regulation_rule_groups AS rrg
    ON rrg.regulation_version_id = rv.id
   AND rrg.study_area_id = sa.id
WHERE sp.code IN ('BSC_INFO_2021', 'MSC_INFO_2021', 'MSC_ML_2021');
