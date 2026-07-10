PRAGMA foreign_keys = ON;

-- The original curriculum JSON was imported only into alma.sqlite and then
-- deleted. Keep its verified reference rows in a migration so a fresh D1 has
-- the same module codes, ECTS values, aliases, and study-area options.
-- json_each keeps each seed operation to one D1 statement; remote D1 imports
-- otherwise coalesce UNION/VALUES rows into an oversized compound SELECT.
INSERT INTO curriculum_modules (module_code, title, ects, module_type, level, source_note)
SELECT
    json_extract(entry.value, '$.code'),
    json_extract(entry.value, '$.title'),
    json_extract(entry.value, '$.ects'),
    json_extract(entry.value, '$.type'),
    json_extract(entry.value, '$.level'),
    'Legacy curriculum reference migrated in 0031.'
FROM json_each('[
  {"code":"INF1020","title":"Mathematik fuer Informatik 2: Lineare Algebra","ects":9,"type":"lecture_tutorial","level":"bachelor"},
  {"code":"INF1120","title":"Praktische Informatik 2: Imperative und objektorientierte Programmierung","ects":9,"type":"lecture_tutorial","level":"bachelor"},
  {"code":"INF2310","title":"Technische Informatik 2: Informatik der Systeme","ects":9,"type":"lecture_tutorial","level":"bachelor"},
  {"code":"INF2410","title":"Theoretische Informatik 2: Formale Sprachen, Berechenbarkeit und Komplexitaet","ects":9,"type":"lecture_tutorial","level":"bachelor"},
  {"code":"INF3151","title":"Grundlagen des maschinellen Lernens","ects":6,"type":"lecture_tutorial","level":"bachelor"},
  {"code":"INF3153","title":"Computergrafik, Computer Vision und Maschinelles Lernen","ects":3,"type":"seminar","level":"bachelor"},
  {"code":"INF3413","title":"Algorithmische Geometrie","ects":6,"type":"lecture_tutorial","level":"bachelor"},
  {"code":"INFO4193","title":"Natural Language Processing","ects":9,"type":"lecture_tutorial","level":"master"},
  {"code":"INFO4416","title":"Datenstrukturen","ects":9,"type":"lecture_tutorial","level":"master"},
  {"code":"INFO4451","title":"Introduction to Cryptography","ects":9,"type":"lecture_tutorial","level":"master"},
  {"code":"INFO4998","title":"Forschungsprojekt Informatik","ects":9,"type":"project","level":"master"},
  {"code":"MEDZ4991","title":"Medical Data Science","ects":6,"type":"lecture_tutorial","level":"master"}
]') AS entry
WHERE true
ON CONFLICT(module_code) DO UPDATE SET
    title = excluded.title,
    ects = excluded.ects,
    module_type = excluded.module_type,
    level = excluded.level,
    source_note = excluded.source_note;

INSERT OR IGNORE INTO curriculum_module_aliases (module_id, alias, normalized_alias, alias_type)
SELECT
    cm.id,
    json_extract(entry.value, '$.alias'),
    json_extract(entry.value, '$.normalizedAlias'),
    json_extract(entry.value, '$.type')
FROM json_each('[
  {"code":"INF1020","alias":"INF1020","normalizedAlias":"INF1020","type":"module_code"},
  {"code":"INF1020","alias":"INF1020-V","normalizedAlias":"INF1020V","type":"alma_number"},
  {"code":"INF1020","alias":"INFM1020","normalizedAlias":"INFM1020","type":"alma_number"},
  {"code":"INF1120","alias":"INF1120","normalizedAlias":"INF1120","type":"module_code"},
  {"code":"INF1120","alias":"INFM1120","normalizedAlias":"INFM1120","type":"alma_number"},
  {"code":"INF2310","alias":"INF2310","normalizedAlias":"INF2310","type":"module_code"},
  {"code":"INF2310","alias":"INFM2310","normalizedAlias":"INFM2310","type":"alma_number"},
  {"code":"INF2410","alias":"INF2410","normalizedAlias":"INF2410","type":"module_code"},
  {"code":"INF2410","alias":"INFM2410","normalizedAlias":"INFM2410","type":"alma_number"},
  {"code":"INF3151","alias":"INF3151","normalizedAlias":"INF3151","type":"module_code"},
  {"code":"INF3153","alias":"INF3153","normalizedAlias":"INF3153","type":"module_code"},
  {"code":"INF3413","alias":"INF3413","normalizedAlias":"INF3413","type":"module_code"},
  {"code":"INFO4193","alias":"INFO4193","normalizedAlias":"INFO4193","type":"module_code"},
  {"code":"INFO4416","alias":"INFO4416","normalizedAlias":"INFO4416","type":"module_code"},
  {"code":"INFO4451","alias":"INFO4451","normalizedAlias":"INFO4451","type":"module_code"},
  {"code":"INFO4998","alias":"INFO4998","normalizedAlias":"INFO4998","type":"module_code"},
  {"code":"MEDZ4991","alias":"MEDZ4991","normalizedAlias":"MEDZ4991","type":"module_code"}
]') AS entry
JOIN curriculum_modules AS cm ON cm.module_code = json_extract(entry.value, '$.code');

