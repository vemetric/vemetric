ALTER TABLE user ADD COLUMN IF NOT EXISTS `referrerUrl` String DEFAULT `referrer`;

ALTER TABLE event ADD COLUMN IF NOT EXISTS `referrerType` String DEFAULT 'unknown';
ALTER TABLE session ADD COLUMN IF NOT EXISTS `referrerType` String DEFAULT 'unknown';
ALTER TABLE user ADD COLUMN IF NOT EXISTS `referrerType` String DEFAULT 'unknown';