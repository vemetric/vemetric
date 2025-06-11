ALTER TABLE "project" RENAME COLUMN "apiKey" TO "token";
ALTER INDEX "project_apiKey_key" RENAME TO "project_token_key";
ALTER TABLE "project" ALTER COLUMN "token" DROP DEFAULT;