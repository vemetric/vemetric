CREATE TABLE IF NOT EXISTS user (
    `deleted` Int8 DEFAULT 0,

    `projectId` UInt64,
    `id` UInt64,
    `identifier` String,
    `displayName` String,

    `createdAt` DateTime64(3, 'UTC') DEFAULT NOW64(3),
    `updatedAt` DateTime64(3, 'UTC') DEFAULT NOW64(3),
    -- TODO: `events` UInt16,

    `countryCode` LowCardinality(FixedString(2)),
    `city` String,

    `initialDeviceId` UInt64,

    `customData` String,

    -- These are all the properties for the users initial visit:
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
ORDER BY (projectId, id, identifier)
SETTINGS index_granularity = 8192;
