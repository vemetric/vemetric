/*
  Warnings:

  - A unique constraint covering the columns `[id,organizationId]` on the table `project` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "user_project_access" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "user_project_access_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateIndex
CREATE INDEX "user_project_access_userId_organizationId_idx" ON "user_project_access"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "project_id_organizationId_key" ON "project"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "user_project_access" ADD CONSTRAINT "user_project_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_project_access" ADD CONSTRAINT "user_project_access_projectId_organizationId_fkey" FOREIGN KEY ("projectId", "organizationId") REFERENCES "project"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_project_access" ADD CONSTRAINT "user_project_access_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
