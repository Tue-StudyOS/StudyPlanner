ALTER TABLE content_sections ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE course_fields ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]';
