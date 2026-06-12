-- Maps a course (by its stable course number) to external learning platform
-- links such as Moodle or Ilias. The table ships empty and is filled later;
-- the UI shows an explicit "no link available" state until then.
CREATE TABLE IF NOT EXISTS course_external_links (
    id INTEGER PRIMARY KEY,
    course_number TEXT NOT NULL,
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    label TEXT,
    UNIQUE (course_number, platform)
);

CREATE INDEX IF NOT EXISTS idx_course_external_links_course_number
    ON course_external_links(course_number);
