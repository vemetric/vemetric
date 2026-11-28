-- Allow online-session lookups filtering on endedAt >= <threshold> to skip historical granules
-- whose max(endedAt) precedes the active window instead of scanning every partition for a project.
ALTER TABLE session_v3
    ADD INDEX IF NOT EXISTS ended_at_idx endedAt TYPE minmax GRANULARITY 1;

ALTER TABLE session_v3
    MATERIALIZE INDEX ended_at_idx;
