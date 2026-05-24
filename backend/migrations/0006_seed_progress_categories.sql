PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO progress_categories (
    code,
    name,
    description,
    reference_ects,
    color_token,
    sort_order
) VALUES
    ('SOFTWARE_ENG', 'Software Engineering', 'Architecture, software quality, and implementation practice.', 12, 'cat-prak', 10),
    ('THEORY', 'Theory', 'Algorithms, formal methods, cryptography, and theoretical Informatics.', 18, 'cat-theo', 20),
    ('MATHEMATICS', 'Mathematics', 'Linear algebra, statistics, and mathematical foundations.', 18, 'cat-basis', 30),
    ('SYSTEMS_SECURITY', 'Systems & Security', 'Systems, networks, infrastructure, and security.', 12, 'cat-tech', 40),
    ('DATA_DATABASES', 'Data & Databases', 'Database systems, data engineering, and data-intensive computing.', 12, 'cat-info', 50),
    ('AI_ML', 'AI & Machine Learning', 'Machine learning, NLP, and data-driven AI.', 18, 'cat-fokus', 60),
    ('VISION', 'Vision', 'Computer vision, computational photography, and visual perception.', 12, 'cat-tech', 70),
    ('HCI_UX', 'HCI & UX', 'Interaction techniques, HCI, and usability.', 12, 'cat-info', 80),
    ('ROBOTICS', 'Robotics', 'Robotics and autonomous systems.', 12, 'cat-tech', 90),
    ('INTERDISCIPLINARY', 'Interdisciplinary', 'Courses that connect Informatics with other domains.', 12, 'cat-info', 100);

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'SOFTWARE_ENG'
  AND c.number IN ('INF1120', 'INFM1120', 'INF3181', 'INF3674', 'INFO4222', 'INFO4999');

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'THEORY'
  AND c.number IN ('INF2410', 'INFM2410', 'INF3413', 'INF3483', 'INF3484', 'INF3653', 'INFO4419', 'INFO4451');

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'MATHEMATICS'
  AND c.number IN ('INF1020', 'INF1020-V', 'INF4151', 'ML4201')
   OR (
        pc.code = 'MATHEMATICS'
        AND c.title IN ('Theory of Machine Learning', 'Statistical Machine Learning')
   );

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'SYSTEMS_SECURITY'
  AND c.number IN ('INF2310', 'INF3171', 'INF3614', 'INF4347', 'INFO4451');

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'DATA_DATABASES'
  AND c.number IN ('INF3132', 'INFO4663', 'MEDZ4991')
   OR (
        pc.code = 'DATA_DATABASES'
        AND c.title IN ('Biomedical Data Science', 'Database Technology (DBBD)')
   );

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'AI_ML'
  AND c.number IN ('INF3151', 'INF3154', 'INF3671a', 'ML4201', 'INFO4193', 'MEDZ4250', 'MEDZ4522', 'MEDZ4523')
   OR (
        pc.code = 'AI_ML'
        AND c.title IN (
            'Theory of Machine Learning',
            'Oberseminar Machine Learning in Science',
            'Statistical Language Processing (CL III)',
            'Biomedical Data Science'
        )
   );

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'VISION'
  AND c.number IN ('INF3153', 'INF4168', 'INFO4504V / KOG', 'INFO4504S / KOG')
   OR (
        pc.code = 'VISION'
        AND c.title IN ('Autonomous Vision', 'Computational Photography', 'Understanding Vision (1 - Lecture)', 'Understanding Vision (2 - Seminar)')
   );

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'HCI_UX'
  AND c.title IN ('Interaction Techniques and Technologies');

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'ROBOTICS'
  AND c.number IN ('INF4361', 'INF4362', 'ML4602', 'MEDZ4620');

INSERT OR IGNORE INTO course_progress_category_mappings (
    progress_category_id,
    course_id,
    regulation_version_id,
    source_note
)
SELECT pc.id, c.id, NULL, 'Initial visualization seed by course number/title.'
FROM progress_categories AS pc
JOIN courses AS c ON 1 = 1
WHERE pc.code = 'INTERDISCIPLINARY'
  AND c.number IN ('INF3241a', 'INF3241c (früher INF1510)', 'INFO4193', 'MEDZ4991')
   OR (
        pc.code = 'INTERDISCIPLINARY'
        AND c.title IN (
            'Biomedical Data Science',
            'Natural Language Processing',
            'Maschinelle Sprachverarbeitung (NLP): Wort und Lexikon',
            'Maschinelle Sprachverarbeitung (NLP): Text und Diskurs'
        )
   );
