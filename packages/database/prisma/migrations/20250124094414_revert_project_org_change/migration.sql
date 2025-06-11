/*
  Warnings:

  - You are about to drop the `organization_project` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('ADMIN', 'MEMBER');

-- DropForeignKey
ALTER TABLE "organization_project" DROP CONSTRAINT "organization_project_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "organization_project" DROP CONSTRAINT "organization_project_projectId_fkey";

-- DropTable
DROP TABLE "organization_project";

-- CreateTable
CREATE TABLE "user_project" (
    "userId" TEXT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "role" "ProjectRole" NOT NULL,

    CONSTRAINT "user_project_pkey" PRIMARY KEY ("userId","projectId")
);

-- AddForeignKey
ALTER TABLE "user_project" ADD CONSTRAINT "user_project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_project" ADD CONSTRAINT "user_project_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
