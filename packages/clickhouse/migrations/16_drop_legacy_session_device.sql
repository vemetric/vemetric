-- Drop the legacy session and device tables, replaced by session_v3 and device_v2 in migration 15.
-- Their data was copied by the one-time backfill; nothing reads or writes them anymore.
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS device;
