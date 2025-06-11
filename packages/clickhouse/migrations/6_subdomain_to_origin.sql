ALTER TABLE event RENAME COLUMN IF EXISTS `subdomain` to `origin`;
ALTER TABLE session RENAME COLUMN IF EXISTS `subdomain` to `origin`;
ALTER TABLE user RENAME COLUMN IF EXISTS `subdomain` to `origin`;