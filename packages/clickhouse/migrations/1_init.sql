SET allow_experimental_object_type = 1;


CREATE TABLE IF NOT EXISTS device (
    `sign` Int8,

    `projectId` UInt64,
    `userId` UInt64,
    `id` UInt64,

    `createdAt` DateTime64(3, 'UTC') DEFAULT NOW64(3),

    `osName` LowCardinality(String),
    `osVersion` LowCardinality(String),
    `clientName` LowCardinality(String),
    `clientVersion` LowCardinality(String),
    `clientType` LowCardinality(String),
    `deviceType` LowCardinality(String)
)
ENGINE = CollapsingMergeTree(sign)
ORDER BY (projectId, userId, id, createdAt)
SETTINGS index_granularity = 8192;


CREATE TABLE IF NOT EXISTS session (
    `deleted` Int8 DEFAULT 0,

    `projectId` UInt64,
    `userId` UInt64,
    `id` String,

    `startedAt` DateTime64(3, 'UTC') DEFAULT NOW64(3),
    `endedAt` DateTime64(3, 'UTC') DEFAULT NOW64(3),
    `duration` UInt32 DEFAULT 0,
    -- TODO: `events` UInt16,

    `countryCode` LowCardinality(FixedString(2)),
    `city` String,

    -- TODO: `entryTitle` String,
    -- TODO: `exitTitle` String,
    -- TODO: `entryPage` String,
    -- TODO: `exitPage` String,

    `userAgent` String,
    `referrer` String,
    `subdomain` String,
    `pathname` String,
    `queryParams` String,
    `urlHash` String,

    `utmSource` String,
    `utmMedium` String,
    `utmCampaign` String,
    `utmContent` String,
    `utmTerm` String,
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(startedAt)
ORDER BY (projectId, userId, startedAt)
SETTINGS index_granularity = 8192;


CREATE TABLE IF NOT EXISTS event (
    `sign` Int8,

    `projectId` UInt64,
    `userId` UInt64,
    `sessionId` String,
    `contextId` String,
    `deviceId` UInt64,
    `id` String,
    `name` String,
    
    `createdAt` DateTime64(3, 'UTC') DEFAULT NOW64(3),
    `isPageView` Int8 DEFAULT 0,
    `isPageLeave` Int8 DEFAULT 0,

    `countryCode` LowCardinality(FixedString(2)),
    `city` String,

    `osName` LowCardinality(String),
    `osVersion` LowCardinality(String),
    `clientName` LowCardinality(String),
    `clientVersion` LowCardinality(String),
    `clientType` LowCardinality(String),
    `deviceType` LowCardinality(String),

    `userIdentifier` String,
    `userDisplayName` String,

    `userAgent` String,
    `referrer` String,
    `subdomain` String,
    `pathname` String,
    `queryParams` String,
    `urlHash` String,
    
    `utmSource` String,
    `utmMedium` String,
    `utmCampaign` String,
    `utmContent` String,
    `utmTerm` String,

    `customData` String,
)
ENGINE = CollapsingMergeTree(sign)
PARTITION BY toYYYYMM(createdAt)
ORDER BY (projectId, userId, createdAt)
SETTINGS index_granularity = 8192;