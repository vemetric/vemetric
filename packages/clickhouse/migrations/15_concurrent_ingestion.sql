-- Schema only. Run backfill-ingestion separately with all ClickHouse writers stopped.
-- startedAt is immutable once a session snapshot exists, so all its revisions share one
-- monthly partition and one sorting key. Sorting by startedAt lets date-range dashboard queries
-- read only the requested days; lookups of a single session by id use the id bloom filter.
-- Early activity stays in Redis until session creation; it is never stored here.
--
-- Tombstones (deleted = 1) are load-bearing: they reject late writes of a merged-away key and
-- hide it from analytics. They are durable and deliberately NOT expired by a table TTL: removing
-- only the marker row while an older live revision may still exist would resurrect the key.
-- Tombstones are written compact (key, partition anchor, revision, deleted) to bound growth.
CREATE TABLE IF NOT EXISTS session_v3 (
    projectId UInt64,
    userId UInt64,
    id String,
    startedAt DateTime64(3, 'UTC'),
    endedAt DateTime64(3, 'UTC'),
    duration UInt32 DEFAULT 0,
    userIdentifier Nullable(String) DEFAULT NULL,
    userDisplayName Nullable(String) DEFAULT NULL,
    countryCode LowCardinality(FixedString(2)),
    city String,
    latitude Nullable(Float32) DEFAULT NULL,
    longitude Nullable(Float32) DEFAULT NULL,
    userAgent String,
    referrer String,
    referrerUrl String DEFAULT referrer,
    referrerType String DEFAULT 'unknown',
    origin String,
    pathname String,
    queryParams String,
    urlHash String,
    utmSource String,
    utmMedium String,
    utmCampaign String,
    utmContent String,
    utmTerm String,
    importSource String DEFAULT '',
    revision UInt64 DEFAULT 1,
    deleted Int8 DEFAULT 0,
    -- Let per-session and per-user reads skip granules instead of scanning the whole project.
    INDEX id_idx id TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX user_id_idx userId TYPE bloom_filter(0.01) GRANULARITY 1
) ENGINE = ReplacingMergeTree(revision)
ORDER BY (projectId, startedAt, id)
PARTITION BY toYYYYMM(startedAt);

CREATE TABLE IF NOT EXISTS device_v2 (
    projectId UInt64,
    userId UInt64,
    id UInt64,
    createdAt DateTime64(3, 'UTC'),
    osName LowCardinality(String),
    osVersion LowCardinality(String),
    clientName LowCardinality(String),
    clientVersion LowCardinality(String),
    clientType LowCardinality(String),
    deviceType LowCardinality(String),
    importSource String DEFAULT '',
    revision UInt64,
    deleted Int8 DEFAULT 0
) ENGINE = ReplacingMergeTree(revision)
ORDER BY (projectId, userId, id);
