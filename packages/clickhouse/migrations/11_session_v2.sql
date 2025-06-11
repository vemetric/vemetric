CREATE TABLE IF NOT EXISTS session_v2 (
    `deleted` Int8 DEFAULT 0,

    `projectId` UInt64,
    `userId` UInt64,
    `id` String,

    `startedAt` DateTime64(3, 'UTC') DEFAULT NOW64(3),
    `endedAt` DateTime64(3, 'UTC') DEFAULT NOW64(3),
    `duration` UInt32 DEFAULT 0,

    `userIdentifier` Nullable(String) DEFAULT NULL,
    `userDisplayName` Nullable(String) DEFAULT NULL,

    `countryCode` LowCardinality(FixedString(2)),
    `city` String,

    `userAgent` String,

    `referrer` String,
    `referrerUrl` String DEFAULT `referrer`,
    `referrerType` String DEFAULT 'unknown',

    `origin` String,
    `pathname` String,
    `queryParams` String,
    `urlHash` String,

    `utmSource` String,
    `utmMedium` String,
    `utmCampaign` String,
    `utmContent` String,
    `utmTerm` String,

    `latitude` Nullable(Float32) DEFAULT NULL,
    `longitude` Nullable(Float32) DEFAULT NULL,
)
ENGINE = ReplacingMergeTree(endedAt)
PARTITION BY toYYYYMM(startedAt)
ORDER BY (projectId, userId, startedAt)
SETTINGS index_granularity = 8192;