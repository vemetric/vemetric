ALTER TABLE event ADD COLUMN IF NOT EXISTS `referrerUrl` String DEFAULT `referrer`;
ALTER TABLE session ADD COLUMN IF NOT EXISTS `referrerUrl` String DEFAULT `referrer`;