INSERT OR IGNORE INTO module_study_area_options (
    module_id, study_area_id, ects_counted, status, rule_text, source_note
)
SELECT
    cm.id,
    sa.id,
    json_extract(entry.value, '$.ects'),
    json_extract(entry.value, '$.status'),
    json_extract(entry.value, '$.rule'),
    'Legacy curriculum reference migrated in 0031.'
FROM json_each('[
  {"code":"INF1020","program":"BSC_INFO_2021","area":"MATH","ects":9,"status":"required","rule":"Pflichtstudienbereich Mathematik"},
  {"code":"INF1120","program":"BSC_INFO_2021","area":"INF","ects":9,"status":"required","rule":"Pflichtstudienbereich Informatik"},
  {"code":"INF2310","program":"BSC_INFO_2021","area":"INF","ects":9,"status":"required","rule":"Pflichtstudienbereich Informatik"},
  {"code":"INF2410","program":"BSC_INFO_2021","area":"INF","ects":9,"status":"required","rule":"Pflichtstudienbereich Informatik"},
  {"code":"INF3151","program":"BSC_INFO_2021","area":"INFO","ects":6,"status":"allowed","rule":"Bachelor mapping table"},
  {"code":"INF3153","program":"BSC_INFO_2021","area":"PROSEM","ects":3,"status":"allowed","rule":"Bachelor mapping table; proseminar/ueberfachlich"},
  {"code":"INF3413","program":"BSC_INFO_2021","area":"THEO","ects":6,"status":"allowed","rule":"Bachelor mapping table"},
  {"code":"INF3413","program":"MSC_INFO_2021","area":"INFO-BASIS","ects":6,"status":"conditional","rule":"Bachelor module usable only under foundation/previous-study conditions"},
  {"code":"INFO4193","program":"MSC_INFO_2021","area":"INFO-INFO","ects":9,"status":"allowed","rule":"Master Informatik module; initial high-confidence seed"},
  {"code":"INFO4193","program":"MSC_ML_2021","area":"ML-CS","ects":9,"status":"allowed","rule":"General Computer Science"},
  {"code":"INFO4416","program":"MSC_INFO_2021","area":"INFO-THEO","ects":9,"status":"allowed","rule":"Master Informatik module; initial high-confidence seed"},
  {"code":"INFO4416","program":"MSC_INFO_2021","area":"INFO-INFO","ects":9,"status":"allowed","rule":"INFO-INFO includes Informatik depth modules"},
  {"code":"INFO4416","program":"MSC_ML_2021","area":"ML-CS","ects":9,"status":"allowed","rule":"General Computer Science"},
  {"code":"INFO4451","program":"MSC_INFO_2021","area":"INFO-THEO","ects":9,"status":"allowed","rule":"Master Informatik module; initial high-confidence seed"},
  {"code":"INFO4451","program":"MSC_INFO_2021","area":"INFO-INFO","ects":9,"status":"allowed","rule":"INFO-INFO includes Informatik depth modules"},
  {"code":"INFO4451","program":"MSC_ML_2021","area":"ML-CS","ects":9,"status":"allowed","rule":"General Computer Science"},
  {"code":"INFO4998","program":"MSC_INFO_2021","area":"INFO-INFO","ects":9,"status":"allowed","rule":"Research project can count in INFO-INFO"},
  {"code":"MEDZ4991","program":"MSC_ML_2021","area":"ML-CS","ects":6,"status":"allowed","rule":"Listed under General Computer Science in the ML handbook"}
]') AS entry
JOIN curriculum_modules AS cm ON cm.module_code = json_extract(entry.value, '$.code')
JOIN study_programs AS sp ON sp.code = json_extract(entry.value, '$.program')
JOIN study_areas AS sa ON sa.program_id = sp.id AND sa.code = json_extract(entry.value, '$.area');
