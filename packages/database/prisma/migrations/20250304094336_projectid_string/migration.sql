/*
  Warnings:

  - The primary key for the `project` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user_project` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "user_project" DROP CONSTRAINT "user_project_projectId_fkey";

-- AlterTable
ALTER TABLE "project" DROP CONSTRAINT "project_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "project_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_project" DROP CONSTRAINT "user_project_pkey",
ALTER COLUMN "projectId" SET DATA TYPE TEXT,
ADD CONSTRAINT "user_project_pkey" PRIMARY KEY ("userId", "projectId");

-- AddForeignKey
ALTER TABLE "user_project" ADD CONSTRAINT "user_project_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
