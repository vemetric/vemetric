-- Fix session table for fresh installs.
--
-- On fresh DB: migration 1 creates `session` with ReplacingMergeTree (no version),
-- and migration 11 creates `session_v2` with the correct ReplacingMergeTree(endedAt).
-- This adds importSource to session_v2, migrates data, drops old session, and renames.
--
-- On prod: this migration should be skipped by inserting a record into _migrations:
--   INSERT INTO _migrations (version, checksum, migration_name)
--   VALUES (14, '<md5>', '14_fix_session_table.sql');

ALTER TABLE session_v2 ADD COLUMN IF NOT EXISTS `importSource` String DEFAULT '';

INSERT INTO session_v2 SELECT * FROM session;

DROP TABLE session;

RENAME TABLE session_v2 TO session;
