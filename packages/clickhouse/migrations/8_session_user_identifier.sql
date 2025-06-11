ALTER TABLE session ADD COLUMN IF NOT EXISTS `userIdentifier` Nullable(String) DEFAULT NULL;
ALTER TABLE session ADD COLUMN IF NOT EXISTS `userDisplayName` Nullable(String) DEFAULT NULL;