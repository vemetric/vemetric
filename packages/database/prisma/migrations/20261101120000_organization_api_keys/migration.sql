-- AlterTable
ALTER TABLE "api_key" ADD COLUMN     "allProjects" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organizationId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- Existing keys become project keys of their project's organization
UPDATE "api_key" SET "organizationId" = "project"."organizationId" FROM "project" WHERE "project"."id" = "api_key"."projectId";

ALTER TABLE "api_key" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateTable
CREATE TABLE "api_key_project" (
    "apiKeyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "api_key_project_pkey" PRIMARY KEY ("apiKeyId","projectId")
);

-- CreateIndex
CREATE INDEX "api_key_project_projectId_idx" ON "api_key_project"("projectId");

-- CreateIndex
CREATE INDEX "api_key_organizationId_idx" ON "api_key"("organizationId");

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_project" ADD CONSTRAINT "api_key_project_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_key"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_project" ADD CONSTRAINT "api_key_project_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
