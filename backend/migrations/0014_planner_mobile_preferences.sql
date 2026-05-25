PRAGMA foreign_keys = ON;

ALTER TABLE user_profiles ADD COLUMN planner_mobile_mode TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE user_profiles ADD COLUMN planner_mobile_layout TEXT NOT NULL DEFAULT 'compact-grid';
