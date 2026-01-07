-- Drop the user_project table and ProjectRole enum
-- This migration removes per-project user access in favor of organization-based access

-- Drop foreign key constraints first
ALTER TABLE "user_project" DROP CONSTRAINT IF EXISTS "user_project_projectId_fkey";
ALTER TABLE "user_project" DROP CONSTRAINT IF EXISTS "user_project_userId_fkey";

-- Drop the table
DROP TABLE IF EXISTS "user_project";

-- Drop the enum
DROP TYPE IF EXISTS "ProjectRole";
